import { describe, it, expect } from "vitest";
import { calculateValue, selectCell } from "../src/engine/ai-calculation";
import { defaults, runAILab, type LabId } from "../src/engine/ai-labs";
import { linkedData } from "../src/engine/ai-links";
import { neuralModel, transformerModel } from "../src/engine/ai-models";

describe("reverse AI calculation provenance", () => {
  it("an unchanged Q cell can explain its last actual write without impersonating the current update", () => {
    const config = defaults("reinforcement-lab"),
      trace = runAILab("reinforcement-lab", config);
    const first = trace.frames.findIndex((f) => f.phase === "update"),
      old = trace.frames[first].transition!,
      later = trace.frames[first + 1];
    const result = calculateValue(
      "reinforcement-lab",
      later,
      config,
      { key: "q-table", row: old.state, col: old.action },
      trace.frames.slice(0, first + 2),
    );
    expect(result.value).toBe(old.updated);
    expect(result.update).toBeUndefined();
    expect(result.blocks.some((b) => b.title === "历史更新等式")).toBe(true);
  });
  for (const id of [
    "neural-training",
    "transformer-lab",
    "reinforcement-lab",
  ] as LabId[]) {
    it(`${id}: every available tensor cell resolves a diagram and calculation`, () => {
      const config = { ...defaults(id), rounds: 1 },
        trace = runAILab(id, config);
      for (const f of trace.frames)
        for (const t of [...Object.values(f.data || {}).flat(), ...f.tensors]) {
          expect(t.ref, t.name).toBeDefined();
          for (let r = 0; r < t.rows.length; r++)
            for (let c = 0; c < t.rows[r].length; c++) {
              const result = calculateValue(id, f, config, selectCell(t, r, c));
              expect(result.value, `${t.name}[${r},${c}]`).toBe(t.rows[r][c]);
              expect(result.nodes.length, t.name).toBeGreaterThan(0);
              expect(result.blocks.length, t.name).toBeGreaterThan(1);
              expect(
                result.nodes.every((n) =>
                  f.diagram.nodes?.some((v) => v.id === n),
                ),
              ).toBe(true);
            }
        }
    });
  }
  it("linked slices preserve original sample, neuron and Q state coordinates", () => {
    const config = defaults("neural-training"),
      f = runAILab("neural-training", config).frames[1];
    const t = linkedData("neural-training", f, { kind: "node", id: "h2" })
      .tensors[0];
    const s = selectCell(t, 2, 0);
    expect(s).toMatchObject({ key: "hidden", row: 2, col: 2 });
    const result = calculateValue("neural-training", f, config, s);
    expect(result.nodes).toEqual(["x0", "x1", "h2"]);
    expect(result.value).toBe(neuralModel().hidden[2][2]);
    expect(result.sample).toBe(2);
    expect(result.nodeValues).toMatchObject({ x0: "1.0000", x1: "0.0000" });
    expect(result.nodeValues?.p).toBeUndefined();
    const qconfig = defaults("reinforcement-lab"),
      qf = runAILab("reinforcement-lab", qconfig).frames.find(
        (f) => f.phase === "update" && f.transition!.state >= 8,
      )!;
    const qt = linkedData("reinforcement-lab", qf, {
      kind: "node",
      id: String(qf.transition!.state),
    }).tensors[0];
    expect(selectCell(qt, 0, qf.transition!.action)).toMatchObject({
      row: qf.transition!.state,
      col: qf.transition!.action,
    });
  });
  for (const id of ["neural-training", "transformer-lab"] as const) {
    it(`${id}: every parameter's real local contributions sum to its stored gradient`, () => {
      const config = { ...defaults(id), rounds: 1 },
        f = runAILab(id, config).frames.find((f) => f.phase === "update")!;
      for (const p of f.updates) {
        const result = calculateValue(id, f, config, {
          key: "parameter",
          row: 0,
          col: 0,
          parameter: p.name,
          field: "gradient",
        });
        expect(result.value).toBe(p.gradient);
        expect(result.update!.after).toBeCloseTo(
          p.before - config.rate * p.gradient,
          14,
        );
        const terms = result.blocks.find(
          (b) => b.title === "本轮反传贡献",
        )!.rows!;
        expect(
          Math.abs(terms.reduce((s, r) => s + Number(r[2]), 0) - p.gradient),
        ).toBeLessThanOrEqual(Math.max(1, terms.length) * 0.000051);
      }
    });
  }
  it("forward phases never compute future gradients and masked attention has an explicit zero explanation", () => {
    const config = defaults("transformer-lab"),
      trace = runAILab("transformer-lab", { ...config, rounds: 1 });
    const pending = calculateValue("transformer-lab", trace.frames[0], config, {
      key: "parameter",
      row: 0,
      col: 0,
      parameter: "WQ[0,0]",
      field: "gradient",
    });
    expect(pending.value).toBe("待计算");
    expect(pending.blocks.some((b) => b.title === "本轮反传贡献")).toBe(false);
    const f = trace.frames.find((f) => f.phase === "mask")!;
    const result = calculateValue("transformer-lab", f, config, {
      key: "attention-1",
      row: 0,
      col: 2,
    });
    expect(result.value).toBe(0);
    expect(JSON.stringify(result.blocks)).toContain("不参与归一化分母");
    expect(transformerModel().weights[1][0][2]).toBe(0);
  });
});
