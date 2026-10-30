export type Category =
  "structures" | "sorting" | "graphs" | "patterns" | "strings" | "math";
export type Topic = {
  id: string;
  name: string;
  en: string;
  category: Category;
  level: number;
  importance: number;
  popularity: number;
  intro: string;
  history: string;
  use: string;
  invariant: string;
  caveat: string;
  best: string;
  average: string;
  worst: string;
  space: string;
  analysis: string;
  source: string;
  analogy: string;
  input: string;
  inputHint: string;
  mode: "numbers" | "text" | "scenario";
};
export const categories: { id: Category; name: string; description: string }[] =
  [
    {
      id: "structures",
      name: "数据结构",
      description: "组织信息，让操作更高效",
    },
    { id: "sorting", name: "排序与搜索", description: "建立秩序，定位答案" },
    { id: "graphs", name: "图论", description: "从关系中发现路径与结构" },
    {
      id: "patterns",
      name: "动态规划与策略",
      description: "把复杂问题转化为可解的子问题",
    },
    { id: "strings", name: "字符串", description: "识别文本背后的规律" },
    { id: "math", name: "数学与几何", description: "用计算理解数量和空间" },
  ];
export const levels = ["入门", "基础", "进阶", "挑战"];
