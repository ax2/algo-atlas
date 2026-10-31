import { describe, it, expect } from "vitest";
import { problems, referenceCode } from "../src/content/problems";
import * as solve from "../src/content/reference-solvers";
import {
  emptyLearning,
  validateLearning,
  mergeLearning,
} from "../src/services/learning";
describe("verified practice answers", () => {
  for (const p of problems)
    it(p.id + " published example", () => {
      const name = p.id.replace(/-([a-z])/g, (_, x) =>
        x.toUpperCase(),
      ) as keyof typeof solve;
      const fn = solve[name === ("heapTopk" as string) ? "heapTopK" : name] as (
        ...args: never[]
      ) => unknown;
      expect(typeof fn).toBe("function");
      expect(fn(...(p.example.args as never[]))).toEqual(p.example.answer);
      expect(referenceCode(p.id)).toContain("export function");
      expect(p.proof.length).toBeGreaterThan(10);
    });
  it("boundary and independent brute-force oracles", () => {
    for (let seed = 0; seed < 30; seed++) {
      const a = Array.from(
        { length: 12 },
        (_, i) => ((seed * 31 + i * i * 13) % 17) - 8,
      );
      const inv = a.reduce(
        (s, x, i) => s + a.slice(i + 1).filter((y) => y < x).length,
        0,
      );
      expect(solve.inversions(a)).toBe(inv);
      for (let k = 1; k <= a.length; k++) {
        expect(solve.windowMax(a, k)).toEqual(
          a.slice(k - 1).map((_, i) => Math.max(...a.slice(i, i + k))),
        );
        expect(solve.heapTopK(a, k)).toEqual(
          a
            .slice()
            .sort((a, b) => b - a)
            .slice(0, k),
        );
      }
      expect(solve.nextGreater(a)).toEqual(
        a.map((x, i) => a.slice(i + 1).find((v) => v > x) ?? -1),
      );
      const sorted = a.slice().sort((a, b) => a - b);
      for (let target = -9; target <= 9; target++) {
        const at = sorted.findIndex((x) => x >= target);
        expect(solve.lowerBound(sorted, target)).toBe(
          at < 0 ? sorted.length : at,
        );
      }
      const dp = a.map(() => 1);
      for (let i = 0; i < a.length; i++)
        for (let j = 0; j < i; j++)
          if (a[j] < a[i]) dp[i] = Math.max(dp[i], dp[j] + 1);
      expect(solve.lisLength(a)).toBe(Math.max(...dp));
    }
    expect(solve.gridPath([[1]])).toBe(-1);
    expect(solve.gridPath([[0]])).toBe(0);
    expect(
      solve.topoOrder(2, [
        [0, 1],
        [1, 0],
      ]),
    ).toEqual([]);
    expect(solve.mstWeight(3, [[0, 1, 4]])).toBe(-1);
    expect(solve.coinMin([2], 3)).toBe(-1);
    expect(solve.coinMin([2], 0)).toBe(0);
    expect(solve.editDistance("", "abc")).toBe(3);
    expect(solve.editDistance("abc", "abc")).toBe(0);
    expect(solve.kmpMatches("ABABABA", "ABA")).toEqual([0, 2, 4]);
    expect(solve.kmpMatches("ABC", "D")).toEqual([]);
    expect(
      solve.convexArea([
        [0, 0],
        [0, 0],
        [1, 1],
        [2, 2],
      ]),
    ).toBe(0);
    expect(solve.powMod(99, 0, 1)).toBe(0);
    expect(solve.powMod(999999999, 31, 1000000000)).toBe(
      Number(999999999n ** 31n % 1000000000n),
    );
    expect(solve.knnVote([[0], [2]], [3, 1], [1], 2)).toBe(1);
    expect(solve.knapsackValue([[2, 3]], 4)).toBe(3);
  });
  it("practice completion survives backup and rejects unknown IDs", () => {
    const old = emptyLearning();
    expect(validateLearning(old).exerciseCompleted).toEqual([]);
    const next = validateLearning({
      ...old,
      exerciseCompleted: ["inversions"],
    });
    expect(mergeLearning(old, next).exerciseCompleted).toEqual(["inversions"]);
    expect(() =>
      validateLearning({ ...old, exerciseCompleted: ["__proto__"] }),
    ).toThrow();
  });
});
