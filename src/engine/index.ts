import { topicById } from "../content/catalog";
import { sorting } from "./sorting";
import { structures } from "./structures";
import { graphs } from "./graphs";
import { strategies } from "./strategies";
import { strings } from "./strings";
import { math } from "./math";
import { teach } from "./teaching";
import balancedSource from "./balanced.ts?raw";
import { advanced, advancedIds } from "./advanced";
import { ai } from "./ai";
import advancedSource from "./advanced.ts?raw";
import aiSource from "./ai.ts?raw";
import sortingSource from "./sorting.ts?raw";
import structuresSource from "./structures.ts?raw";
import graphsSource from "./graphs.ts?raw";
import strategiesSource from "./strategies.ts?raw";
import stringsSource from "./strings.ts?raw";
import mathSource from "./math.ts?raw";
import englishSource from "../content/engine-source.en.json";
export function runTrace(id: string, input: string, target = 5) {
  const trace = computeTrace(id, input, target);
  return teach(topicById[id], trace, input);
}
function computeTrace(id: string, input: string, target: number) {
  const topic = topicById[id];
  if (!topic) throw new Error("课程不存在");
  if (advancedIds.includes(id)) return advanced(id, input);
  switch (topic.category) {
    case "structures":
      return id === "graph"
        ? graphs(id, Number(input) || 0)
        : structures(id, input);
    case "sorting":
      return sorting(id, input, target);
    case "graphs":
      return graphs(id, Number(input) || 0);
    case "patterns":
      return strategies(id, input);
    case "strings":
      return strings(id, input);
    case "math":
      return math(id, input);
    case "ai":
      return ai(id, input);
  }
}
export function engineSource(id: string, locale: "zh" | "en" = "zh") {
  const category = topicById[id].category;
  if (locale === "en") {
    const file = advancedIds.includes(id)
      ? "advanced"
      : ["avl", "red-black"].includes(id)
        ? "balanced"
        : id === "graph"
          ? "graphs"
          : category === "patterns"
            ? "strategies"
            : category;
    return englishSource[file as keyof typeof englishSource];
  }
  return {
    structures: advancedIds.includes(id)
      ? advancedSource
      : id === "graph"
        ? graphsSource
        : ["avl", "red-black"].includes(id)
          ? balancedSource
          : structuresSource,
    sorting: sortingSource,
    graphs: graphsSource,
    patterns: strategiesSource,
    strings: stringsSource,
    math: mathSource,
    ai: aiSource,
  }[category];
}
