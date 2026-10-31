import { topicById } from "../content/catalog";
import { problemById } from "../content/problems";
export interface LearningData {
  version: 1;
  favorites: string[];
  completed: string[];
  notes: Record<string, string>;
  updatedAt: string;
  exerciseCompleted?: string[];
}
export interface LearningRepository {
  load(): LearningData;
  save(data: LearningData): void;
}
const KEY = "algo-atlas.learning.v1";
export const emptyLearning = (): LearningData => ({
  version: 1,
  favorites: [],
  completed: [],
  notes: {},
  updatedAt: new Date().toISOString(),
});
export function validateLearning(value: unknown): LearningData {
  if (!value || typeof value !== "object")
    throw new Error("不是有效的学习备份。");
  const v = value as Record<string, unknown>;
  if (v.version !== 1) throw new Error("备份版本不受支持。");
  const ids = (x: unknown) => {
    if (
      !Array.isArray(x) ||
      x.length > 500 ||
      x.some((i) => typeof i !== "string" || !Object.hasOwn(topicById, i))
    )
      throw new Error("备份含未知课程。");
    return [...new Set(x as string[])];
  };
  const favorites = ids(v.favorites),
    completed = ids(v.completed);
  const exerciseCompleted = v.exerciseCompleted ?? [];
  if (
    !Array.isArray(exerciseCompleted) ||
    exerciseCompleted.length > 5000 ||
    exerciseCompleted.some(
      (x) => typeof x !== "string" || !Object.hasOwn(problemById, x),
    )
  )
    throw new Error("备份含未知练习。");
  if (!v.notes || typeof v.notes !== "object" || Array.isArray(v.notes))
    throw new Error("笔记格式错误。");
  const notes: Record<string, string> = {};
  for (const [id, note] of Object.entries(v.notes)) {
    if (
      !Object.hasOwn(topicById, id) ||
      typeof note !== "string" ||
      note.length > 20000
    )
      throw new Error("备份笔记无效或超过长度限制。");
    notes[id] = note;
  }
  return {
    version: 1,
    favorites,
    completed,
    notes,
    exerciseCompleted: [...new Set(exerciseCompleted as string[])],
    updatedAt: new Date().toISOString(),
  };
}
export const localRepository: LearningRepository = {
  load() {
    try {
      const value = localStorage.getItem(KEY);
      return value ? validateLearning(JSON.parse(value)) : emptyLearning();
    } catch {
      return emptyLearning();
    }
  },
  save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  },
};
export function mergeLearning(
  current: LearningData,
  incoming: LearningData,
): LearningData {
  const notes = { ...current.notes };
  for (const [id, text] of Object.entries(incoming.notes)) {
    if (!text) continue;
    if (notes[id] && notes[id] !== text)
      notes[id] += `\n\n—— 导入的笔记 ——\n${text}`;
    else notes[id] = text;
    if (notes[id].length > 20000)
      throw new Error(
        `合并后 ${topicById[id].name} 笔记超过 20,000 字，请先备份并整理。`,
      );
  }
  return {
    ...current,
    favorites: [...new Set([...current.favorites, ...incoming.favorites])],
    completed: [...new Set([...current.completed, ...incoming.completed])],
    notes,
    exerciseCompleted: [
      ...new Set([
        ...(current.exerciseCompleted || []),
        ...(incoming.exerciseCompleted || []),
      ]),
    ],
    updatedAt: new Date().toISOString(),
  };
}
export function exportLearning(data: LearningData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "algo-atlas-learning.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Future service boundary: not connected by default. No token belongs in VITE_* variables.
export interface OnlineLearningService {
  getProfile(
    signal?: AbortSignal,
  ): Promise<{ id: string; displayName: string }>;
  pull(signal?: AbortSignal): Promise<{ revision: string; data: LearningData }>;
  push(
    data: LearningData,
    revision: string,
    signal?: AbortSignal,
  ): Promise<{ revision: string }>;
}
export class HttpLearningService implements OnlineLearningService {
  constructor(private origin: string) {
    const u = new URL(origin, location.origin);
    if (u.origin !== location.origin)
      throw new Error("在线服务需部署在同源反向代理之后。");
  }
  private async request(path: string, init: RequestInit = {}) {
    const response = await fetch(`${this.origin}/api/v1${path}`, {
      ...init,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...init.headers },
    });
    if (!response.ok)
      throw new Error(
        response.status === 409
          ? "同步冲突：请先合并服务器版本。"
          : `服务错误 ${response.status}`,
      );
    return response.json();
  }
  getProfile(signal?: AbortSignal) {
    return this.request("/me", { signal });
  }
  async pull(signal?: AbortSignal) {
    const r = await this.request("/learning", { signal });
    if (typeof r.revision !== "string")
      throw new Error("服务返回的版本号无效。");
    return { revision: r.revision, data: validateLearning(r.data) };
  }
  push(data: LearningData, revision: string, signal?: AbortSignal) {
    return this.request("/learning", {
      method: "PUT",
      headers: { "If-Match": revision },
      body: JSON.stringify(validateLearning(data)),
      signal,
    });
  }
}
