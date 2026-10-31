import { recorder } from "./model";
import type { Frame, Node, Edge, Trace } from "./model";
export const advancedIds = [
  "treap",
  "splay",
  "lazy-segment",
  "persistent-segment",
  "sparse-table",
  "kd-tree",
];
export function advanced(id: string, raw: string): Trace {
  const variant = raw === "1",
    a = variant ? [8, 3, 7, 1, 6, 2, 5, 4] : [5, 2, 8, 1, 7, 3, 6, 4],
    { frames, add } = recorder();
  let kind: Trace["kind"] = "graph",
    result: unknown;
  let source = a.map(String);
  const note = (
    why: string,
    changes: string,
    check: string,
    predict = "预测下一步，然后单步验证。",
  ) => ({ why, changes, check, predict });
  const feed = (i: number): Frame["inputState"] => ({
    source,
    current: String(a[i]),
    pending: source.slice(i + 1),
    processed: i,
  });
  if (id === "treap" || id === "splay") {
    type T = { v: number; p: number; l?: T; r?: T };
    let root: T | undefined;
    const priorities = variant
      ? [5, 80, 20, 60, 15, 70, 30, 90]
      : [70, 40, 90, 20, 60, 10, 80, 30];
    const picture = () => {
      const nodes: Node[] = [],
        edges: Edge[] = [];
      const go = (p: T | undefined, d: number, parent?: T) => {
        if (!p) return;
        nodes.push({
          id: String(p.v),
          label: String(p.v),
          x: 55 + (p.v - 1) * 80,
          y: 45 + d * 80,
          subtitle: id === "treap" ? `优先级 ${p.p}` : undefined,
        });
        if (parent) edges.push({ from: String(parent.v), to: String(p.v) });
        go(p.l, d + 1, p);
        go(p.r, d + 1, p);
      };
      go(root, 0);
      return { nodes, edges };
    };
    const attach = (parent: T | undefined, old: T, q: T) => {
      if (!parent) root = q;
      else if (parent.l === old) parent.l = q;
      else parent.r = q;
    };
    const rotate = (p: T, parent: T | undefined, left: boolean) => {
      const q = left ? p.r! : p.l!;
      if (left) {
        p.r = q.l;
        q.l = p;
      } else {
        p.l = q.r;
        q.r = p;
      }
      attach(parent, p, q);
      return q;
    };
    add("空树", "按初始序列逐个插入；节点身份不会因旋转改变。", {
      ...picture(),
      inputState: { source, pending: source, processed: 0 },
    });
    a.forEach((v, i) => {
      const path: T[] = [];
      let p = root,
        parent: T | undefined;
      while (p) {
        path.push(p);
        parent = p;
        p = v < p.v ? p.l : p.r;
      }
      const n: T = { v, p: priorities[i] };
      if (!parent) root = n;
      else if (v < parent.v) parent.l = n;
      else parent.r = n;
      add(
        "连接新叶子",
        `插入 ${v}${id === "treap" ? `，固定教学优先级 ${n.p}` : ""}。`,
        { ...picture(), inputState: feed(i) },
      );
      if (id === "treap") {
        let child = n;
        while (path.length && path.at(-1)!.p > child.p) {
          const old = path.pop()!,
            par = path.at(-1);
          child = rotate(old, par, old.r === child);
          add(
            "旋转维护优先级",
            `提升 ${child.v}；它的优先级 ${child.p} 小于原父亲 ${old.v} 的 ${old.p}。`,
            {
              ...picture(),
              inputState: feed(i),
              checkpoint: true,
              explanation: note(
                "插入只破坏父链上的堆序，旋转保持 BST 的中序。",
                "提升低优先级数值节点；中间子树移接。",
                "所有已插入节点仍在完整树上。",
              ),
            },
          );
        }
      }
    });
    if (id === "splay")
      for (const target of variant ? [1, 7, 3] : [4, 8, 2]) {
        const path: T[] = [];
        let p = root;
        while (p && p.v !== target) {
          path.push(p);
          p = target < p.v ? p.l : p.r;
        }
        while (p && path.length) {
          const par = path.pop()!,
            g = path.pop(),
            gg = path.at(-1);
          let title = "Zig：单旋";
          if (!g) rotate(par, undefined, par.r === p);
          else if ((g.l === par) === (par.l === p)) {
            title = "Zig-zig：同向双旋";
            rotate(g, gg, g.r === par);
            rotate(par, gg, par.r === p);
          } else {
            title = "Zig-zag：异向双旋";
            rotate(par, g, par.r === p);
            rotate(g, gg, g.r === p);
          }
          add(title, `访问 ${target}，将它沿路径提升。`, {
            ...picture(),
            checkpoint: true,
            explanation: note(
              "把访问节点移到根，适应重复访问的局部性。",
              title,
              "检查中序仍为 1…8；单次操作可以线性。",
            ),
          });
        }
        add("访问结束", `${target} 已成为根。`, {
          ...picture(),
          checkpoint: true,
        });
      }
    result = root;
  } else if (id === "sparse-table") {
    kind = "matrix";
    const st: number[][] = [a.slice()];
    const pic = () => ({
      matrix: st.map((row) => a.map((_, i) => row[i] ?? "—")),
      rowLabels: st.map((_, k) => `2^${k}`),
      colLabels: a.map((_, i) => String(i)),
    });
    add("长度 1 的区间", a.join(", "), pic());
    for (let k = 1; 1 << k <= a.length; k++) {
      st[k] = [];
      for (let i = 0; i + (1 << k) <= a.length; i++) {
        st[k][i] = Math.min(st[k - 1][i], st[k - 1][i + (1 << (k - 1))]);
        add(
          "合并等长两半",
          `st[${k}][${i}]=min(${st[k - 1][i]},${st[k - 1][i + (1 << (k - 1))]})=${st[k][i]}。`,
          { ...pic(), cells: [[k, i]] },
        );
      }
    }
    const l = variant ? 0 : 1,
      r = variant ? 6 : 5,
      k = Math.floor(Math.log2(r - l + 1)),
      value = Math.min(st[k][l], st[k][r - (1 << k) + 1]);
    result = { table: st, range: [l, r], value };
    add(
      "两段覆盖查询",
      `min[${l},${r}]=min(${st[k][l]},${st[k][r - (1 << k) + 1]})=${value}。`,
      {
        ...pic(),
        cells: [
          [k, l],
          [k, r - (1 << k) + 1],
        ],
        checkpoint: true,
        explanation: note(
          "min 具有幂等性，两段重叠仍正确。",
          `覆盖 [${l},${l + (1 << k) - 1}] 和 [${r - (1 << k) + 1},${r}]。`,
          "若运算改成加法，重叠会重复计数，不能这样查。",
        ),
      },
    );
  } else if (id === "lazy-segment") {
    kind = "matrix";
    const sum = Array(4 * a.length).fill(0),
      tag = sum.slice(),
      ranges: Record<number, [number, number]> = {};
    const build = (p: number, l: number, r: number) => {
      ranges[p] = [l, r];
      if (l === r) {
        sum[p] = a[l];
        return;
      }
      const m = (l + r) >> 1;
      build(p * 2, l, m);
      build(p * 2 + 1, m + 1, r);
      sum[p] = sum[p * 2] + sum[p * 2 + 1];
    };
    build(1, 0, a.length - 1);
    const pic = () => ({
      matrix: Object.keys(ranges).map((s) => {
        const p = +s;
        return [p, `[${ranges[p]}]`, sum[p], tag[p]];
      }),
      colLabels: ["节点", "区间", "sum", "lazy"],
    });
    add("建树完成", "sum 保存区间和；lazy 初始为 0。", pic());
    const apply = (p: number, d: number) => {
      sum[p] += d * (ranges[p][1] - ranges[p][0] + 1);
      tag[p] += d;
    };
    const push = (p: number) => {
      if (tag[p]) {
        const d = tag[p];
        apply(p * 2, d);
        apply(p * 2 + 1, d);
        tag[p] = 0;
        add("下传懒标记", `节点 ${p} 的 +${d} 传给两个孩子，父标记清零。`, {
          ...pic(),
          checkpoint: true,
          explanation: note(
            "部分访问需要孩子反映真实数值。",
            "孩子 sum 加上增量×长度，孩子 tag 累加。",
            "父 sum 不再加一次；它此前已包含此增量。",
          ),
        });
      }
    };
    const update = (p: number, L: number, R: number, d: number) => {
      const [l, r] = ranges[p];
      if (R < l || r < L) return;
      if (L <= l && r <= R) {
        apply(p, d);
        add(
          "整段命中，暂不展开",
          `[${l},${r}] 全部 +${d}，sum=${sum[p]}，lazy=${tag[p]}。`,
          { ...pic(), checkpoint: true },
        );
        return;
      }
      push(p);
      update(p * 2, L, R, d);
      update(p * 2 + 1, L, R, d);
      sum[p] = sum[p * 2] + sum[p * 2 + 1];
      add("向上合并", `节点 ${p} 的区间和恢复为两孩子之和 ${sum[p]}。`, pic());
    };
    const updates = variant
      ? [
          [0, 7, 2],
          [2, 5, 3],
        ]
      : [
          [0, 7, 3],
          [1, 4, 2],
        ];
    updates.forEach(([l, r, d]) => update(1, l, r, d));
    const query = (p: number, L: number, R: number): number => {
      const [l, r] = ranges[p];
      if (R < l || r < L) return 0;
      if (L <= l && r <= R) return sum[p];
      push(p);
      return query(p * 2, L, R) + query(p * 2 + 1, L, R);
    };
    const value = query(1, 2, 6);
    result = { updates, range: [2, 6], value, total: sum[1] };
    add("查询完成", `区间 [2,6] 的和为 ${value}。`, {
      ...pic(),
      checkpoint: true,
    });
  } else if (id === "persistent-segment") {
    type P = {
      id: string;
      l: number;
      r: number;
      sum: number;
      left?: P;
      right?: P;
    };
    let serial = 0;
    const roots: P[] = [];
    const build = (l: number, r: number): P => {
      const p: P = { id: `n${serial++}`, l, r, sum: 0 };
      if (l === r) p.sum = a[l];
      else {
        const m = (l + r) >> 1;
        p.left = build(l, m);
        p.right = build(m + 1, r);
        p.sum = p.left.sum + p.right.sum;
      }
      return p;
    };
    roots.push(build(0, a.length - 1));
    const pic = () => {
      const nodes: Node[] = [],
        edges: Edge[] = [],
        seen = new Set<string>();
      const walk = (p: P, d: number) => {
        if (seen.has(p.id)) return;
        seen.add(p.id);
        nodes.push({
          id: p.id,
          label: `${p.l}–${p.r}: ${p.sum}`,
          x: 45 + ((p.l + p.r) / 2) * 80,
          y: 80 + d * 80,
        });
        for (const c of [p.left, p.right])
          if (c) {
            edges.push({ from: p.id, to: c.id });
            walk(c, d + 1);
          }
      };
      // Show one version at a time; the table below reports shared node identities.
      walk(roots.at(-1)!, 0);
      return { nodes, edges };
    };
    add("版本 0", `初始数组 ${a.join(", ")}；每个节点有永久 ID。`, {
      ...pic(),
      stats: { 版本: 0, 总节点: serial },
    });
    const change = (p: P, at: number, value: number): P => {
      const q = { ...p, id: `n${serial++}` };
      if (q.l === q.r) q.sum = value;
      else {
        if (at <= q.left!.r) q.left = change(q.left!, at, value);
        else q.right = change(q.right!, at, value);
        q.sum = q.left!.sum + q.right!.sum;
      }
      return q;
    };
    const changes = variant
      ? [
          [2, 20],
          [6, 0],
        ]
      : [
          [1, 12],
          [5, 10],
        ];
    for (const [at, value] of changes) {
      const before = serial;
      roots.push(change(roots.at(-1)!, at, value));
      add(
        "路径复制，新版本完成",
        `a[${at}]←${value}；新增 ${serial - before} 个节点，旧根保持不变。`,
        {
          ...pic(),
          checkpoint: true,
          stats: { 版本: roots.length - 1, 总节点: serial },
          explanation: note(
            "历史版本不能修改，所以只复制受影响的祖先路径。",
            `旧版根 ${roots[roots.length - 2].id}，新版根 ${roots.at(-1)!.id}。`,
            "未经过的孩子保留同一个节点 ID，旧版区间和仍可查询。",
          ),
        },
      );
    }
    const query = (p: P, l: number, r: number): number =>
      r < p.l || p.r < l
        ? 0
        : l <= p.l && p.r <= r
          ? p.sum
          : query(p.left!, l, r) + query(p.right!, l, r);
    result = {
      roots,
      changes,
      queries: roots.map((p) => query(p, 1, 5)),
      nodeCount: serial,
    };
    add("并排查询历史版本", "相同范围 [1,5]，不同根得到不同历史答案。", {
      matrix: roots.map((p, i) => [i, p.id, p.sum, query(p, 1, 5)]),
      colLabels: ["版本", "根 ID", "全区间和", "[1,5] 和"],
      checkpoint: true,
    });
  } else if (id === "kd-tree") {
    type Point = [number, number];
    type K = { point: Point; axis: number; id: string; left?: K; right?: K };
    const points: Point[] = variant
        ? [
            [1, 8],
            [2, 2],
            [3, 6],
            [6, 1],
            [7, 7],
            [9, 4],
          ]
        : [
            [2, 3],
            [5, 4],
            [9, 6],
            [4, 7],
            [8, 1],
            [7, 2],
          ],
      q: Point = variant ? [6, 5] : [6, 3];
    let root: K | undefined;
    const nodes: Node[] = [],
      edges: Edge[] = [];
    const build = (
      ps: Point[],
      d: number,
      id: string,
      l: number,
      r: number,
      parent?: string,
    ): K | undefined => {
      if (!ps.length) return;
      const axis = d % 2,
        sorted = ps.slice().sort((a, b) => a[axis] - b[axis]),
        m = sorted.length >> 1,
        p: K = { point: sorted[m], axis, id };
      nodes.push({
        id,
        label: p.point.join(","),
        subtitle: `切 ${axis ? "y" : "x"} 轴`,
        x: (l + r) / 2,
        y: 45 + d * 95,
      });
      if (parent) edges.push({ from: parent, to: id });
      add(
        "中位数切分",
        `轴 ${axis ? "y" : "x"}，选择 (${p.point})；左、右点集分别递归。`,
        {
          nodes,
          edges,
          inputState: {
            source: points.map(String),
            current: String(p.point),
            pending: [...sorted.slice(0, m), ...sorted.slice(m + 1)].map(
              String,
            ),
            processed: points.length - ps.length,
            label: "待处理显示当前子问题剩余点",
          },
          checkpoint: true,
        },
      );
      p.left = build(sorted.slice(0, m), d + 1, id + "L", l, (l + r) / 2, id);
      p.right = build(sorted.slice(m + 1), d + 1, id + "R", (l + r) / 2, r, id);
      return p;
    };
    source = points.map(String);
    root = build(points, 0, "root", 10, 670);
    let best: K | undefined,
      bestD = Infinity;
    const dist = (p: Point) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
    const search = (p?: K) => {
      if (!p) return;
      const d = dist(p.point);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
      add(
        "检查近邻候选",
        `查询 (${q})，节点 (${p.point}) 距离²=${d}，当前最优=${bestD}。`,
        {
          nodes: nodes.map((n) => ({
            ...n,
            color: n.id === p.id ? "orange" : undefined,
          })),
          edges,
        },
      );
      const delta = q[p.axis] - p.point[p.axis];
      search(delta < 0 ? p.left : p.right);
      if (delta * delta <= bestD) {
        add(
          "回溯远侧",
          `切分平面距离²=${delta * delta} ≤ 最优距离²=${bestD}，远侧仍可能更近。`,
          { nodes, edges, checkpoint: true },
        );
        search(delta < 0 ? p.right : p.left);
      } else
        add(
          "剪去远侧",
          `平面距离²=${delta * delta} > ${bestD}，远侧不可能更优。`,
          { nodes, edges, checkpoint: true },
        );
    };
    search(root);
    result = { points, query: q, nearest: best!.point, distanceSquared: bestD };
  } else throw Error("未知进阶结构");
  return {
    frames,
    kind,
    result,
    source,
    caption:
      "可复现机制实验；具体输入与参数在步骤中列出。图形空间不等于算法辅助空间。",
  };
}
