import { describe, it, expect } from "vitest";
import { topics } from "../src/content/catalog";
import { runTrace } from "../src/engine";
import { graphScenario } from "../src/engine/graphs";
import {
  emptyLearning,
  validateLearning,
  mergeLearning,
} from "../src/services/learning";
describe("catalog and trace contract", () => {
  it("all entries have complete original learning material and finite trace", () => {
    expect(new Set(topics.map((t) => t.id)).size).toBe(topics.length);
    for (const t of topics) {
      for (const key of [
        "intro",
        "history",
        "use",
        "invariant",
        "caveat",
        "analysis",
        "analogy",
        "source",
        "best",
        "average",
        "worst",
        "space",
      ] as const)
        expect(t[key], `${t.id}.${key}`).toBeTruthy();
      expect(t.level).toBeGreaterThanOrEqual(0);
      expect(t.level).toBeLessThanOrEqual(3);
      const trace = runTrace(t.id, t.input);
      expect(trace.frames.length, t.id).toBeGreaterThan(1);
      expect(trace.result, t.id).not.toBeUndefined();
      expect(trace.frames.length).toBeLessThan(5000);
      if (t.mode === "scenario")
        expect(runTrace(t.id, "1").frames.length).toBeGreaterThan(1);
    }
  });
  it("snapshot frames cannot mutate previous state", () => {
    const trace = runTrace("bubble", "3,2,1");
    const before = structuredClone(trace.frames[0]);
    trace.frames.at(-1)!.values[0] = 99;
    expect(trace.frames[0]).toEqual(before);
  });
  it("rejects malformed or excessive input", () => {
    for (const value of [
      "",
      "1",
      "1,-1",
      "1,NaN",
      "1,Infinity",
      "1,2.5",
      "1,100",
      Array(17).fill(2).join(","),
    ])
      expect(() => runTrace("quick", value)).toThrow();
    expect(() => runTrace("kmp", "x|")).toThrow();
    expect(() => runTrace("sieve", "1000000")).toThrow();
    expect(() => runTrace("gcd", "0,5")).toThrow();
    expect(() => runTrace("fast-power", "1,99")).toThrow();
  });
});
describe("sorting properties", () => {
  let seed = 12345;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed % 100;
  };
  const samples = [
    [0, 0],
    [2, 1],
    [9, 9, 1, 9, 1],
    [1, 2, 3, 4, 5],
    [5, 4, 3, 2, 1],
    ...Array.from({ length: 35 }, () =>
      Array.from({ length: 2 + (random() % 15) }, random),
    ),
  ];
  for (const id of [
    "bubble",
    "selection",
    "insertion",
    "quick",
    "merge",
    "heap-sort",
    "counting",
    "radix",
    "shell",
  ])
    it(`${id} sorts and preserves the multiset`, () => {
      for (const a of samples)
        expect(runTrace(id, a.join(",")).result).toEqual(
          [...a].sort((a, b) => a - b),
        );
    });
  it("quickselect selects lower median without needing total order", () => {
    for (const a of samples)
      expect(runTrace("quickselect", a.join(",")).result).toBe(
        [...a].sort((a, b) => a - b)[Math.floor((a.length - 1) / 2)],
      );
  });
  for (const id of ["binary-search", "linear-search"])
    it(`${id} handles hits, duplicates and misses`, () => {
      for (const t of [0, 1, 4, 9, 99]) {
        const a = [9, 1, 4, 4, 2],
          r = runTrace(id, a.join(","), t).result as number,
          source = id === "binary-search" ? [...a].sort((a, b) => a - b) : a;
        if (a.includes(t)) expect(source[r]).toBe(t);
        else expect(r).toBe(-1);
      }
    });
});
describe("graph consistency", () => {
  for (const scenario of [0, 1])
    it(`shortest paths and MST agree across independent algorithms, scenario ${scenario}`, () => {
      const d = runTrace("dijkstra", String(scenario)).result;
      const bf = runTrace("bellman-ford", "0").result as {
        distances: number[];
      };
      if (!scenario) expect(d).toEqual(bf.distances);
      const fw = runTrace("floyd", String(scenario)).result as number[][];
      expect(d).toEqual(fw[0]);
      expect(runTrace("astar", String(scenario)).result).toEqual(d);
      const k = runTrace("kruskal", String(scenario)).result as {
          weight: number;
          edges: unknown[];
        },
        p = runTrace("prim", String(scenario)).result as { weight: number };
      expect(k.weight).toBe(p.weight);
      expect(k.edges).toHaveLength(5);
    });
  it("BFS and DFS visit each reachable vertex once", () => {
    for (const id of ["bfs", "dfs"]) {
      const v = runTrace(id, "0").result as number[];
      expect(new Set(v).size).toBe(6);
      expect(v).toHaveLength(6);
      expect(v[0]).toBe(0);
    }
  });
  it("topological order respects each edge and identifies cyclic scenario", () => {
    const r = runTrace("topological", "0").result as {
      order: number[];
      cycle: boolean;
    };
    for (const [u, v] of graphScenario("topological", 0).links)
      expect(r.order.indexOf(u)).toBeLessThan(r.order.indexOf(v));
    expect(r.cycle).toBe(false);
    expect(
      (runTrace("topological", "1").result as { cycle: boolean }).cycle,
    ).toBe(true);
  });
  it("maximum flow equals brute force minimum cut", () => {
    for (const variant of [0, 1]) {
      const { links } = graphScenario("max-flow", variant);
      let min = Infinity;
      for (let mask = 1; mask < 64; mask += 2) {
        if (mask & 32) continue;
        const cap = links.reduce(
          (s, [u, v, w]) => s + (mask & (1 << u) && !(mask & (1 << v)) ? w : 0),
          0,
        );
        min = Math.min(min, cap);
      }
      expect(runTrace("max-flow", String(variant)).result).toBe(min);
    }
  });
  it("SCC partitions the graph into expected groups", () => {
    const r = runTrace("scc", "0").result as number[][];
    expect(r.map((c) => c.sort().join(",")).sort()).toEqual([
      "0,1,2",
      "3,4",
      "5",
    ]);
  });
});
describe("dynamic programming and numeric oracles", () => {
  it("known DP examples", () => {
    expect(runTrace("lcs", "ABCBDAB|BDCABA").result).toBe(4);
    expect(runTrace("edit-distance", "kitten|sitting").result).toBe(3);
    expect(runTrace("knapsack", "0").result).toBe(11);
    expect(runTrace("coin-change", "6").result).toBe(2);
    expect(runTrace("fibonacci", "20").result).toBe(6765);
    expect(runTrace("lis", "10,9,2,5,3,7,18").result).toBe(4);
    expect(runTrace("sliding-window", "1,2,3,4,5").result).toBe(12);
    expect(runTrace("monotonic-stack", "2,1,4,3").result).toEqual([
      4, 4, -1, -1,
    ]);
  });
  it("4 queens solutions satisfy all constraints", () => {
    const s = runTrace("backtracking", "0").result as number[][];
    expect(s).toHaveLength(2);
    for (const q of s)
      for (let i = 0; i < 4; i++)
        for (let j = i + 1; j < 4; j++) {
          expect(q[i]).not.toBe(q[j]);
          expect(Math.abs(q[i] - q[j])).not.toBe(j - i);
        }
  });
  it("math matches independent results", () => {
    expect(runTrace("gcd", "48,18").result).toBe(6);
    for (const e of [1, 2, 13, 30])
      expect(runTrace("fast-power", `3,${e}`).result).toBe(
        Number(3n ** BigInt(e) % 1009n),
      );
    expect(runTrace("sieve", "30").result).toEqual([
      2, 3, 5, 7, 11, 13, 17, 19, 23, 29,
    ]);
    expect(runTrace("bitmask", "1,2,3").result).toHaveLength(8);
  });
});
describe("string algorithms cross check", () => {
  for (const pair of [
    "ABABABCABAB|ABABC",
    "AAAAAA|AAA",
    "abc|abcdef",
    "abracadabra|abra",
    "abc|z",
    "a|a",
  ])
    it(pair, () => {
      const [text, pattern] = pair.split("|");
      const expected = Array.from({ length: text.length }, (_, i) => i).filter(
        (i) => text.startsWith(pattern, i),
      );
      for (const id of ["naive-match", "kmp", "rabin-karp", "z-function"])
        expect(runTrace(id, pair).result, id).toEqual(expected);
    });
  it("suffix ordering and prefix-free code", () => {
    expect(runTrace("suffix-array", "banana").result).toEqual([
      5, 3, 1, 0, 4, 2,
    ]);
    for (const text of ["abracadabra", "aaaa", "abcdef"]) {
      const codes = runTrace("huffman", text).result as Record<string, string>;
      const values = Object.values(codes);
      for (let i = 0; i < values.length; i++)
        for (let j = 0; j < values.length; j++)
          if (i !== j) expect(values[i].startsWith(values[j])).toBe(false);
      expect(Object.keys(codes).sort()).toEqual([...new Set(text)].sort());
    }
  });
});
describe("structure invariants", () => {
  type T = {
    value: number;
    left?: T;
    right?: T;
    height: number;
    red?: boolean;
  };
  const inorder = (t: T | undefined): number[] =>
    t ? [...inorder(t.left), t.value, ...inorder(t.right)] : [];
  it("AVL / red-black maintain order and balancing for both scenarios", () => {
    for (const scenario of ["0", "1"])
      for (const id of ["avl", "red-black"]) {
        const root = runTrace(id, scenario).result as T;
        const values = inorder(root);
        expect(values).toEqual([...values].sort((a, b) => a - b));
        if (id === "avl") {
          const check = (n: T | undefined): number => {
            if (!n) return 0;
            const l = check(n.left),
              r = check(n.right);
            expect(Math.abs(l - r)).toBeLessThanOrEqual(1);
            return 1 + Math.max(l, r);
          };
          check(root);
        } else {
          expect(root.red).toBe(false);
          const check = (n: T | undefined): number => {
            if (!n) return 1;
            if (n.red) {
              expect(n.left?.red || false).toBe(false);
              expect(n.right?.red || false).toBe(false);
            }
            const l = check(n.left),
              r = check(n.right);
            expect(l).toBe(r);
            return l + (n.red ? 0 : 1);
          };
          check(root);
        }
      }
  });
  it("B-tree occupancy and equal leaf depth", () => {
    type B = { keys: number[]; children: B[] };
    for (const scenario of ["0", "1"]) {
      const root = runTrace("b-tree", scenario).result as B,
        depths: number[] = [],
        keys: number[] = [];
      const check = (n: B, d: number) => {
        expect(n.keys.length).toBeGreaterThan(0);
        expect(n.keys.length).toBeLessThanOrEqual(3);
        keys.push(...n.keys);
        if (!n.children.length) depths.push(d);
        else {
          expect(n.children.length).toBe(n.keys.length + 1);
          n.children.forEach((c) => check(c, d + 1));
        }
      };
      check(root, 0);
      expect(new Set(depths).size).toBe(1);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
  it("heap parent order, sums and LRU recency", () => {
    const a = [7, 2, 9, 4, 3, 8, 1, 6, 5, 10];
    const h = runTrace("heap", a.join(",")).result as number[];
    h.slice(1).forEach((v, i) =>
      expect(h[Math.floor(i / 2)]).toBeLessThanOrEqual(v),
    );
    for (const id of ["fenwick", "segment-tree"])
      expect(runTrace(id, a.join(",")).result).toBe(55);
    expect(runTrace("lru", "1,2,1,3,4,5").result).toEqual([5, 4, 3, 1]);
  });
});
describe("learning backup validation", () => {
  it("round-trips and merges without erasing conflicting notes", () => {
    const a = {
        ...emptyLearning(),
        favorites: ["quick"],
        notes: { quick: "first" },
      },
      b = {
        ...emptyLearning(),
        favorites: ["bfs"],
        notes: { quick: "second" },
      };
    expect(validateLearning(JSON.parse(JSON.stringify(a))).notes.quick).toBe(
      "first",
    );
    const merged = mergeLearning(a, b);
    expect(merged.favorites).toEqual(["quick", "bfs"]);
    expect(merged.notes.quick).toContain("first");
    expect(merged.notes.quick).toContain("second");
  });
  it("rejects prototype keys, unknown schema, unknown lessons and oversized notes", () => {
    for (const v of [
      { ...emptyLearning(), version: 2 },
      { ...emptyLearning(), favorites: ["__proto__"] },
      { ...emptyLearning(), notes: JSON.parse('{"__proto__":"attack"}') },
      { ...emptyLearning(), notes: { quick: "x".repeat(20001) } },
    ])
      expect(() => validateLearning(v)).toThrow();
  });
});
