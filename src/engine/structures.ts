import { balanced } from "./balanced";
import { numbers, range, recorder } from "./model";
import type { Edge, Node, Trace, Frame } from "./model";
type Tree = {
  value: number;
  left?: Tree;
  right?: Tree;
  height: number;
  red?: boolean;
};
function treePicture(root: Tree | undefined) {
  const nodes: Node[] = [],
    edges: Edge[] = [];
  let index = 0;
  const go = (p: Tree | undefined, depth: number, parent?: string) => {
    if (!p) return;
    go(p.left, depth + 1, String(p.value));
    const id = String(p.value);
    nodes.push({
      id,
      label: id,
      x: 45 + index++ * 45,
      y: 35 + depth * 65,
      color: p.red ? "orange" : undefined,
    });
    if (parent) edges.push({ from: parent, to: id });
    go(p.right, depth + 1, id);
  };
  go(root, 0);
  const max = Math.max(1, index - 1);
  nodes.forEach((p) => (p.x = 50 + (((p.x - 45) / 45) * 580) / max));
  return { nodes, edges };
}
export function structures(id: string, raw: string): Trace {
  const { frames, add: record } = recorder();
  let inputState: Frame["inputState"];
  const feed = (source: (number | string)[], index: number) => {
    inputState = {
      source: source.map(String),
      current: String(source[index]),
      pending: source.slice(index + 1).map(String),
      processed: index,
    };
  };
  const add = (title: string, detail: string, extra: Partial<Frame> = {}) =>
    record(title, detail, { inputState, ...extra });
  let result: unknown;
  let kind: Trace["kind"] = "cells";
  if (id === "trie") {
    const words = raw.split(/[,，\s]+/).filter(Boolean);
    if (
      words.length < 2 ||
      words.length > 8 ||
      words.some((w) => !/^[a-zA-Z]{1,8}$/.test(w))
    )
      throw new Error("请输入 2–8 个英文单词，每词 1–8 字符。");
    const all = new Set<string>([""]),
      ends = new Set<string>();
    const picture = () => {
      const sorted = [...all].sort(),
        depths = new Map<number, string[]>();
      for (const s of sorted) {
        const row = depths.get(s.length) || [];
        row.push(s);
        depths.set(s.length, row);
      }
      const nodes = sorted.map((s) => ({
        id: s || "root",
        label: s === "" ? "root" : s.at(-1)! + (ends.has(s) ? " ✓" : ""),
        x:
          35 +
          ((depths.get(s.length)!.indexOf(s) + 1) * 610) /
            (depths.get(s.length)!.length + 1),
        y: 25 + s.length * 37,
      }));
      const edges = sorted
        .filter(Boolean)
        .map((s) => ({ from: s.slice(0, -1) || "root", to: s }));
      return { nodes, edges };
    };
    add("空字典树", "根节点代表空前缀。", picture());
    for (const [inputIndex, word] of words.entries()) {
      feed(words, inputIndex);
      for (let i = 1; i <= word.length; i++) {
        const p = word.slice(0, i),
          exists = all.has(p);
        all.add(p);
        add(
          exists ? "复用前缀" : "创建字符节点",
          `单词 ${word}，前缀 ${p} ${exists ? "已经存在" : "新增一条边"}。`,
          picture(),
        );
      }
      ends.add(word);
      add(
        "标记完整单词",
        `✓ 表示 ${word} 是一个完整词，而不仅是前缀。`,
        picture(),
      );
    }
    kind = "graph";
    result = [...ends];
  } else if (["avl", "red-black"].includes(id)) {
    return balanced(id, raw);
  } else if (id === "b-tree") {
    type B = { keys: number[]; children: B[] };
    const root: B = { keys: [], children: [] };
    const input =
      raw === "1" ? [10, 20, 5, 6, 12, 30, 7, 17] : [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const picture = () => {
      const nodes: Node[] = [],
        edges: Edge[] = [];
      const go = (p: B, l: number, r: number, d: number, key: string) => {
        nodes.push({
          id: key,
          label: p.keys.join(" · ") || "∅",
          x: (l + r) / 2,
          y: 40 + d * 95,
        });
        p.children.forEach((c, i) => {
          const next = `${key}-${i}`,
            width = (r - l) / p.children.length;
          edges.push({ from: key, to: next });
          go(c, l + i * width, l + (i + 1) * width, d + 1, next);
        });
      };
      go(root, 10, 670, 0, "root");
      return { nodes, edges };
    };
    const split = (p: B, i: number) => {
      const c = p.children[i],
        median = c.keys[1],
        right: B = { keys: c.keys.slice(2), children: c.children.slice(2) };
      c.keys = c.keys.slice(0, 1);
      c.children = c.children.slice(0, 2);
      p.keys.splice(i, 0, median);
      p.children.splice(i + 1, 0, right);
      add(
        "分裂满节点",
        `提升中间键 ${median}；这里最小度 t=2，每节点最多 3 个键。`,
        picture(),
      );
    };
    const insert = (p: B, v: number) => {
      let i = p.keys.findIndex((k) => v < k);
      if (i < 0) i = p.keys.length;
      if (!p.children.length) {
        p.keys.splice(i, 0, v);
        return;
      }
      if (p.children[i].keys.length === 3) {
        split(p, i);
        if (v > p.keys[i]) i++;
      }
      insert(p.children[i], v);
    };
    add(
      "空 B 树",
      "本实验展示 B 树插入与分裂；B+ 树叶链在原理部分对照。",
      picture(),
    );
    for (const [inputIndex, v] of input.entries()) {
      feed(input, inputIndex);
      if (root.keys.length === 3) {
        root.children = [
          { keys: [...root.keys], children: [...root.children] },
        ];
        root.keys = [];
        split(root, 0);
      }
      insert(root, v);
      add("插入完成", `插入 ${v}，所有叶子仍处于同一深度。`, picture());
    }
    kind = "graph";
    result = root;
  } else if (id === "skip-list") {
    const a =
        raw === "1"
          ? [2, 4, 6, 8, 10, 12, 14, 16]
          : [1, 3, 5, 7, 9, 11, 13, 15],
      target = raw === "1" ? 14 : 11;
    const heights = a.map((_, i) => (i % 4 === 3 ? 3 : i % 2 === 1 ? 2 : 1));
    const nodes: Node[] = [],
      edges: Edge[] = [];
    for (let level = 0; level < 3; level++) {
      let prev = "";
      a.forEach((v, i) => {
        if (heights[i] <= level) return;
        const key = `${i}-${level}`;
        nodes.push({
          id: key,
          label: String(v),
          x: 55 + i * 78,
          y: 260 - level * 90,
        });
        if (prev) edges.push({ from: prev, to: key, directed: true });
        if (level) edges.push({ from: key, to: `${i}-${level - 1}` });
        prev = key;
      });
    }
    add("构建分层捷径", "层高使用固定教学序列，真实跳表通常随机抽样层高。", {
      nodes,
      edges,
    });
    let pos = -1;
    for (let level = 2; level >= 0; level--) {
      const candidates = range(a.length).filter(
        (i) => heights[i] > level && i > pos && a[i] <= target,
      );
      for (const i of candidates) {
        pos = i;
        add(
          "沿当前层向右",
          `第 ${level + 1} 层，到达 ${a[i]}，不超过目标 ${target}。`,
          {
            nodes: nodes.map((p) => ({
              ...p,
              color: p.id === `${i}-${level}` ? "orange" : undefined,
            })),
            edges,
          },
        );
      }
      add(
        "下降一层",
        `保留当前位置 ${pos < 0 ? "头节点" : a[pos]}，继续缩小搜索范围。`,
        { nodes, edges },
      );
    }
    result = a[pos];
    kind = "graph";
  } else {
    const a = numbers(raw);
    add("准备数据", `输入序列：${a.join(", ")}。`, { values: a });
    if (id === "array") {
      let capacity = 2;
      const out: number[] = [];
      for (const [inputIndex, v] of a.entries()) {
        feed(a, inputIndex);
        if (out.length === capacity) {
          capacity *= 2;
          add(
            "扩容并复制",
            `容量翻倍到 ${capacity}；本次复制 ${out.length} 项。`,
            {
              values: out,
              stats: { 长度: out.length, 容量: capacity, 本次复制: out.length },
            },
          );
        }
        out.push(v);
        add("追加一个元素", `a[${out.length - 1}]=${v}。`, {
          values: out,
          active: [out.length - 1],
          stats: { 长度: out.length, 容量: capacity },
        });
      }
      result = out;
    } else if (id === "linked-list") {
      const out: number[] = [],
        nodeIds: number[] = [];
      const picture = () => ({
        nodes: out.map((v, i) => ({
          id: String(nodeIds[i]),
          label: String(v),
          x: 35 + (i * 610) / Math.max(1, out.length - 1),
          y: 160,
        })),
        edges: out.slice(1).map((_, i) => ({
          from: String(nodeIds[i]),
          to: String(nodeIds[i + 1]),
          directed: true,
        })),
      });
      for (const [inputIndex, v] of a.entries()) {
        feed(a, inputIndex);
        out.push(v);
        nodeIds.push(inputIndex);
        add(
          "连接尾节点",
          `让旧尾的 next 指向新节点 ${v}，新尾指向空。`,
          picture(),
        );
      }
      if (out.length > 2) {
        const removed = out.splice(1, 1)[0];
        nodeIds.splice(1, 1);
        inputState = {
          source: a.map(String),
          pending: [],
          processed: a.length,
        };
        add(
          "删除已知前驱后的节点",
          `将头节点直接连接原第三项，移除 ${removed}。`,
          picture(),
        );
      }
      kind = "graph";
      result = out;
    } else if (["stack", "queue", "deque"].includes(id)) {
      const out: number[] = [],
        removed: number[] = [];
      for (let i = 0; i < a.length; i++) {
        feed(a, i);
        if (id === "deque" && i % 2 === 0) out.unshift(a[i]);
        else out.push(a[i]);
        add(
          "插入元素",
          `${a[i]} 从${id === "deque" && i % 2 === 0 ? "左" : "右"}端进入。`,
          {
            values: out,
            active: [id === "deque" && i % 2 === 0 ? 0 : out.length - 1],
            stats: { 当前长度: out.length },
          },
        );
      }
      inputState = { source: a.map(String), pending: [], processed: a.length };
      while (out.length) {
        const v = id === "stack" ? out.pop()! : out.shift()!;
        removed.push(v);
        add("取出元素", `${v} 离开；输出：${removed.join(" → ")}。`, {
          values: out,
          stats: { 已取出: removed.length },
        });
      }
      result = removed;
    } else if (id === "hash-table") {
      const buckets: number[][] = range(7).map(() => []);
      for (const [inputIndex, v] of a.entries()) {
        feed(a, inputIndex);
        const b = v % 7;
        if (!buckets[b].includes(v)) buckets[b].push(v);
        add(
          "散列到桶",
          `h(${v})=${v} mod 7=${b}；同桶用链处理冲突，相同键不重复插入。`,
          {
            matrix: buckets.map((r, i) => [i, r.join(" → ") || "∅"]),
            colLabels: ["桶", "冲突链"],
            cells: [[b, 1]],
            stats: { 桶数: 7, 键数: buckets.flat().length },
          },
        );
      }
      result = buckets;
      kind = "matrix";
    } else if (id === "bloom") {
      const bits = Array(24).fill(0),
        hashes = (x: number) => [x % 24, (x * 7 + 3) % 24, (x * 11 + 5) % 24];
      for (const [inputIndex, v] of a.entries()) {
        feed(a, inputIndex);
        const hs = hashes(v);
        hs.forEach((h) => (bits[h] = 1));
        add(
          "写入三个散列位",
          `${v} → 位 ${hs.join(", ")}。这里只是小型教学哈希，不满足独立性保证。`,
          {
            values: bits,
            active: hs,
            stats: { 位数: 24, 已置位: bits.reduce((s, x) => s + x, 0) },
          },
        );
      }
      const x =
        range(100).find(
          (v) => !a.includes(v) && hashes(v).every((h) => bits[h]),
        ) ?? 100;
      const maybe = hashes(x).every((h) => bits[h]);
      add(
        "查询未插入元素",
        `${x} ${maybe ? "所有散列位都为 1：出现假阳性！仍需查真实集合。" : "有散列位为 0：可以断定不存在。"}`,
        { values: bits, active: hashes(x) },
      );
      result = { bits, probe: x, maybe };
    } else if (id === "lru") {
      const order: number[] = [];
      for (const [inputIndex, v] of a.entries()) {
        feed(a, inputIndex);
        const pos = order.indexOf(v),
          hit = pos >= 0;
        let evicted: number | undefined;
        if (hit) order.splice(pos, 1);
        order.unshift(v);
        if (order.length > 4) evicted = order.pop();
        add(
          hit ? "命中并移到最前" : "未命中，加入缓存",
          `访问 ${v}。${evicted !== undefined ? `淘汰最久未用的 ${evicted}。` : ""}左侧最近，右侧最久。`,
          {
            values: order,
            active: [0],
            stats: { 容量: 4, 条目: order.length },
          },
        );
      }
      add(
        "实现成本提示",
        "这里用数组记录访问次序以便观察，移动是 O(n)；真正期望 O(1) 的 LRU 要使用哈希表 + 双向链表。",
        { values: order },
      );
      result = order;
    } else if (id === "bst") {
      let root: Tree | undefined;
      const insert = (p: Tree | undefined, v: number): Tree => {
        if (!p) return { value: v, height: 1 };
        if (v < p.value) p.left = insert(p.left, v);
        if (v > p.value) p.right = insert(p.right, v);
        return p;
      };
      for (const [inputIndex, v] of a.entries()) {
        feed(a, inputIndex);
        root = insert(root, v);
        add(
          "按大小进入子树",
          `插入 ${v}，小于节点向左，大于向右；重复键忽略。`,
          treePicture(root),
        );
      }
      kind = "graph";
      result = root;
    } else if (id === "heap") {
      const h: number[] = [];
      const picture = () => ({
        nodes: h.map((v, i) => {
          const d = Math.floor(Math.log2(i + 1)),
            j = i - (2 ** d - 1);
          return {
            id: String(i),
            label: String(v),
            x: ((j + 1) * 680) / (2 ** d + 1),
            y: 35 + d * 70,
          };
        }),
        edges: h.slice(1).map((_, i) => ({
          from: String(Math.floor(i / 2)),
          to: String(i + 1),
        })),
      });
      for (const [inputIndex, v] of a.entries()) {
        feed(a, inputIndex);
        h.push(v);
        add("插入完全树末尾", `加入 ${v}，随后沿父链上浮。`, picture());
        let i = h.length - 1;
        while (i > 0) {
          const p = Math.floor((i - 1) / 2);
          if (h[p] <= h[i]) break;
          [h[p], h[i]] = [h[i], h[p]];
          i = p;
          add("小值上浮", "孩子比父节点小，交换并继续检查。", picture());
        }
      }
      kind = "graph";
      result = h;
    } else if (id === "union-find") {
      const n = Math.min(a.length, 10),
        parent = range(n),
        size = Array(n).fill(1);
      const picture = () => ({
        nodes: parent.map((p, i) => ({
          id: String(i),
          label: `${i} → ${p}`,
          x: 40 + (i * 600) / Math.max(1, n - 1),
          y: p === i ? 75 : 200,
        })),
        edges: parent.flatMap((p, i) =>
          p === i ? [] : [{ from: String(i), to: String(p), directed: true }],
        ),
      });
      const find = (x: number): number => {
        if (parent[x] !== x) parent[x] = find(parent[x]);
        return parent[x];
      };
      for (let i = 0; i < a.length - 1; i++) {
        const u = a[i] % n,
          v = a[i + 1] % n;
        let x = find(u),
          y = find(v);
        if (x !== y) {
          if (size[x] < size[y]) [x, y] = [y, x];
          parent[y] = x;
          size[x] += size[y];
        }
        add(
          "合并两个集合",
          `union(${u}, ${v})；输入值对 ${n} 取模作为节点编号。`,
          picture(),
        );
      }
      for (let i = 0; i < n; i++) {
        find(i);
        add("路径压缩", `find(${i})：沿途节点直接指向代表元。`, picture());
      }
      kind = "graph";
      result = parent;
    } else if (id === "fenwick") {
      const t = Array(a.length + 1).fill(0);
      for (let i = 0; i < a.length; i++)
        for (let j = i + 1; j < t.length; j += j & -j) {
          t[j] += a[i];
          add(
            "更新包含该点的区间",
            `加入 a[${i}]=${a[i]}：tree[${j}] += ${a[i]}；lowbit=${j & -j}。`,
            {
              values: t.slice(1),
              labels: range(a.length).map((x) => String(x + 1)),
              active: [j - 1],
            },
          );
        }
      let sum = 0;
      for (let j = a.length; j > 0; j -= j & -j) {
        sum += t[j];
        add(
          "拆分前缀查询",
          `加 tree[${j}]=${t[j]}，前缀累计 ${sum}；移除最低有效位。`,
          { values: t.slice(1), active: [j - 1], stats: { 前缀和: sum } },
        );
      }
      result = sum;
    } else if (id === "segment-tree") {
      const nodes: Node[] = [],
        edges: Edge[] = [];
      const build = (
        l: number,
        r: number,
        d: number,
        key: string,
        x1: number,
        x2: number,
      ): number => {
        const index = nodes.length;
        if (key !== "root") edges.push({ from: key.slice(0, -1), to: key });
        nodes.push({
          id: key,
          label: `[${l},${r}]`,
          x: (x1 + x2) / 2,
          y: 30 + d * 65,
        });
        if (l === r) {
          feed(a, l);
          nodes[index].label = String(a[l]);
          add("叶子保存单点值", `区间 [${l},${r}] = ${a[l]}。`, {
            nodes,
            edges,
          });
          return a[l];
        }
        const m = Math.floor((l + r) / 2),
          x = (x1 + x2) / 2;

        const sum =
          build(l, m, d + 1, key + "L", x1, x) +
          build(m + 1, r, d + 1, key + "R", x, x2);
        nodes[index].label = `${l}–${r}: ${sum}`;
        inputState = {
          source: a.map(String),
          current: `区间 [${l},${r}]`,
          pending: a.slice(r + 1).map(String),
          processed: r + 1,
          label: "合并已构建的子区间",
        };
        add("合并子区间", `sum[${l},${r}] = ${sum}。`, { nodes, edges });
        return sum;
      };
      result = build(0, a.length - 1, 0, "root", 5, 675);
      kind = "graph";
    } else throw new Error(`未知结构实验 ${id}`);
  }
  if (inputState && frames.length)
    frames[frames.length - 1].inputState = {
      source: inputState.source,
      pending: [],
      processed: inputState.source.length,
      label: "输入处理结束",
    };
  return {
    frames,
    kind,
    result,
    caption: ["avl", "red-black", "b-tree", "skip-list"].includes(id)
      ? "机制实验：可切换精选输入，逐步观察维护规则。构建与维护过程展示完整结构。"
      : "操作实验：帧是独立快照，可安全回退。示意空间与真实内存布局不同。",
  };
}
