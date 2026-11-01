import { describe, it, expect } from "vitest";
import {
  calculationSteps,
  type CalculationStep,
} from "../src/engine/ai-calculation-steps";
import { defaults, runAILab, type LabId } from "../src/engine/ai-labs";

const output = (step: CalculationStep) =>
  step.cells.find((c) => c.id === step.result)!.value;
function checkSteps(steps: CalculationStep[]) {
  expect(steps.length).toBeGreaterThan(0);
  for (const s of steps) {
    expect(s.cells.length).toBeLessThanOrEqual(4);
    for (const part of s.parts)
      if (typeof part !== "string")
        expect(s.cells.some((c) => c.id === part.cell)).toBe(true);
    expect(s.cells.some((c) => c.id === s.result)).toBe(true);
    const operands = s.parts
      .filter((p) => typeof p !== "string")
      .map((p) => s.cells.find((c) => c.id === p.cell)!.value);
    if (s.operation === "add")
      expect(Number(operands[0]) + Number(operands[1])).toBeCloseTo(
        Number(output(s)),
        12,
      );
    if (s.operation === "mul")
      expect(Number(operands[0]) * Number(operands[1])).toBeCloseTo(
        Number(output(s)),
        12,
      );
    if (s.operation === "sub")
      expect(Number(operands[0]) - Number(operands[1])).toBeCloseTo(
        Number(output(s)),
        12,
      );
  }
}
describe("calculation micro traces", () => {
  it("backpropagation starts at loss and expands local derivatives, chain products and accumulated paths", () => {
    const config = { ...defaults("neural-training"), rounds: 1 };
    const frame = runAILab("neural-training", config).frames.find(
      (f) => f.phase === "backward",
    )!;
    const steps = calculationSteps("neural-training", frame, config, {
      key: "parameter",
      row: 0,
      col: 0,
      parameter: "W1[0,0]",
      field: "gradient",
    });
    expect(steps[0]).toMatchObject({
      operation: "seed",
      stage: "loss",
      direction: "backward",
    });
    expect(output(steps[0])).toBe(1);
    expect(new Set(steps.map((s) => s.stage))).toEqual(
      new Set(["loss", "z", "h0", "update"]),
    );
    for (let i = 1; i < steps.length - 3; i += 3) {
      const [local, product, total] = steps.slice(i, i + 3);
      expect([local.operation, product.operation, total.operation]).toEqual([
        "derivative",
        "mul",
        "add",
      ]);
      expect(local.edgeLabel).toMatch(/^∂v\/∂u /);
      expect(Number(output(product))).toBeCloseTo(
        Number(product.cells[0].value) * Number(output(local)),
        13,
      );
      expect(total.cells[1].id).toBe(product.result);
      expect(total.cells[0].caption).toBe("已有累积");
      if (local.rule?.startsWith("tanh"))
        expect(Number(output(local))).toBeCloseTo(
          1 - Number(local.cells[0].value) ** 2,
          13,
        );
    }
    const weights = steps.filter(
      (s) => s.operation === "add" && s.field === "gradient",
    );
    expect(weights).toHaveLength(4); // one shared-weight contribution per sample
    expect(Number(weights[1].cells[0].value)).toBe(Number(output(weights[0])));
    expect(Number(output(weights.at(-1)!))).toBeCloseTo(
      frame.updates.find((p) => p.name === "W1[0,0]")!.gradient,
      13,
    );
    expect(steps.slice(-3).every((s) => s.stage === "update")).toBe(true);
    expect(
      steps.some((s) =>
        s.edges.some(([from, to]) => from === "loss" && to === "z"),
      ),
    ).toBe(true);
    expect(steps.some((s) => s.edges.some((edge) => edge.includes("p")))).toBe(
      false,
    );
  });
  it("Transformer residual gradients use their real skip edge instead of routing through attention", () => {
    const config = { ...defaults("transformer-lab"), rounds: 1 };
    const frame = runAILab("transformer-lab", config).frames.find(
      (f) => f.phase === "backward",
    )!;
    const steps = calculationSteps("transformer-lab", frame, config, {
      key: "parameter",
      row: 0,
      col: 0,
      parameter: "E[0,0]",
      field: "gradient",
    });
    const skip = steps.filter((s) =>
      s.edges.some(([from, to]) => from === "4" && to === "1"),
    );
    expect(skip.length).toBeGreaterThan(0);
    expect(skip.every((s) => !s.edges.flat().includes("3"))).toBe(true);
  });
  for (const id of ["neural-training", "transformer-lab"] as const)
    it(`${id}: every tensor cell finishes at its real value with valid formula references`, () => {
      const config = { ...defaults(id), rounds: 1 },
        trace = runAILab(id, config);
      for (const frame of trace.frames)
        for (const tensor of [
          ...Object.values(frame.data || {}).flat(),
          ...frame.tensors,
        ])
          for (let r = 0; r < tensor.rows.length; r++)
            for (let c = 0; c < tensor.rows[r].length; c++) {
              const steps = calculationSteps(id, frame, config, {
                key: tensor.ref!.key,
                row: r,
                col: c,
              });
              checkSteps(steps);
              const actual = output(steps.at(-1)!);
              if (typeof tensor.rows[r][c] === "number")
                expect(Number(actual), `${tensor.name}[${r},${c}]`).toBeCloseTo(
                  Number(tensor.rows[r][c]),
                  11,
                );
              else expect(actual).toBe(tensor.rows[r][c]);
            }
    });
  it("each neural multiply targets only its input/hidden connection and activation uses the accumulated value", () => {
    const config = defaults("neural-training"),
      frame = runAILab("neural-training", config).frames[1];
    const steps = calculationSteps("neural-training", frame, config, {
      key: "hidden",
      row: 2,
      col: 1,
    });
    const products = steps.filter((s) => s.operation === "mul");
    expect(products).toHaveLength(2);
    expect(products[0].edges).toEqual([["x0", "h1"]]);
    expect(products[1].edges).toEqual([["x1", "h1"]]);
    expect(steps.at(-1)!.operation).toBe("tanh");
    expect(steps.at(-1)!.nodeValues).toMatchObject({ x0: "1", x1: "0" });
  });
  for (const id of ["neural-training", "transformer-lab"] as const)
    it(`${id}: every parameter accumulates its real gradient before learning-rate multiplication and update`, () => {
      const config = { ...defaults(id), rounds: 1 },
        trace = runAILab(id, config),
        frame = trace.frames.at(-1)!;
      const snapshot = JSON.stringify(frame);
      for (const p of frame.updates) {
        const steps = calculationSteps(id, frame, config, {
          key: "parameter",
          row: 0,
          col: 0,
          parameter: p.name,
          field: "gradient",
        });
        checkSteps(steps);
        const accumulations = steps.filter(
          (s) => s.direction === "backward" && s.operation === "add",
        );
        expect(
          accumulations.length ? Number(output(accumulations.at(-1)!)) : 0,
        ).toBeCloseTo(p.gradient, 13);
        expect(steps.at(-2)!.field).toBe("rate");
        expect(steps.at(-1)!.operation).toBe("update");
        expect(output(steps.at(-1)!)).toBe(p.after);
      }
      expect(JSON.stringify(frame)).toBe(snapshot);
      expect(
        calculationSteps(id, trace.frames[0], config, {
          key: "parameter",
          row: 0,
          col: 0,
          parameter: frame.updates[0].name,
        }).some((s) => s.direction === "backward" || s.operation === "update"),
      ).toBe(false);
    }, 30000);
  it("Q micro traces distinguish preview, terminal targets and historical writes", () => {
    const config = defaults("reinforcement-lab"),
      trace = runAILab("reinforcement-lab", config);
    for (let i = 0; i < trace.frames.length; i++) {
      const f = trace.frames[i];
      if (!["target", "update"].includes(f.phase)) continue;
      const t = f.transition!,
        steps = calculationSteps("reinforcement-lab", f, config, {
          key: "q-table",
          row: t.state,
          col: t.action,
        });
      checkSteps(steps);
      expect(output(steps.at(-1)!)).toBe(t.updated);
      expect(steps.at(-1)!.title).toBe(
        f.phase === "update" ? "参数写入回放" : "参数更新预览",
      );
      if (t.done) expect(steps[0].note).toContain("终止");
    }
    const first = trace.frames.findIndex((f) => f.phase === "update"),
      t = trace.frames[first].transition!;
    const history = calculationSteps(
      "reinforcement-lab",
      trace.frames[first + 1],
      config,
      { key: "q-table", row: t.state, col: t.action },
      trace.frames.slice(0, first + 2),
    );
    expect(history.every((s) => s.title.startsWith("历史"))).toBe(true);
  });
});
