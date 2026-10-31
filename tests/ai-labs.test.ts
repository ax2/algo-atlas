import { describe, it, expect } from "vitest";
import { neuralModel, transformerModel } from "../src/engine/ai-models";
import { defaults, runAILab, gridStep } from "../src/engine/ai-labs";
import type { LabId } from "../src/engine/ai-labs";
import { aiLabs } from "../src/content/ai-labs";
import { problemById } from "../src/content/problems";
import { Scalar } from "../src/engine/autodiff";
import {
  qUpdate,
  discountedReturn,
  causalSoftmax,
  epsilonPolicy,
  batchGradient,
  chainGradient,
  sgdVector,
} from "../src/content/reference-solvers";

describe("AI lab numerics independently verified", () => {
  it("shared paths accumulate, repeated backward clears old gradients", () => {
    const x = new Scalar(3),
      y = x.mul(x).add(x.mul(2));
    y.backward();
    expect(x.grad).toBe(8);
    y.backward();
    expect(x.grad).toBe(8);
  });
  for (const variant of [0, 1]) {
    for (const [name, build] of [
      ["MLP", neuralModel],
      ["Transformer", transformerModel],
    ] as const) {
      it(`${name} variant ${variant}: every parameter gradient matches finite differences`, () => {
        const model = build(variant);
        model.loss.backward();
        expect(model.params.length).toBe(name === "MLP" ? 13 : 158);
        const eps = 1e-5;
        for (const p of model.params) {
          const a = build(variant, { [p.name]: p.node.value + eps }).loss.value;
          const b = build(variant, { [p.name]: p.node.value - eps }).loss.value;
          expect(p.node.grad, p.name).toBeCloseTo((a - b) / (2 * eps), 5);
        }
      });
    }
    it(`Transformer ${variant}: normalized heads, causal independence, residual arithmetic`, () => {
      const m = transformerModel(variant),
        altered = transformerModel(variant, {}, [...m.tokens.slice(0, 2), 3]);
      expect(altered.probabilities.slice(0, 2)).toEqual(
        m.probabilities.slice(0, 2),
      );
      for (const head of m.weights)
        head.forEach((row, i) => {
          expect(row.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12);
          row.forEach((p, j) => {
            expect(p).toBeGreaterThanOrEqual(0);
            if (j > i) expect(p).toBe(0);
          });
        });
      m.probabilities.forEach((row) =>
        expect(row.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12),
      );
      for (let i = 0; i < 3; i++)
        for (let d = 0; d < 4; d++) {
          expect(m.output[i][d]).toBeCloseTo(m.residual[i][d] + m.feed[i][d]);
          const head = Math.floor(d / 2);
          expect(m.concat[i][d]).toBeCloseTo(
            m.weights[head][i].reduce((s, a, j) => s + a * m.v[j][d], 0),
          );
        }
      m.loss.backward();
      expect(
        m.params
          .filter((p) => p.name.startsWith("E[3,"))
          .every((p) => p.node.grad === 0),
      ).toBe(true);
    });
  }
  for (const id of Object.keys(aiLabs) as LabId[]) {
    it(`${id}: deterministic complete finite snapshots and scoped updates`, () => {
      const config = { ...defaults(id), rounds: 3 },
        trace = runAILab(id, config);
      expect(trace).toEqual(runAILab(id, config));
      for (const f of trace.frames) {
        const ids = new Set(f.diagram.nodes!.map((n) => n.id));
        expect(ids.size).toBe(f.diagram.nodes!.length);
        f.diagram.edges!.forEach((e) => {
          expect(ids.has(e.from)).toBe(true);
          expect(ids.has(e.to)).toBe(true);
        });
        expect(f.why.length).toBeGreaterThan(12);
        expect(f.check.length).toBeGreaterThan(12);
        for (const t of f.tensors)
          for (const r of t.rows)
            for (const v of r)
              if (typeof v === "number") expect(Number.isFinite(v)).toBe(true);
        for (const p of f.updates) {
          expect(Number.isFinite(p.gradient)).toBe(true);
          expect(p.after).toBeCloseTo(p.before - config.rate * p.gradient, 10);
        }
      }
      if (id !== "reinforcement-lab") {
        if (id === "transformer-lab")
          for (const frame of trace.frames.filter(
            (f) => f.phase === "backward",
          )) {
            expect(
              frame.diagram.edges!.some((e) => e.from === "7" || e.to === "0"),
            ).toBe(false);
          }
        const updates = trace.frames.filter((f) => f.phase === "update");
        expect(updates.at(-1)!.history.at(-1)!).toBeLessThan(
          updates[0].history[0],
        );
        for (let i = 1; i < updates.length; i++)
          updates[i].updates.forEach((p, j) =>
            expect(p.before).toBe(updates[i - 1].updates[j].after),
          );
      }
      aiLabs[id].exercises.forEach((p) =>
        expect(problemById[p].caseId).toBe(id),
      );
    });
  }
  for (const epsilon of [0, 0.8])
    for (const gamma of [0, 0.9]) {
      it(`Q-learning ε=${epsilon}, γ=${gamma}: each transition agrees with environment and Bellman target`, () => {
        const c = {
            ...defaults("reinforcement-lab"),
            epsilon,
            gamma,
            rounds: 8,
          },
          trace = runAILab("reinforcement-lab", c);
        const updates = trace.frames.filter((f) => f.phase === "update");
        const q = Array.from({ length: 12 }, () => [0, 0, 0, 0]);
        for (const f of updates) {
          const t = f.transition!,
            actual = gridStep(t.state, t.action, c.variant);
          expect(t.next).toBe(actual.next);
          expect(t.reward).toBe(actual.reward);
          expect(t.done).toBe(actual.done);
          const target =
            actual.reward +
            (actual.done ? 0 : gamma * Math.max(...q[actual.next]));
          expect(t.target).toBeCloseTo(target, 12);
          q[t.state][t.action] += c.rate * (target - q[t.state][t.action]);
          expect(f.tensors[0].rows).toEqual(q);
          expect(q[7]).toEqual([0, 0, 0, 0]);
          expect(q[11]).toEqual([0, 0, 0, 0]);
        }
        expect(updates.some((f) => f.transition!.done)).toBe(true);
      });
    }
  it("AI exercise boundaries and gradient oracle", () => {
    expect(qUpdate(0.4, 1, 999, 0.9, 0.5, true)).toBe(0.7);
    expect(discountedReturn([], 0.9)).toBe(0);
    expect(discountedReturn([1, 2, 3], 0)).toBe(1);
    expect(discountedReturn([1, 2, 3], 1)).toBe(6);
    expect(epsilonPolicy([1, 3, 2], 0)).toEqual([0, 1, 0]);
    expect(epsilonPolicy([1, 3], 1)).toEqual([0.5, 0.5]);
    expect(
      causalSoftmax([
        [1000, 1000],
        [-1000, -1000],
      ]),
    ).toEqual([
      [1, 0],
      [0.5, 0.5],
    ]);
    const x = [1, 2, -1],
      y = [0, 3, 2],
      w = 0.3,
      eps = 1e-4;
    const loss = (w: number) =>
      x.reduce((s, v, i) => s + (w * v - y[i]) ** 2, 0) / (2 * x.length);
    expect(batchGradient(x, y, w)).toBeCloseTo(
      (loss(w + eps) - loss(w - eps)) / (2 * eps),
      5,
    );
    expect(chainGradient(2, 0.2, -0.1, 3)).toBeCloseTo(
      (3 *
        (Math.tanh((0.2 + eps) * 2 - 0.1) - Math.tanh((0.2 - eps) * 2 - 0.1))) /
        (2 * eps),
      5,
    );
    const original = [1, 2];
    sgdVector(original, [1, -1], 0.1);
    expect(original).toEqual([1, 2]);
  });
});
