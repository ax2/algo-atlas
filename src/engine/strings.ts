import { recorder, range, textPair } from "./model";
import type { Node, Edge, Trace } from "./model";
export function strings(id: string, raw: string): Trace {
  const { frames, add } = recorder();
  let result: unknown,
    kind: Trace["kind"] = "cells";
  if (id === "suffix-array") {
    if (!/^[a-zA-Z]{1,12}$/.test(raw))
      throw new Error("请输入 1–12 个英文字母。");
    const suffixes = range(raw.length).map((i) => ({
      index: i,
      text: raw.slice(i),
    }));
    add("生成全部后缀", "每个位置都对应一个直到末尾的后缀。", {
      matrix: suffixes.map((s) => [s.index, s.text]),
      colLabels: ["起点", "后缀"],
    });
    for (let i = 1; i < suffixes.length; i++) {
      const item = suffixes[i];
      let j = i;
      while (j > 0 && suffixes[j - 1].text > item.text) {
        suffixes[j] = suffixes[j - 1];
        j--;
      }
      suffixes[j] = item;
      add(
        "按字典序插入后缀",
        `把 ${item.text} 插入第 ${j} 位。本实验使用直观插入排序，最坏字符比较 O(n³)。`,
        {
          matrix: suffixes.map((s) => [s.index, s.text]),
          colLabels: ["起点", "后缀"],
          cells: [[j, 1]],
        },
      );
    }
    result = suffixes.map((s) => s.index);
    kind = "matrix";
  } else if (id === "huffman") {
    if (!/^[a-zA-Z]{1,20}$/.test(raw))
      throw new Error("请输入 1–20 个英文字母。");
    type H = { id: string; freq: number; char?: string; left?: H; right?: H };
    const freq = new Map<string, number>();
    for (const ch of raw) freq.set(ch, (freq.get(ch) || 0) + 1);
    const forest: H[] = [...freq].map(([char, freq], i) => ({
      id: `s${i}`,
      char,
      freq,
    }));
    let seq = 0;
    const picture = () => {
      const nodes: Node[] = [],
        edges: Edge[] = [];
      const go = (p: H, l: number, r: number, depth: number) => {
        nodes.push({
          id: p.id,
          label: `${p.char || "Σ"}:${p.freq}`,
          x: (l + r) / 2,
          y: 25 + depth * 55,
        });
        if (p.left) {
          edges.push({ from: p.id, to: p.left.id, label: "0" });
          go(p.left, l, (l + r) / 2, depth + 1);
        }
        if (p.right) {
          edges.push({ from: p.id, to: p.right.id, label: "1" });
          go(p.right, (l + r) / 2, r, depth + 1);
        }
      };
      forest.forEach((p, i) =>
        go(p, (i * 680) / forest.length, ((i + 1) * 680) / forest.length, 0),
      );
      return { nodes, edges };
    };
    add("统计字符频率", "每个符号是一棵带权叶树。", picture());
    const takeMin = () => {
      let m = 0;
      for (let i = 1; i < forest.length; i++)
        if (forest[i].freq < forest[m].freq) m = i;
      return forest.splice(m, 1)[0];
    };
    while (forest.length > 1) {
      const candidates = forest.slice().sort((a, b) => a.freq - b.freq);
      add(
        "选择下一对候选",
        `即将合并 ${candidates[0].char || candidates[0].id}:${candidates[0].freq} 与 ${candidates[1].char || candidates[1].id}:${candidates[1].freq}。`,
        {
          ...picture(),
          checkpoint: true,
          inputState: {
            source: [...freq].map(([c, f]) => `${c}:${f}`),
            current: candidates
              .slice(0, 2)
              .map((p) => `${p.char || p.id}:${p.freq}`)
              .join(" + "),
            pending: candidates
              .slice(2)
              .map((p) => `${p.char || p.id}:${p.freq}`),
            processed: seq,
            label: "候选森林；当前为本轮最小的两棵树",
          },
        },
      );
      const left = takeMin(),
        right = takeMin();
      forest.push({
        id: `n${seq++}`,
        freq: left.freq + right.freq,
        left,
        right,
      });
      add(
        "合并最小的两棵树",
        `${left.freq} + ${right.freq} = ${left.freq + right.freq}；教学线性选择最小，未使用优先队列。`,
        picture(),
      );
    }
    const codes: Record<string, string> = {};
    const walk = (p: H, s: string) => {
      if (p.char) codes[p.char] = s || "0";
      if (p.left) walk(p.left, s + "0");
      if (p.right) walk(p.right, s + "1");
    };
    walk(forest[0], "");
    result = codes;
    add(
      "生成前缀编码",
      Object.entries(codes)
        .map(([c, b]) => `${c}=${b}`)
        .join("；"),
      picture(),
    );
    kind = "graph";
  } else {
    const [text, pattern] = textPair(raw),
      n = text.length,
      m = pattern.length,
      found: number[] = [];
    let comparisons = 0;
    const emit = (title: string, detail: string, offset: number, j = -1) => {
      const width = Math.max(n, offset + m);
      add(title, detail, {
        matrix: [
          range(width).map((i) => text[i] || "·"),
          range(width).map((i) =>
            i >= offset && i < offset + m ? pattern[i - offset] : "·",
          ),
        ],
        rowLabels: ["文本", "模式"],
        cells:
          j >= 0
            ? [
                [0, offset + j],
                [1, offset + j],
              ]
            : [],
        stats: { 字符比较: comparisons, 已匹配: found.length },
      });
    };
    emit("准备文本与模式", `文本长度 ${n}，模式长度 ${m}。`, 0);
    if (id === "naive-match") {
      for (let i = 0; i <= n - m; i++) {
        let j = 0;
        for (; j < m; j++) {
          comparisons++;
          emit(
            "逐字符对照",
            `${text[i + j]} 与 ${pattern[j]} ${text[i + j] === pattern[j] ? "相同" : "不同"}。`,
            i,
            j,
          );
          if (text[i + j] !== pattern[j]) break;
        }
        if (j === m) {
          found.push(i);
          emit("找到完整匹配", `起点 ${i}。`, i);
        }
      }
    } else if (id === "kmp") {
      const pi = Array(m).fill(0);
      for (let i = 1; i < m; i++) {
        let j = pi[i - 1];
        while (j > 0 && pattern[i] !== pattern[j]) j = pi[j - 1];
        if (pattern[i] === pattern[j]) j++;
        pi[i] = j;
        add("构建前缀函数", `pi[${i}]=${j}：最长真前缀与后缀的共同长度。`, {
          values: pi,
          labels: [...pattern].map((c, i) => `${c}:${pi[i]}`),
          active: [i],
        });
      }
      let j = 0;
      for (let i = 0; i < n; i++) {
        while (j > 0 && text[i] !== pattern[j]) {
          comparisons++;
          emit(
            "失配：复用前后缀",
            `j 从 ${j} 跳到 pi[${j - 1}]=${pi[j - 1]}；文本指针 i=${i} 不回退。`,
            i - j,
            j,
          );
          j = pi[j - 1];
        }
        comparisons++;
        emit("继续匹配", `i=${i}，j=${j}。`, i - j, j);
        if (text[i] === pattern[j]) j++;
        if (j === m) {
          found.push(i - m + 1);
          emit(
            "找到完整匹配",
            `起点 ${i - m + 1}，继续查重叠匹配。`,
            i - m + 1,
          );
          j = pi[j - 1];
        }
      }
    } else if (id === "rabin-karp") {
      const mod = 101,
        base = 31;
      let hp = 0,
        ht = 0,
        power = 1;
      for (let i = 0; i < m; i++) {
        hp = (hp * base + pattern.charCodeAt(i)) % mod;
        ht = (ht * base + (text.charCodeAt(i) || 0)) % mod;
        if (i < m - 1) power = (power * base) % mod;
      }
      for (let i = 0; i <= n - m; i++) {
        emit(
          "比较窗口哈希",
          `窗口 hash=${ht}，模式 hash=${hp}；模数 ${mod}。`,
          i,
        );
        if (ht === hp) {
          let equal = true;
          for (let j = 0; j < m; j++) {
            comparisons++;
            if (text[i + j] !== pattern[j]) {
              equal = false;
              break;
            }
          }
          if (equal) {
            found.push(i);
            emit("核验成功", `哈希命中后逐字符验证，起点 ${i}。`, i);
          } else emit("哈希碰撞", "指纹相同但内容不同，拒绝该候选。", i);
        }
        if (i < n - m)
          ht =
            ((((ht - text.charCodeAt(i) * power) % mod) + mod) * base +
              text.charCodeAt(i + m)) %
            mod;
      }
    } else if (id === "z-function") {
      const s = pattern + "#" + text,
        z = Array(s.length).fill(0);
      let l = 0,
        r = 0;
      for (let i = 1; i < s.length; i++) {
        if (i <= r) z[i] = Math.min(r - i + 1, z[i - l]);
        while (i + z[i] < s.length) {
          comparisons++;
          if (s[z[i]] !== s[i + z[i]]) break;
          z[i]++;
        }
        if (i + z[i] - 1 > r) {
          l = i;
          r = i + z[i] - 1;
        }
        add(
          "复用 Z 区间",
          `i=${i}，z=${z[i]}，右侧最远匹配区间 [${l},${r}]。`,
          {
            values: z,
            labels: [...s].map((c, j) => `${c}:${z[j]}`),
            active: [i],
            stats: { 字符比较: comparisons },
          },
        );
        if (i > m && z[i] >= m) found.push(i - m - 1);
      }
    } else throw new Error(`未知字符串实验 ${id}`);
    emit(
      "检索完成",
      found.length ? `所有匹配起点：${found.join(", ")}。` : "没有匹配的起点。",
      found[0] ?? 0,
    );
    result = found;
    kind = "matrix";
  }
  return {
    frames,
    kind,
    result,
    caption:
      "字符下标从 0 开始。本版本实验输入限制为英文字母，避免混淆字节、码点和字素。",
  };
}
