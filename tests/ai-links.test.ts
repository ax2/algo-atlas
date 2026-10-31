import { describe, it, expect } from "vitest";
import { defaults, runAILab, actions, type LabId } from "../src/engine/ai-labs";
import { linkedData } from "../src/engine/ai-links";
import { neuralModel, transformerModel } from "../src/engine/ai-models";

const trace = (id: LabId) => runAILab(id, { ...defaults(id), rounds: 2 });
describe("AI diagram bindings and update snapshots", () => {
  it("a neural edge selects its exact weight in both propagation directions", () => {
    const frames = trace("neural-training").frames;
    for (const phase of ["input", "backward", "update"]) {
      const f = frames.find((f) => f.phase === phase)!;
      const data = linkedData("neural-training", f, {
        kind: "edge",
        from: phase === "backward" ? "h1" : "x0",
        to: phase === "backward" ? "x0" : "h1",
      });
      expect(data.parameters).toEqual(["W1[0,1]"]);
      const p = f.updates.find((p) => p.name === "W1[0,1]")!;
      expect(data.tensors[0].rows).toEqual([
        [p.before, phase === "input" ? "待计算" : p.gradient, p.after],
      ]);
      expect(data.tensors[0].changed).toEqual(
        phase === "update" && p.before !== p.after ? [[0, 2]] : [],
      );
    }
  });
  it("a hidden neuron includes its incoming weights, bias and outgoing weight", () => {
    const f = trace("neural-training").frames.find(
      (f) => f.phase === "backward",
    )!;
    const data = linkedData("neural-training", f, { kind: "node", id: "h0" });
    expect(data.parameters.sort()).toEqual(
      ["W1[0,0]", "W1[1,0]", "W2[0,0]", "b1[0,0]"].sort(),
    );
    expect(data.tensors[0].rows).toEqual(
      neuralModel().hidden.map((r) => [r[0]]),
    );
    expect(
      linkedData("neural-training", f, { kind: "node", id: "p" }).tensors[0]
        .rows,
    ).toEqual(neuralModel().predictions.map((v) => [v]));
    expect(
      linkedData("neural-training", f, { kind: "node", id: "p" }).parameters,
    ).toEqual([]);
  });
  for (const id of ["neural-training", "transformer-lab"] as const) {
    it(`${id}: no future activations or gradients leak; update activations are recomputed`, () => {
      const frames = trace(id).frames,
        first = frames[0],
        update = frames.find((f) => f.phase === "update")!;
      expect(Object.keys(first.data!)).toEqual(["input"]);
      const pending = linkedData(id, first, {
        kind: "node",
        id: id === "neural-training" ? "h0" : "2",
      });
      expect(pending.tensors[0].rows.flat()).toContain("尚未到达此计算阶段");
      expect(pending.tensors.at(-1)!.rows.every((r) => r[1] === "待计算")).toBe(
        true,
      );
      const after = Object.fromEntries(
        update.updates.map((p) => [p.name, p.after]),
      );
      const expected =
        id === "neural-training"
          ? neuralModel(0, after)
          : transformerModel(0, after);
      const actual =
        update.data![id === "neural-training" ? "forward" : "qkv"][0];
      expect(actual.rows).toEqual(
        "hidden" in expected ? expected.hidden : expected.q,
      );
      const original =
        id === "neural-training" ? neuralModel() : transformerModel();
      expect(actual.beforeRows).toEqual(
        "hidden" in original ? original.hidden : original.q,
      );
      const changed = actual.rows.flatMap((row, r) =>
        row.flatMap((v, c) => (v !== actual.beforeRows![r][c] ? [[r, c]] : [])),
      );
      expect(actual.changed).toEqual(changed);
      expect(first.data!.input[0].beforeRows).toBeUndefined();
    });
  }
  it("Transformer projections and attention are not confused with independent trainable attention weights", () => {
    const f = trace("transformer-lab").frames.find(
      (f) => f.phase === "backward",
    )!;
    const qkv = linkedData("transformer-lab", f, { kind: "node", id: "2" });
    expect(qkv.tensors.slice(0, 3).map((t) => t.name)).toEqual([
      "Q · 3×4",
      "K · 3×4",
      "V · 3×4",
    ]);
    expect(new Set(qkv.parameters.map((n) => n.split("[")[0]))).toEqual(
      new Set(["WQ", "WK", "WV"]),
    );
    const attn = linkedData("transformer-lab", f, {
      kind: "edge",
      from: "3",
      to: "2",
    });
    expect(attn.note).toContain("概率是激活");
    expect(attn.parameters).toEqual(qkv.parameters);
  });
  it("Q marks exactly the written state-action, preserves the old value, and treats target as preview", () => {
    const frames = trace("reinforcement-lab").frames;
    for (const f of frames.filter((f) =>
      ["target", "update"].includes(f.phase),
    )) {
      const tr = f.transition!,
        written = f.phase === "update";
      expect(f.tensors[0].focus).toEqual([tr.state, tr.action]);
      expect(f.tensors[0].changed).toEqual(
        written && tr.old !== tr.updated ? [[tr.state, tr.action]] : [],
      );
      const data = linkedData("reinforcement-lab", f, {
        kind: "node",
        id: String(tr.state),
      });
      expect(data.parameters[tr.action]).toBe(
        `Q[${tr.state},${actions[tr.action]}]`,
      );
      expect(data.tensors[0].rows[0][tr.action]).toBe(
        written ? tr.updated : tr.old,
      );
      expect(data.tensors[1].rows[tr.action]).toEqual([
        tr.old,
        tr.old - tr.target,
        tr.updated,
      ]);
      if (written)
        expect(data.tensors[0].beforeRows![0][tr.action]).toBe(tr.old);
      const other = linkedData("reinforcement-lab", f, {
        kind: "node",
        id: String((tr.state + 1) % 12),
      });
      expect(other.tensors.every((t) => !t.changed?.length)).toBe(true);
    }
  });
});
