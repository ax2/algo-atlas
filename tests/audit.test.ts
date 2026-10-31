import { describe, it, expect } from "vitest";
import { topics } from "../src/content/catalog";
import { runTrace } from "../src/engine";
import { neuralGradient } from "../src/engine/ai";
import type { Tree } from "../src/engine/balanced";
describe("every animation frame audit", () => {
  for (const t of topics)
    it(`${t.id}: all frames and both scenarios`, () => {
      for (const input of t.mode === "scenario" ? ["0", "1"] : [t.input]) {
        const trace = runTrace(t.id, input);
        expect(trace.frames.length).toBeGreaterThan(1);
        for (const [i, f] of trace.frames.entries()) {
          const label = `${t.id}/${input}/${i}`;
          expect(f.title, label).toBeTruthy();
          expect(f.detail, label).toBeTruthy();
          expect(f.explanation?.why, label).toBeTruthy();
          const ids = new Set(f.nodes?.map((n) => n.id));
          expect(ids.size, label).toBe(f.nodes?.length || 0);
          for (const e of f.edges || []) {
            expect(ids.has(e.from), label + " edge.from " + e.from).toBe(true);
            expect(ids.has(e.to), label + " edge.to " + e.to).toBe(true);
          }
          for (const n of f.nodes || []) {
            expect(Number.isFinite(n.x) && Number.isFinite(n.y), label).toBe(
              true,
            );
            expect(n.x, label).toBeGreaterThanOrEqual(0);
            expect(n.x, label).toBeLessThanOrEqual(680);
          }
          for (const [r, c] of f.cells || [])
            expect(
              f.matrix?.[r]?.[c],
              label + " matrix cell",
            ).not.toBeUndefined();
          for (const n of [...f.active, ...f.settled]) {
            expect(n, label + " value index").toBeGreaterThanOrEqual(0);
            expect(n, label + " value index").toBeLessThan(f.values.length);
          }
        }
      }
    });
});
describe("balanced tree frames retain the whole tree", () => {
  for (const id of ["avl", "red-black"])
    for (const input of [
      "0",
      "1",
      "30,10,20",
      "10,30,20",
      "50,20,70,10,30,60,80,5,1",
      "1,1,2,2,3",
      "9,8,7,6,5,4,3,2,1",
    ])
      it(`${id}: ${input}`, () => {
        const trace = runTrace(id, input);
        let known = new Set<string>();
        const inorder = (p?: Tree): number[] =>
          p ? [...inorder(p.left), p.value, ...inorder(p.right)] : [];
        const validate = (p: Tree | undefined): [number, number] => {
          if (!p) return [0, 1];
          const [hl, bl] = validate(p.left),
            [hr, br] = validate(p.right);
          if (id === "avl") {
            expect(Math.abs(hl - hr)).toBeLessThanOrEqual(1);
            expect(p.red).not.toBe(true);
          } else {
            expect(bl).toBe(br);
            expect(p.right?.red).not.toBe(true);
            if (p.red) {
              expect(p.left?.red).not.toBe(true);
              expect(p.right?.red).not.toBe(true);
            }
          }
          return [1 + Math.max(hl, hr), bl + (p.red ? 0 : 1)];
        };
        for (const f of trace.frames) {
          const ids = new Set(f.nodes?.map((n) => n.id));
          for (const key of known)
            expect(ids.has(key), f.title + " lost " + key).toBe(true);
          known = ids;
          const order = inorder(f.result as Tree);
          expect(order).toEqual([...order].sort((a, b) => a - b));
          expect(order.map(String).sort()).toEqual([...ids].sort());
          expect(f.edges?.length).toBe(Math.max(0, ids.size - 1));
          if (f.title === "插入后的完整树") validate(f.result as Tree);
        }
      });
});
describe("new algorithms independent oracles", () => {
  it("SCC transpose and linked-list deletion retain correct visual identities", () => {
    const scc = runTrace("scc", "0");
    const before = scc.frames[0].edges!;
    const after = scc.frames.find((f) => f.title === "反转全部有向边")!.edges!;
    expect(after.map((e) => `${e.from}>${e.to}`).sort()).toEqual(
      before.map((e) => `${e.to}>${e.from}`).sort(),
    );
    const list = runTrace("linked-list", "7,7,2,9");
    const inserted = list.frames
        .filter((f) => f.title === "连接尾节点")
        .at(-1)!,
      removed = list.frames.find((f) => f.title === "删除已知前驱后的节点")!;
    expect(removed.nodes!.map((n) => n.id)).toEqual(["0", "2", "3"]);
    expect(removed.nodes!.map((n) => n.label)).toEqual(["7", "2", "9"]);
    expect(inserted.nodes!.find((n) => n.id === "2")!.label).toBe("2");
  });
  for (const variant of ["0", "1"]) {
    it("advanced data structures " + variant, () => {
      const a =
        variant === "1" ? [8, 3, 7, 1, 6, 2, 5, 4] : [5, 2, 8, 1, 7, 3, 6, 4];
      const st = runTrace("sparse-table", variant).result as {
        range: number[];
        value: number;
      };
      expect(st.value).toBe(Math.min(...a.slice(st.range[0], st.range[1] + 1)));
      const lazy = runTrace("lazy-segment", variant).result as {
        updates: number[][];
        value: number;
        total: number;
      };
      const b = a.slice();
      for (const [l, r, d] of lazy.updates)
        for (let i = l; i <= r; i++) b[i] += d;
      expect(lazy.total).toBe(b.reduce((s, v) => s + v, 0));
      expect(lazy.value).toBe(b.slice(2, 7).reduce((s, v) => s + v, 0));
      const p = runTrace("persistent-segment", variant).result as {
        queries: number[];
        changes: number[][];
        roots: { sum: number }[];
      };
      const versions = [a.slice()];
      for (const [i, v] of p.changes) {
        const next = versions.at(-1)!.slice();
        next[i] = v;
        versions.push(next);
      }
      expect(p.queries).toEqual(
        versions.map((v) => v.slice(1, 6).reduce((s, x) => s + x, 0)),
      );
      expect(p.roots.map((r) => r.sum)).toEqual(
        versions.map((v) => v.reduce((s, x) => s + x, 0)),
      );
      const kd = runTrace("kd-tree", variant).result as {
        points: number[][];
        query: number[];
        distanceSquared: number;
      };
      expect(kd.distanceSquared).toBe(
        Math.min(
          ...kd.points.map((p) =>
            p.reduce((s, x, i) => s + (x - kd.query[i]) ** 2, 0),
          ),
        ),
      );
      type T = { v: number; p: number; l?: T; r?: T };
      const order = (p?: T): number[] =>
        p ? [...order(p.l), p.v, ...order(p.r)] : [];
      for (const id of ["treap", "splay"]) {
        const tree = runTrace(id, variant).result as T;
        expect(order(tree)).toEqual([...a].sort((a, b) => a - b));
        if (id === "splay") expect(tree.v).toBe(variant === "1" ? 3 : 2);
        else {
          const heap = (t?: T) => {
            if (!t) return;
            for (const c of [t.l, t.r])
              if (c) {
                expect(t.p).toBeLessThanOrEqual(c.p);
                heap(c);
              }
          };
          heap(tree);
        }
      }
    });
    it("AI numerics " + variant, () => {
      const knn = runTrace("knn", variant).result as {
        query: number[];
        neighbors: { i: number; d: number }[];
        votes: number[];
        prediction: number;
      };
      const points =
        variant === "1"
          ? [
              [1, 7],
              [2, 6],
              [3, 8],
              [7, 2],
              [8, 3],
              [9, 1],
            ]
          : [
              [1, 1],
              [2, 2],
              [2, 1],
              [7, 7],
              [8, 8],
              [8, 6],
            ];
      const ranked = points
        .map(([x, y], i) => ({
          i,
          d: (x - knn.query[0]) ** 2 + (y - knn.query[1]) ** 2,
        }))
        .sort((a, b) => a.d - b.d || a.i - b.i)
        .slice(0, 3);
      expect(knn.neighbors).toEqual(ranked);
      const ones = ranked.filter(({ i }) => i >= 3).length;
      expect(knn.votes).toEqual([3 - ones, ones]);
      expect(knn.prediction).toBe(ones >= 2 ? 1 : 0);
      type Classifier = {
        threshold?: number;
        label?: number;
        left?: Classifier;
        right?: Classifier;
      };
      const cart = runTrace("decision-tree", variant).result as {
        tree: Classifier;
        data: number[][];
      };
      const classify = (t: Classifier, x: number): number =>
        t.label !== undefined
          ? t.label
          : classify(x <= t.threshold! ? t.left! : t.right!, x);
      for (const [x, label] of cart.data)
        expect(classify(cart.tree, x)).toBe(label);
      const validateSplit = (t: Classifier, rows: number[][]) => {
        if (t.label !== undefined) return;
        const impurity = (subset: number[][]) => {
          const n = subset.length,
            ones = subset.filter((r) => r[1] === 1).length;
          return n ? (2 * ones * (n - ones)) / n : 0;
        };
        const score = (threshold: number) =>
          impurity(rows.filter((r) => r[0] <= threshold)) +
          impurity(rows.filter((r) => r[0] > threshold));
        const candidates = rows.slice(1).map((r, i) => (r[0] + rows[i][0]) / 2);
        expect(score(t.threshold!)).toBeCloseTo(
          Math.min(...candidates.map(score)),
        );
        validateSplit(
          t.left!,
          rows.filter((r) => r[0] <= t.threshold!),
        );
        validateSplit(
          t.right!,
          rows.filter((r) => r[0] > t.threshold!),
        );
      };
      validateSplit(cart.tree, cart.data);
      const gd = runTrace("gradient-descent", variant).result as {
        losses: number[];
        w: number;
      };
      expect(gd.w).toBeCloseTo(variant === "1" ? 3 : 2, 1);
      gd.losses
        .slice(1)
        .forEach((l, i) => expect(l).toBeLessThanOrEqual(gd.losses[i] + 1e-10));
      const km = runTrace("kmeans", variant).result as {
        objectives: number[];
        centers: number[][];
        points: number[][];
        labels: number[];
      };
      km.objectives
        .slice(1)
        .forEach((l, i) =>
          expect(l).toBeLessThanOrEqual(km.objectives[i] + 1e-10),
        );
      km.centers.forEach((c, k) => {
        const ps = km.points.filter((_, i) => km.labels[i] === k);
        if (ps.length)
          c.forEach((x, j) =>
            expect(x).toBeCloseTo(ps.reduce((s, p) => s + p[j], 0) / ps.length),
          );
      });
      const bp = runTrace("backprop", variant).result as ReturnType<
        typeof neuralGradient
      > & { w: number; b: number; x: number; y: number; nextLoss: number };
      const eps = 1e-5;
      expect(bp.dw).toBeCloseTo(
        (neuralGradient(bp.w + eps, bp.b, bp.x, bp.y).loss -
          neuralGradient(bp.w - eps, bp.b, bp.x, bp.y).loss) /
          (2 * eps),
        7,
      );
      expect(bp.db).toBeCloseTo(
        (neuralGradient(bp.w, bp.b + eps, bp.x, bp.y).loss -
          neuralGradient(bp.w, bp.b - eps, bp.x, bp.y).loss) /
          (2 * eps),
        7,
      );
      expect(bp.nextLoss).toBeLessThan(bp.loss);
      const at = runTrace("attention", variant).result as {
        weights: number[][];
        output: number[][];
        V: number[][];
      };
      at.weights.forEach((r, i) => {
        expect(r.reduce((s, v) => s + v, 0)).toBeCloseTo(1);
        r.forEach((x) => expect(x).toBeGreaterThanOrEqual(0));
        at.output[i].forEach((v, j) =>
          expect(v).toBeCloseTo(r.reduce((s, w, k) => s + w * at.V[k][j], 0)),
        );
      });
      const mm = runTrace("minimax", variant).result as {
        leaves: number[];
        value: number;
        visited: number[];
        pruned: number[];
      };
      const brute = (a: number[], max: boolean): number =>
        a.length === 1
          ? a[0]
          : (max ? Math.max : Math.min)(
              brute(a.slice(0, a.length / 2), !max),
              brute(a.slice(a.length / 2), !max),
            );
      expect(mm.value).toBe(brute(mm.leaves, true));
      for (const n of mm.pruned) expect(mm.visited).not.toContain(n);
      const pc = runTrace("perceptron", variant).result as {
        converged: boolean;
        w: number[];
        b: number;
        samples: number[][];
      };
      expect(pc.converged).toBe(variant === "0");
      if (pc.converged)
        pc.samples.forEach(([x, y, c]) =>
          expect(c * (pc.w[0] * x + pc.w[1] * y + pc.b)).toBeGreaterThan(0),
        );
    });
  }
});
