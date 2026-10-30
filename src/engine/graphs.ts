import { recorder, range } from "./model";
import type { Edge, Node, Trace } from "./model";
export type Link = [number, number, number];
export function graphScenario(
  id: string,
  variant: number,
): { links: Link[]; directed: boolean } {
  const directed = !["graph", "bfs", "dfs", "kruskal", "prim"].includes(id);
  let links: Link[] = [
    [0, 1, 4],
    [0, 2, 2],
    [2, 1, 1],
    [1, 3, 5],
    [2, 3, 8],
    [2, 4, 10],
    [3, 4, 2],
    [3, 5, 6],
    [4, 5, 3],
  ];
  if (variant)
    links = [
      [0, 1, 7],
      [0, 2, 1],
      [2, 1, 2],
      [1, 3, 2],
      [2, 4, 9],
      [3, 4, 1],
      [4, 5, 2],
    ];
  if (id === "bellman-ford" && variant)
    links = [
      [0, 1, 4],
      [0, 2, 5],
      [1, 2, -2],
      [2, 3, 3],
      [3, 4, 1],
      [4, 5, 2],
    ];
  if (id === "scc")
    links = variant
      ? [
          [0, 1, 1],
          [1, 0, 1],
          [1, 2, 1],
          [2, 3, 1],
          [3, 2, 1],
          [3, 4, 1],
          [4, 5, 1],
        ]
      : [
          [0, 1, 1],
          [1, 2, 1],
          [2, 0, 1],
          [2, 3, 1],
          [3, 4, 1],
          [4, 3, 1],
          [4, 5, 1],
        ];
  if (id === "topological" && variant) links.push([5, 0, 1]);
  if (id === "max-flow")
    links = variant
      ? [
          [0, 1, 5],
          [0, 2, 3],
          [1, 3, 3],
          [2, 3, 4],
          [3, 5, 6],
          [1, 4, 2],
          [4, 5, 2],
        ]
      : [
          [0, 1, 8],
          [0, 2, 5],
          [1, 2, 3],
          [1, 3, 6],
          [2, 4, 7],
          [4, 3, 2],
          [3, 5, 7],
          [4, 5, 4],
        ];
  return { links, directed };
}
export function graphs(id: string, variant = 0): Trace {
  const { links, directed } = graphScenario(id, variant);
  const n = 6;
  const adj: Link[][] = Array.from({ length: n }, () => []);
  for (const [u, v, w] of links) {
    adj[u].push([u, v, w]);
    if (!directed) adj[v].push([v, u, w]);
  }
  const base: Node[] = range(n).map((i) => ({
    id: String(i),
    label: String.fromCharCode(65 + i),
    x: [65, 240, 240, 440, 440, 615][i],
    y: [160, 60, 255, 60, 255, 160][i],
  }));
  const edge = (path: Link[] = [], labels = false): Edge[] =>
    links.map(([u, v, w]) => ({
      from: String(u),
      to: String(v),
      label:
        labels || !["bfs", "dfs", "topological", "scc"].includes(id)
          ? String(w)
          : undefined,
      directed,
      active: path.some(
        ([a, b]) => (a === u && b === v) || (!directed && a === v && b === u),
      ),
    }));
  const { frames, add } = recorder();
  let result: unknown;
  const emit = (
    title: string,
    detail: string,
    seen: number[] = [],
    current = -1,
    path: Link[] = [],
    dist?: number[],
  ) =>
    add(title, detail, {
      nodes: base.map((p, i) => ({
        ...p,
        label:
          p.label +
          (dist ? ` · ${Number.isFinite(dist[i]) ? dist[i] : "∞"}` : ""),
        color: i === current ? "orange" : seen.includes(i) ? "mint" : undefined,
      })),
      edges: edge(path),
      stats: { 顶点: n, 边: links.length },
    });
  emit(
    "读懂这张图",
    `${directed ? "箭头表示有向边。" : "连线表示双向可达。"}源点 A，目标 F。切换场景可以观察不同结果。`,
  );
  if (id === "graph") {
    for (let u = 0; u < n; u++)
      emit(
        "展开邻接表",
        `${base[u].label} → ${adj[u].map(([, v]) => base[v].label).join(", ") || "∅"}。只存实际存在的边。`,
        [],
        u,
        adj[u],
      );
    const m = range(n).map((u) =>
      range(n).map((v) => (adj[u].some((e) => e[1] === v) ? 1 : 0)),
    );
    add("同一张图的邻接矩阵", "矩阵占 V² 空间；1 表示有边。", {
      matrix: m,
      rowLabels: base.map((x) => x.label),
      colLabels: base.map((x) => x.label),
      stats: { 表空间: `${n}+${links.length * 2}`, 矩阵格数: n * n },
    });
    result = m;
  } else if (id === "bfs" || id === "dfs") {
    const seen = new Set<number>([0]),
      frontier = [0],
      order: number[] = [];
    while (frontier.length) {
      const u = id === "bfs" ? frontier.shift()! : frontier.pop()!;
      order.push(u);
      emit(
        id === "bfs" ? "队首出队" : "栈顶展开",
        `访问 ${base[u].label}；待处理：${frontier.map((v) => base[v].label).join(", ") || "空"}。`,
        order,
        u,
      );
      for (const e of adj[u])
        if (!seen.has(e[1])) {
          seen.add(e[1]);
          frontier.push(e[1]);
          emit(
            "发现新顶点",
            `${base[e[1]].label} 首次发现，加入${id === "bfs" ? "队列" : "栈"}。`,
            order,
            e[1],
            [e],
          );
        }
    }
    result = order;
    emit(
      "遍历结束",
      `访问顺序：${order.map((v) => base[v].label).join(" → ")}。`,
      order,
    );
  } else if (id === "dijkstra" || id === "astar") {
    const d = Array(n).fill(Infinity);
    d[0] = 0;
    const done: number[] = [];
    while (done.length < n) {
      let u = -1;
      for (let i = 0; i < n; i++)
        if (!done.includes(i) && (u < 0 || d[i] < d[u])) u = i;
      if (u < 0 || !Number.isFinite(d[u])) break;
      done.push(u);
      emit(
        "确定最小距离",
        `${base[u].label} 的距离 ${d[u]} 已确定。${id === "astar" ? "本实验 h=0，因此 f=g。" : ""}`,
        done,
        u,
        [],
        d,
      );
      for (const e of adj[u]) {
        const [, v, w] = e;
        if (d[u] + w < d[v]) {
          d[v] = d[u] + w;
          emit(
            "松弛出边",
            `经过 ${base[u].label} 到 ${base[v].label} 更短，更新为 ${d[v]}。`,
            done,
            v,
            [e],
            d,
          );
        }
      }
    }
    result = d;
    emit("最短距离已确定", `A → F 的最小代价为 ${d[5]}。`, done, -1, [], d);
  } else if (id === "bellman-ford") {
    const d = Array(n).fill(Infinity);
    d[0] = 0;
    for (let k = 1; k < n; k++) {
      let changed = false;
      emit("开始一轮松弛", `第 ${k} 轮，扫描所有边。`, [], -1, [], d);
      for (const e of links) {
        const [u, v, w] = e;
        if (Number.isFinite(d[u]) && d[u] + w < d[v]) {
          d[v] = d[u] + w;
          changed = true;
          emit(
            "发现更短路径",
            `${base[u].label} → ${base[v].label}，新距离 ${d[v]}。`,
            [],
            v,
            [e],
            d,
          );
        }
      }
      if (!changed) {
        emit("提前收敛", "整轮无变化，可以停止。", [], -1, [], d);
        break;
      }
    }
    const negative = links.some(
      ([u, v, w]) => Number.isFinite(d[u]) && d[u] + w < d[v],
    );
    result = { distances: d, negative };
    emit(
      "负环检查",
      negative ? "检测到可达负环。" : "额外检查未发现可达负环。",
      range(n),
      -1,
      [],
      d,
    );
  } else if (id === "floyd") {
    const d = range(n).map((i) =>
      range(n).map((j) => (i === j ? 0 : Infinity)),
    );
    for (const [u, v, w] of links) d[u][v] = Math.min(d[u][v], w);
    const labels = base.map((x) => x.label);
    add("初始化距离矩阵", "对角线为 0，未知路径为 ∞。", {
      matrix: d.map((r) => r.map((x) => (Number.isFinite(x) ? x : "∞"))),
      rowLabels: labels,
      colLabels: labels,
    });
    for (let k = 0; k < n; k++)
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          if (d[i][k] + d[k][j] < d[i][j]) {
            d[i][j] = d[i][k] + d[k][j];
            add(
              "允许新的中间点",
              `经 ${labels[k]}，${labels[i]} → ${labels[j]} 缩短为 ${d[i][j]}。`,
              {
                matrix: d.map((r) =>
                  r.map((x) => (Number.isFinite(x) ? x : "∞")),
                ),
                rowLabels: labels,
                colLabels: labels,
                cells: [
                  [i, j],
                  [i, k],
                  [k, j],
                ],
                stats: { 中间点: labels[k] },
              },
            );
          }
    result = d;
    add("所有点对处理完成", "矩阵可直接回答任意起终点的最短距离。", {
      matrix: d.map((r) => r.map((x) => (Number.isFinite(x) ? x : "∞"))),
      rowLabels: labels,
      colLabels: labels,
    });
  } else if (id === "topological") {
    const indeg = Array(n).fill(0);
    for (const [, v] of links) indeg[v]++;
    const q = range(n).filter((i) => !indeg[i]),
      order: number[] = [];
    emit(
      "计算入度",
      `当前零入度顶点：${q.map((i) => base[i].label).join(", ") || "无"}。`,
      [],
      -1,
      [],
      indeg,
    );
    while (q.length) {
      const u = q.shift()!;
      order.push(u);
      for (const [, v] of adj[u]) if (--indeg[v] === 0) q.push(v);
      emit(
        "移除零入度顶点",
        `输出 ${base[u].label}，删除其出边后新队列：${q.map((i) => base[i].label).join(", ") || "空"}。`,
        order,
        u,
        adj[u],
        indeg,
      );
    }
    result = { order, cycle: order.length < n };
    emit(
      order.length < n ? "检测到依赖环" : "拓扑序完成",
      order.length < n
        ? "剩余顶点没有零入度入口，无法安排全部任务。"
        : order.map((i) => base[i].label).join(" → "),
      order,
    );
  } else if (id === "kruskal" || id === "prim") {
    const chosen: Link[] = [],
      parent = range(n),
      used = [0];
    const root = (x: number): number =>
      parent[x] === x ? x : (parent[x] = root(parent[x]));
    if (id === "kruskal") {
      for (const e of [...links].sort((a, b) => a[2] - b[2])) {
        const [u, v, w] = e;
        if (root(u) !== root(v)) {
          parent[root(u)] = root(v);
          chosen.push(e);
          emit(
            "连接两个分量",
            `${base[u].label} — ${base[v].label}，权重 ${w}，不产生环。`,
            [],
            v,
            chosen,
          );
        } else
          emit(
            "跳过成环边",
            `${base[u].label} 与 ${base[v].label} 已连通。`,
            [],
            -1,
            chosen,
          );
      }
    } else
      while (used.length < n) {
        const e = links
          .filter(([u, v]) => used.includes(u) !== used.includes(v))
          .sort((a, b) => a[2] - b[2])[0];
        if (!e) break;
        const [u, v, w] = e;
        used.push(used.includes(u) ? v : u);
        chosen.push(e);
        emit(
          "选最轻跨割边",
          `权重 ${w}；当前树有 ${used.length} 个顶点。`,
          used,
          -1,
          chosen,
        );
      }
    const weight = chosen.reduce((s, e) => s + e[2], 0);
    result = { edges: chosen, weight };
    emit(
      "生成树完成",
      `选择 ${chosen.length} 条边，总权重 ${weight}。`,
      range(n),
      -1,
      chosen,
    );
  } else if (id === "scc") {
    const seen = new Set<number>(),
      order: number[] = [];
    const dfs = (u: number) => {
      seen.add(u);
      emit("原图深度搜索", "先递归子节点，退出时记录后序。", [...seen], u);
      for (const [, v] of adj[u]) if (!seen.has(v)) dfs(v);
      order.push(u);
    };
    for (let i = 0; i < n; i++) if (!seen.has(i)) dfs(i);
    const rev: number[][] = range(n).map(() => []);
    for (const [u, v] of links) rev[v].push(u);
    seen.clear();
    const components: number[][] = [];
    const collect = (u: number, c: number[]) => {
      seen.add(u);
      c.push(u);
      for (const v of rev[u]) if (!seen.has(v)) collect(v, c);
    };
    for (const u of order.reverse())
      if (!seen.has(u)) {
        const c: number[] = [];
        collect(u, c);
        components.push(c);
        emit(
          "反图提取一个分量",
          `当前强连通分量：${c.map((i) => base[i].label).join(", ")}。`,
          c,
        );
      }
    result = components;
    emit(
      "强连通分量完成",
      components
        .map((c) => `{${c.map((i) => base[i].label).join(", ")}}`)
        .join(" / "),
    );
  } else if (id === "max-flow") {
    const residual = range(n).map(() => Array(n).fill(0));
    for (const [u, v, w] of links) residual[u][v] += w;
    let total = 0;
    while (true) {
      const parent = Array(n).fill(-1),
        q = [0];
      parent[0] = 0;
      while (q.length && parent[5] < 0) {
        const u = q.shift()!;
        for (let v = 0; v < n; v++)
          if (parent[v] < 0 && residual[u][v] > 0) {
            parent[v] = u;
            q.push(v);
          }
      }
      if (parent[5] < 0) break;
      let amount = Infinity;
      const path: Link[] = [];
      for (let v = 5; v !== 0; v = parent[v])
        amount = Math.min(amount, residual[parent[v]][v]);
      for (let v = 5; v !== 0; v = parent[v]) {
        const u = parent[v];
        path.push([u, v, amount]);
        residual[u][v] -= amount;
        residual[v][u] += amount;
      }
      total += amount;
      emit(
        "沿增广路增加流量",
        `瓶颈 ${amount}，总流量 ${total}；同时增加反向残量以允许撤回。`,
        [],
        5,
        path,
      );
      add("查看残量网络", "每格为仍可追加的流量；反向格记录可撤回量。", {
        matrix: residual,
        rowLabels: base.map((x) => x.label),
        colLabels: base.map((x) => x.label),
        stats: { 总流量: total },
      });
    }
    result = total;
    emit("没有增广路", `最终最大流 = ${total}。`);
  } else throw new Error(`未知图实验 ${id}`);
  return {
    frames,
    kind: "graph",
    result,
    caption:
      "精选 6 顶点场景；节点标签可携带距离/入度。图中权重与路径均由场景数据计算。",
  };
}
