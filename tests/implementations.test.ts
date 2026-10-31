import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { spawnSync } from "node:child_process";
import { implementations } from "../src/content/implementations";
import { topics } from "../src/content/catalog";

function run(id: string, args: unknown[]) {
  return JSON.parse(
    JSON.stringify(
      runInNewContext(
        `${implementations[id].javascript}\nsolve(...args)`,
        { args: structuredClone(args) },
        { timeout: 2000 },
      ),
    ),
  );
}
describe("independently runnable lesson implementations", () => {
  it("covers exactly the complete catalog in two languages", () => {
    expect(Object.keys(implementations).sort()).toEqual(
      topics.map((t) => t.id).sort(),
    );
  });
  for (const lesson of Object.values(implementations))
    it(`${lesson.id}: JavaScript examples`, () => {
      for (const example of lesson.examples)
        expect(run(lesson.id, example.args)).toEqual(example.answer);
    });
  it("executes every Python example in fresh namespaces and matches the published answers", () => {
    const cases = Object.values(implementations).flatMap((p) =>
      p.examples.map((e) => ({ id: p.id, code: p.python, ...e })),
    );
    const script = `import sys,json\ncases=json.load(sys.stdin)\nout=[]\nfor case in cases:\n scope={}\n exec(case['code'],scope)\n out.append({'id':case['id'],'value':scope['solve'](*case['args'])})\nprint(json.dumps(out,allow_nan=False))`;
    const result = spawnSync(
      process.platform === "win32" ? "python" : "python3",
      ["-X", "utf8", "-c", script],
      { input: JSON.stringify(cases), encoding: "utf8", timeout: 30000 },
    );
    expect(result.status, result.stderr || result.error?.message).toBe(0);
    const output = JSON.parse(result.stdout);
    output.forEach((item: { id: string; value: unknown }, i: number) =>
      expect(item.value, item.id).toEqual(cases[i].answer),
    );
  });
  it("checks all four AVL rotations and red-black invariants after every insertion prefix", () => {
    const sequences = [
      [3, 2, 1],
      [1, 2, 3],
      [3, 1, 2],
      [1, 3, 2],
      [8, 2, 6, 1, 7, 3, 9, 4, 5, 0, 6],
    ];
    for (const id of ["avl", "red-black"])
      for (const seq of sequences)
        for (let n = 0; n <= seq.length; n++) {
          const tree = run(id, [seq.slice(0, n)]),
            keys: number[] = [];
          function visit(node: any, lo = -Infinity, hi = Infinity): number {
            if (!node) return 0;
            const [key, left, right, mark] = node;
            expect(key).toBeGreaterThan(lo);
            expect(key).toBeLessThan(hi);
            const a = visit(left, lo, key);
            keys.push(key);
            const b = visit(right, key, hi);
            if (id === "avl") {
              expect(Math.abs(a - b)).toBeLessThanOrEqual(1);
              expect(mark).toBe(1 + Math.max(a, b));
              return mark;
            }
            expect(a).toBe(b);
            expect(right?.[3]).not.toBe("R");
            if (mark === "R") {
              expect(left?.[3]).not.toBe("R");
              expect(right?.[3]).not.toBe("R");
            }
            return a + Number(mark === "B");
          }
          if (id === "red-black" && tree) expect(tree[3]).toBe("B");
          visit(tree);
          expect(keys).toEqual(
            [...new Set(seq.slice(0, n))].sort((a, b) => a - b),
          );
        }
  });
});
