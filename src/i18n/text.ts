import sources from "./source.json";
import english from "./en";
import { composed } from "./composed";
export type Locale = "zh" | "en";
const listeners = new Set<() => void>();
let locale: Locale = "zh";
try {
  if (localStorage.getItem("algo-atlas.locale") === "en") locale = "en";
} catch {
  /* Local learning also works without storage. */
}
export const getLocale = () => locale;
export const subscribeLocale = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function setLocale(value: Locale) {
  locale = value;
  try {
    localStorage.setItem("algo-atlas.locale", value);
  } catch {
    /* Session only. */
  }
  if (typeof document !== "undefined")
    document.documentElement.lang = value === "en" ? "en" : "zh-CN";
  listeners.forEach((listener) => listener());
}
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const translated = new Map(
  sources
    .map((source, i) => [source, english[i]])
    .filter((entry) => !!entry[1]) as [string, string][],
);
Object.entries(composed).forEach(([key, value]) => translated.set(key, value));
// Implementation descriptions are authored as arrow-separated steps and
// rendered as numbered pseudocode. Translate the whole derived block first.
for (const [source, value] of [...translated]) {
  if (source.includes(" → ") && value.includes(" → ")) {
    const numbered = (s: string) =>
      s
        .split(" → ")
        .map((part, i) => `${i + 1}. ${part}`)
        .join("\n");
    translated.set(
      numbered(source).replace(/\s+/g, " ").trim(),
      numbered(value),
    );
  }
}
// Catalog complexity fields are displayed separately after splitting on ';'.
for (const [source, value] of [...translated]) {
  const parts = source.split(";"),
    values = value.split(";");
  if (parts.length > 1 && parts.length === values.length)
    parts.forEach((part, i) => translated.set(part.trim(), values[i].trim()));
}
const templates = [...translated.entries()]
  .filter(([source]) => /\{\d+\}/.test(source))
  .map(([source, value]) => {
    const slots: string[] = [];
    const pattern = source
      .split(/(\{\d+\})/)
      .map((part) => {
        if (/^\{\d+\}$/.test(part)) {
          slots.push(part);
          return "(.*?)";
        }
        return escape(part);
      })
      .join("");
    return {
      expression: new RegExp(`^${pattern}$`, "s"),
      value,
      slots,
      size: source.replace(/\{\d+\}/g, "").length,
    };
  })
  .sort((a, b) => b.size - a.size);
const literalKeys = [...translated.keys()]
  .filter((key) => !/\{\d+\}/.test(key))
  .sort((a, b) => b.length - a.length);
const fragments = literalKeys.length
  ? new RegExp(literalKeys.map(escape).join("|"), "g")
  : undefined;
const cache = new Map<string, string>();
export function t(input: string, depth = 0): string {
  if (locale !== "en" || !/\p{Script=Han}/u.test(input)) return input;
  if (cache.has(input)) return cache.get(input)!;
  const key = input.replace(/\s+/g, " ").trim();
  let result = translated.get(key);
  if (!result && depth < 12) {
    for (const template of templates) {
      const match = template.expression.exec(key);
      if (!match) continue;
      const params = new Map(
        template.slots.map((slot, i) => [slot, t(match[i + 1], depth + 1)]),
      );
      const candidate = template.value.replace(
        /\{\d+\}/g,
        (slot) => params.get(slot) || "",
      );
      if (!/\p{Script=Han}/u.test(candidate)) {
        result = candidate;
        break;
      }
    }
  }
  if (!result)
    result = fragments
      ? input.replace(fragments, (part) => translated.get(part)!)
      : input;
  else
    result =
      (input.match(/^\s+/)?.[0] || "") +
      result +
      (input.match(/\s+$/)?.[0] || "");
  if (depth === 0) {
    if (cache.size > 20000) cache.clear();
    cache.set(input, result);
  }
  return result;
}
