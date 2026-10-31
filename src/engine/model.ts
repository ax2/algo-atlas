export type DiagramSelection =
  { kind: "node"; id: string } | { kind: "edge"; from: string; to: string };
export type Node = {
  id: string;
  label: string;
  x: number;
  y: number;
  color?: string;
  subtitle?: string;
  updating?: boolean;
  kind?: "point" | "centroid";
};
export type Edge = {
  from: string;
  to: string;
  label?: string;
  directed?: boolean;
  active?: boolean;
};
export type Frame = {
  title: string;
  detail: string;
  values: number[];
  labels?: string[];
  active: number[];
  settled: number[];
  pivot?: number;
  nodes?: Node[];
  edges?: Edge[];
  matrix?: (number | string)[][];
  rowLabels?: string[];
  colLabels?: string[];
  cells?: [number, number][];
  stats: Record<string, number | string>;
  result?: unknown;
  worklists?: { name: string; items: string[] }[];
  tables?: { title: string; columns: string[]; rows: (string | number)[][] }[];
  checkpoint?: boolean;
  explanation?: {
    why: string;
    changes: string;
    check: string;
    predict: string;
  };
  inputState?: {
    source: string[];
    current?: string;
    pending: string[];
    processed: number;
    label?: string;
  };
};
export type Trace = {
  source?: string[];
  output?: {
    title: string;
    columns?: string[];
    rows?: (string | number)[][];
    summary: string[];
  };
  frames: Frame[];
  kind: "bars" | "cells" | "graph" | "matrix" | "board";
  result: unknown;
  caption: string;
};
export function recorder(values: number[] = []) {
  const frames: Frame[] = [];
  const add = (title: string, detail: string, extra: Partial<Frame> = {}) => {
    if (frames.length > 5000) throw new Error("轨迹超过安全上限");
    frames.push(
      structuredClone({
        title,
        detail,
        values: [...values],
        active: [],
        settled: [],
        stats: {},
        ...extra,
      }),
    );
  };
  return { frames, add };
}
export function numbers(raw: string, min = 2, max = 16, limit = 99) {
  const parts = raw.trim().split(/[,，\s]+/);
  const a = parts.map(Number);
  if (
    parts.some((x) => !/^\d+$/.test(x)) ||
    a.length < min ||
    a.length > max ||
    a.some((n) => !Number.isSafeInteger(n) || n < 0 || n > limit)
  )
    throw new Error(`请输入 ${min}–${max} 个 0–${limit} 的整数。`);
  return a;
}
export const range = (n: number) => Array.from({ length: n }, (_, i) => i);
export function textPair(raw: string, max = 24) {
  const p = raw.split("|");
  if (
    p.length !== 2 ||
    p.some((x, i) => !new RegExp(`^[a-zA-Z]{1,${i ? 12 : max}}$`).test(x))
  )
    throw new Error("请按提示输入两个英文字母字符串，用 | 分隔。");
  return p;
}
