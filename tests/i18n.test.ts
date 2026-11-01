import { afterEach, expect, it } from "vitest";
import { topics } from "../src/content/catalog";
import { lessonOverviews } from "../src/content/lesson-overviews";
import { cases } from "../src/content/cases";
import { problems } from "../src/content/problems";
import { implementations } from "../src/content/implementations";
import { runTrace } from "../src/engine";
import { defaults, runAILab } from "../src/engine/ai-labs";
import { calculationSteps } from "../src/engine/ai-calculation-steps";
import { setLocale, t } from "../src/i18n/text";
import source from "../src/i18n/source.json";
import english from "../src/i18n/en";
import { localizedProps } from "../src/i18n/props";
import { engineSource } from "../src/engine";
import ts from "typescript";
import { wordBoundary } from "../src/i18n/pagination";
import { runInNewContext } from "node:vm";
import { spawnSync } from "node:child_process";
afterEach(() => setLocale("zh"));
it("English JavaScript and Python comments preserve all executable teaching examples", () => {
  setLocale("en");
  const cases = Object.values(implementations).flatMap((p) =>
    p.examples.map((e) => ({ id: p.id, code: t(p.python), ...e })),
  );
  for (const p of Object.values(implementations))
    for (const e of p.examples)
      expect(
        JSON.parse(
          JSON.stringify(
            runInNewContext(
              t(p.javascript) + "\nsolve(...args)",
              { args: structuredClone(e.args) },
              { timeout: 2000 },
            ),
          ),
        ),
        p.id,
      ).toEqual(e.answer);
  const script =
    "import sys,json\ncases=json.load(sys.stdin)\nout=[]\nfor case in cases:\n scope={}\n exec(case['code'],scope)\n out.append(scope['solve'](*case['args']))\nprint(json.dumps(out,allow_nan=False))";
  const result = spawnSync(
    process.platform === "win32" ? "python" : "python3",
    ["-X", "utf8", "-c", script],
    { input: JSON.stringify(cases), encoding: "utf8", timeout: 30000 },
  );
  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual(cases.map((c) => c.answer));
});
it("English source views are complete valid TypeScript, including comments and teaching literals", () => {
  const seen = new Set<string>();
  for (const topic of topics) {
    const source = engineSource(topic.id, "en");
    expect(source, topic.id).toBeTruthy();
    expect(source, topic.id).not.toMatch(/\p{Script=Han}/u);
    if (seen.has(source)) continue;
    seen.add(source);
    const compiled = ts.transpileModule(source, {
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    });
    expect(compiled.diagnostics, topic.id).toEqual([]);
  }
  expect(seen.size).toBe(9);
});
it("text pagination respects English word boundaries without losing long tokens", () => {
  const text =
    "Upstream gradient accumulation with a long_identifier_0123456789";
  let rest = Array.from(text);
  const pages: string[] = [];
  while (rest.length) {
    const end = wordBoundary(rest, Math.min(16, rest.length));
    expect(end).toBeGreaterThan(0);
    pages.push(rest.slice(0, end).join(""));
    rest = rest.slice(end);
  }
  expect(pages.join("")).toBe(text);
  expect(pages[0]).toBe("Upstream ");
});
it("every extracted message has English and retains its interpolation slots", () => {
  for (const [i, s] of source.entries()) {
    expect(english[i], `${i}: ${s}`).toBeTruthy();
    expect(english[i], `${i}: ${s}`).not.toMatch(/\p{Script=Han}/u);
    expect((english[i].match(/\{\d+\}/g) || []).sort(), `${i}: ${s}`).toEqual(
      (s.match(/\{\d+\}/g) || []).sort(),
    );
  }
});
it("translates every curriculum and generated demonstration string", () => {
  setLocale("en");
  const missing = new Map<string, string>();
  const walk = (value: unknown) => {
    if (typeof value === "string" && /\p{Script=Han}/u.test(value)) {
      const result = t(value);
      if (/\p{Script=Han}/u.test(result)) missing.set(value, result);
    } else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object")
      Object.values(value).forEach(walk);
  };
  expect(Object.keys(lessonOverviews).sort()).toEqual(
    topics.map((topic) => topic.id).sort(),
  );
  walk(lessonOverviews);
  walk([topics, cases, problems, implementations]);
  for (const topic of topics)
    for (const input of topic.mode === "scenario" ? ["0", "1"] : [topic.input])
      walk(runTrace(topic.id, input));
  for (const id of [
    "neural-training",
    "transformer-lab",
    "reinforcement-lab",
  ] as const) {
    const config = { ...defaults(id), rounds: 1 };
    const trace = runAILab(id, config);
    walk(trace);
    const frame = trace.frames.find(
      (f) => f.phase === "backward" || f.phase === "update",
    )!;
    walk(
      calculationSteps(id, frame, config, {
        key: "parameter",
        row: 0,
        col: 0,
        parameter: frame.updates[0].name,
        field: "gradient",
      }),
    );
  }
  expect(
    [...missing],
    `Untranslated runtime messages: ${JSON.stringify([...missing])}`,
  ).toEqual([]);
}, 30000);
it("keeps identifiers, option values and user notes intact while translating presentation", () => {
  setLocale("en");
  expect(localizedProps("option", { children: "讲解" })).toMatchObject({
    value: "讲解",
    children: t("讲解"),
  });
  expect(
    localizedProps("p", { children: "我的笔记", translate: "no" }),
  ).toMatchObject({ children: "我的笔记" });
  expect(
    localizedProps("input", { value: "原始数据", "aria-label": "训练阶段" }),
  ).toMatchObject({ value: "原始数据", "aria-label": t("训练阶段") });
  expect(t("第 3 轮")).toBe("Iteration 3");
  setLocale("zh");
  expect(t("第 3 轮")).toBe("第 3 轮");
});
