import { afterEach, expect, it } from "vitest";
import { topics } from "../src/content/catalog";
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
afterEach(() => setLocale("zh"));
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
