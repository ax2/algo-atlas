import { topicById } from "../content/catalog";
import { sorting } from "./sorting";
import { structures } from "./structures";
import { graphs } from "./graphs";
import { strategies } from "./strategies";
import { strings } from "./strings";
import { math } from "./math";
import sortingSource from "./sorting.ts?raw";
import structuresSource from "./structures.ts?raw";
import graphsSource from "./graphs.ts?raw";
import strategiesSource from "./strategies.ts?raw";
import stringsSource from "./strings.ts?raw";
import mathSource from "./math.ts?raw";
export function runTrace(id: string, input: string, target = 5) {
  const topic = topicById[id];
  if (!topic) throw new Error("课程不存在");
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
  }
}
export function engineSource(id: string) {
  const category = topicById[id].category;
  return {
    structures: id === "graph" ? graphsSource : structuresSource,
    sorting: sortingSource,
    graphs: graphsSource,
    patterns: strategiesSource,
    strings: stringsSource,
    math: mathSource,
  }[category];
}
