import { recorder } from "./model";
import type { Node, Edge, Trace, Frame } from "./model";
const round = (x: number) => Number(x.toFixed(5));
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
export function neuralGradient(w: number, b: number, x: number, y: number) {
  const z = w * x + b,
    p = sigmoid(z),
    loss = (p - y) ** 2 / 2,
    dz = (p - y) * p * (1 - p);
  return { z, p, loss, dw: dz * x, db: dz };
}
export function ai(id: string, raw: string): Trace {
  const alt = raw === "1",
    { frames, add } = recorder();
  let kind: Trace["kind"] = "matrix",
    result: unknown,
    source: string[] = [];
  const note = (why: string, changes: string, check: string) => ({
    why,
    changes,
    check,
    predict: "用当前公式手算下一步，再与演示对照。",
  });
  if (id === "gradient-descent") {
    const xs = [1, 2, 3, 4],
      ys = xs.map((x) => x * (alt ? 3 : 2)),
      lr = alt ? 0.03 : 0.05;
    let w = alt ? 4 : 0;
    source = xs.map((x, i) => `x=${x}, y=${ys[i]}`);
    const loss = (weight: number) =>
        xs.reduce((s, x, i) => s + (weight * x - ys[i]) ** 2, 0) /
        (2 * xs.length),
      history = [loss(w)];
    add("模型与损失", `ŷ=wx，无偏置；L=Σ(ŷ−y)²/(2n)，学习率 η=${lr}。`, {
      matrix: xs.map((x, i) => [x, ys[i], round(w * x)]),
      colLabels: ["x", "y", "预测"],
      stats: { w, 损失: round(loss(w)) },
    });
    for (let t = 0; t < 12; t++) {
      const g = xs.reduce((s, x, i) => s + (w * x - ys[i]) * x, 0) / xs.length,
        old = w;
      add("计算全批量梯度", `∂L/∂w=Σ(wx−y)x/n=${round(g)}。`, {
        matrix: xs.map((x, i) => [
          x,
          ys[i],
          round(old * x),
          round((old * x - ys[i]) * x),
        ]),
        colLabels: ["x", "y", "预测", "梯度贡献"],
        checkpoint: true,
        explanation: note(
          "先固定同一个 w 对全部样本求导，再平均。",
          "这里不在样本之间更新，属于全批量梯度下降。",
          "别漏掉乘 x，也别混用 MSE 与半 MSE 的系数。",
        ),
      });
      w -= lr * g;
      history.push(loss(w));
      add("更新参数", `w=${round(old)}−${lr}×${round(g)}=${round(w)}。`, {
        matrix: [[t + 1, round(w), round(loss(w))]],
        colLabels: ["轮次", "w", "新损失"],
        stats: { 损失: round(loss(w)) },
        checkpoint: true,
      });
    }
    result = { w, losses: history, learningRate: lr };
  } else if (id === "kmeans" || id === "knn") {
    kind = "graph";
    const points = alt
        ? [
            [1, 7],
            [2, 6],
            [3, 8],
            [7, 2],
            [8, 3],
            [9, 1],
          ]
        : [
            [1, 1],
            [2, 2],
            [2, 1],
            [7, 7],
            [8, 8],
            [8, 6],
          ],
      classes = [0, 0, 0, 1, 1, 1];
    source = points.map(
      (p, i) => `P${i}=(${p})${id === "knn" ? `, 类别${classes[i]}` : ""}`,
    );
    const draw = (
      assignment: number[],
      centers: number[][] = [],
      query?: number[],
    ) => ({
      nodes: [
        ...points.map((p, i) => ({
          kind: "point" as const,
          id: `p${i}`,
          label: `P${i}`,
          subtitle: `(${p})${assignment[i] >= 0 ? " · C" + assignment[i] : ""}`,
          x: 55 + p[0] * 58,
          y: 330 - p[1] * 30,
          color:
            assignment[i] === 0
              ? "mint"
              : assignment[i] === 1
                ? "orange"
                : undefined,
        })),
        ...centers.map((c, i) => ({
          kind: "centroid" as const,
          id: `c${i}`,
          label: `μ${i}`,
          subtitle: `${c.map(round)}`,
          x: 55 + c[0] * 58,
          y: 330 - c[1] * 30,
          color: i ? "orange" : "mint",
        })),
        ...(query
          ? [
              {
                kind: "centroid" as const,
                id: "q",
                label: "查询",
                x: 55 + query[0] * 58,
                y: 330 - query[1] * 30,
                color: "orange",
              },
            ]
          : []),
      ],
      edges: centers.length
        ? assignment.flatMap((c, i) =>
            c < 0 ? [] : [{ from: `p${i}`, to: `c${c}`, active: true }],
          )
        : [],
    });
    if (id === "kmeans") {
      let centers = alt
          ? [
              [1, 7],
              [3, 8],
            ]
          : [
              [1, 1],
              [2, 2],
            ],
        labels = Array(points.length).fill(-1);
      const objectives: number[] = [];
      const objective = () =>
        points.reduce(
          (s, p, i) =>
            s + p.reduce((d, x, j) => d + (x - centers[labels[i]][j]) ** 2, 0),
          0,
        );
      add(
        "初始化两个中心",
        "中心为固定教学输入；观察不佳初始化如何改变迭代。",
        draw(labels, centers),
      );
      for (let t = 0; t < 10; t++) {
        const before = labels.join(",");
        labels = points.map((p) => {
          const ds = centers.map((c) =>
            p.reduce((s, x, j) => s + (x - c[j]) ** 2, 0),
          );
          return ds[0] <= ds[1] ? 0 : 1;
        });
        add("按最近中心分组", `第 ${t + 1} 轮，平方距离相等时选择 C0。`, {
          ...draw(labels, centers),
          checkpoint: true,
          stats: { SSE: round(objective()) },
        });
        centers = centers.map((c, k) => {
          const ps = points.filter((_, i) => labels[i] === k);
          return ps.length
            ? [0, 1].map((j) => ps.reduce((s, p) => s + p[j], 0) / ps.length)
            : c;
        });
        objectives.push(objective());
        add(
          "更新中心到均值",
          `μ0=(${centers[0].map(round)})；μ1=(${centers[1].map(round)})。`,
          {
            ...draw(labels, centers),
            checkpoint: true,
            stats: { SSE: round(objective()) },
            explanation: note(
              "固定分组时，均值使组内平方距离和最小。",
              "重新计算中心之后，下一轮重新分配样本。",
              "空簇保留原中心；不把局部稳定误作全局最优。",
            ),
          },
        );
        if (before === labels.join(",")) break;
      }
      result = { points, centers, labels, objectives };
    } else {
      const q = alt ? [4, 5] : [5, 4],
        k = 3,
        rank = points
          .map((p, i) => ({
            i,
            d: p.reduce((s, x, j) => s + (x - q[j]) ** 2, 0),
          }))
          .sort((a, b) => a.d - b.d || a.i - b.i);
      add(
        "查询点与训练样本",
        `查询 (${q})，k=${k}；使用未标准化二维欧氏距离。`,
        draw(classes, [], q),
      );
      const nearest: number[] = [];
      for (const { i, d } of rank) {
        nearest.push(i);
        add("检查距离排序", `P${i} 距离²=${d}，排序位置 ${nearest.length}。`, {
          ...draw(classes, [], q),
          edges: nearest
            .slice(0, k)
            .map((i) => ({ from: "q", to: `p${i}`, active: true })),
          checkpoint: nearest.length === k,
        });
      }
      const votes = [0, 0];
      rank.slice(0, k).forEach((p) => votes[classes[p.i]]++);
      result = {
        query: q,
        neighbors: rank.slice(0, k),
        votes,
        prediction: votes[0] >= votes[1] ? 0 : 1,
      };
      add(
        "多数投票",
        `C0=${votes[0]} 票，C1=${votes[1]} 票；预测 C${(result as { prediction: number }).prediction}。`,
        {
          ...draw(classes, [], q),
          edges: rank
            .slice(0, k)
            .map((p) => ({ from: "q", to: `p${p.i}`, active: true })),
          checkpoint: true,
        },
      );
    }
  } else if (id === "perceptron") {
    const samples = alt
      ? [
          [0, 0, -1],
          [0, 1, 1],
          [1, 0, 1],
          [1, 1, -1],
        ]
      : [
          [0, 0, -1],
          [0, 1, -1],
          [1, 0, -1],
          [1, 1, 1],
        ];
    let w = [0, 0],
      b = 0,
      epochs = 0,
      converged = false;
    source = samples.map(([x, y, c]) => `(${x},${y}) → ${c}`);
    add(
      "初始化分类器",
      `w=(0,0)，b=0。${alt ? "XOR 不可线性分离。" : "AND 数据线性可分。"}`,
      { matrix: samples, colLabels: ["x₁", "x₂", "标签"] },
    );
    for (let t = 0; t < 12; t++) {
      let mistakes = 0;
      for (let i = 0; i < samples.length; i++) {
        const [x1, x2, y] = samples[i],
          score = w[0] * x1 + w[1] * x2 + b;
        if (y * score <= 0) {
          mistakes++;
          w = [w[0] + y * x1, w[1] + y * x2];
          b += y;
          add(
            "错分或位于边界：更新",
            `样本 (${x1},${x2})，y=${y}，旧 y·score=${y * score}≤0。`,
            {
              matrix: [[w[0], w[1], b]],
              colLabels: ["w₁", "w₂", "b"],
              checkpoint: true,
              inputState: {
                source,
                current: source[i],
                pending: source.slice(i + 1),
                processed: i,
                label: `第 ${t + 1} 轮`,
              },
              explanation: note(
                "当前样本没有正分类间隔，需要向标签指示的方向移动。",
                "w←w+yx，b←b+y。",
                "score=0 也更新；不可分数据会反复调整。",
              ),
            },
          );
        }
      }
      epochs = t + 1;
      if (!mistakes) {
        converged = true;
        break;
      }
    }
    result = { w, b, epochs, converged, samples };
    add(
      converged ? "一轮无误分，收敛" : "达到迭代上限，未收敛",
      `实际 ${epochs} 轮；${converged ? "全部样本具有正确的正间隔。" : "不能声称学到了正确线性分类器。"}`,
      {
        matrix: samples.map(([x, y, c]) => [x, y, c, w[0] * x + w[1] * y + b]),
        colLabels: ["x₁", "x₂", "标签", "分数"],
        checkpoint: true,
      },
    );
  } else if (id === "backprop") {
    kind = "graph";
    const x = alt ? 2 : 1.5,
      y = alt ? 0 : 1,
      w = alt ? 0.8 : 0.4,
      b = -0.2,
      g = neuralGradient(w, b, x, y),
      lr = 0.3;
    const nodes: Node[] = [
        { id: "x", label: `x=${x}`, x: 65, y: 80 },
        { id: "w", label: `w=${w}`, x: 65, y: 190 },
        { id: "b", label: `b=${b}`, x: 220, y: 260 },
        { id: "z", label: `z=${round(g.z)}`, x: 260, y: 130 },
        { id: "p", label: `p=${round(g.p)}`, x: 440, y: 130 },
        { id: "L", label: `L=${round(g.loss)}`, x: 610, y: 130 },
      ],
      edges: Edge[] = [
        { from: "x", to: "z" },
        { from: "w", to: "z" },
        { from: "b", to: "z" },
        { from: "z", to: "p" },
        { from: "p", to: "L" },
      ].map((e) => ({ ...e, directed: true }));
    source = [`x=${x}`, `y=${y}`, `w=${w}`, `b=${b}`, `η=${lr}`];
    add(
      "前向计算",
      `z=wx+b=${round(g.z)}，p=σ(z)=${round(g.p)}，L=(p−y)²/2=${round(g.loss)}。`,
      { nodes, edges, checkpoint: true },
    );
    const stages = [
      ["L→p", `∂L/∂p=p−y=${round(g.p - y)}`],
      ["p→z", `∂p/∂z=p(1−p)=${round(g.p * (1 - g.p))}`],
      ["z→w,b", `∂L/∂w=${round(g.dw)}；∂L/∂b=${round(g.db)}`],
    ];
    stages.forEach(([s, detail]) =>
      add("反向传播 " + s, detail, {
        nodes,
        edges,
        checkpoint: true,
        explanation: note(
          "链式法则：上游梯度乘局部导数。",
          detail,
          "所有导数使用更新前同一套参数；不能算一半就改权重。",
        ),
      }),
    );
    const nw = w - lr * g.dw,
      nb = b - lr * g.db;
    result = {
      x,
      y,
      w,
      b,
      ...g,
      nextW: nw,
      nextB: nb,
      nextLoss: neuralGradient(nw, nb, x, y).loss,
    };
    add(
      "独立的参数更新步骤",
      `w←${round(nw)}，b←${round(nb)}；新损失=${round(neuralGradient(nw, nb, x, y).loss)}。`,
      {
        nodes: nodes.map((n) =>
          n.id === "w"
            ? { ...n, label: `w=${round(nw)}` }
            : n.id === "b"
              ? { ...n, label: `b=${round(nb)}` }
              : n.id === "z"
                ? { ...n, label: "重新前向" }
                : n.id === "p"
                  ? { ...n, label: "重新前向" }
                  : n.id === "L"
                    ? {
                        ...n,
                        label: `L=${round(neuralGradient(nw, nb, x, y).loss)}`,
                      }
                    : n,
        ),
        edges,
        checkpoint: true,
      },
    );
  } else if (id === "attention") {
    const Q = alt
        ? [
            [1, 2],
            [0, 1],
            [2, 0],
          ]
        : [
            [1, 0],
            [0, 1],
            [1, 1],
          ],
      K = [
        [1, 0],
        [0, 1],
        [1, 1],
      ],
      V = [
        [1, 2],
        [3, 0],
        [2, 4],
      ];
    source = [
      "Q=" + JSON.stringify(Q),
      "K=" + JSON.stringify(K),
      "V=" + JSON.stringify(V),
    ];
    add(
      "输入 Q、K、V",
      "每个矩阵有 3 个 token、2 个维度；本实验不使用 mask。",
      {
        matrix: Q.map((q, i) => [...q, ...K[i], ...V[i]]),
        colLabels: ["Q₀", "Q₁", "K₀", "K₁", "V₀", "V₁"],
      },
    );
    const scores = Q.map((q) =>
      K.map((k) => q.reduce((s, v, j) => s + v * k[j], 0) / Math.sqrt(2)),
    );
    add("缩放点积", `S=QKᵀ/√2。`, {
      matrix: scores.map((r) => r.map(round)),
      checkpoint: true,
    });
    const weights: number[][] = [];
    for (let i = 0; i < 3; i++) {
      const max = Math.max(...scores[i]),
        exps = scores[i].map((s) => Math.exp(s - max)),
        total = exps.reduce((a, b) => a + b);
      weights.push(exps.map((e) => e / total));
      add(
        "按行 softmax",
        `第 ${i} 行先减最大值 ${round(max)} 再指数归一化，防止溢出。`,
        {
          matrix: weights.map((r) => r.map(round)),
          checkpoint: true,
          explanation: note(
            "每个查询独立分配注意力，不能跨行一起归一化。",
            `本行权重和=${round(weights[i].reduce((a, b) => a + b))}。`,
            "浮点四舍五入后显示和可能略有误差。",
          ),
        },
      );
    }
    const output = weights.map((w) =>
      [0, 1].map((j) => w.reduce((s, v, i) => s + v * V[i][j], 0)),
    );
    result = { Q, K, V, scores, weights, output };
    add("加权汇总 V", "输出 O=AV，每行是值向量的加权组合。", {
      matrix: output.map((r) => r.map(round)),
      checkpoint: true,
    });
  } else if (id === "decision-tree") {
    kind = "graph";
    const data = alt
        ? [
            [1, 0],
            [2, 1],
            [3, 1],
            [4, 0],
            [5, 0],
            [6, 1],
          ]
        : [
            [1, 0],
            [2, 0],
            [3, 1],
            [4, 1],
            [5, 0],
            [6, 0],
          ],
      nodes: Node[] = [],
      edges: Edge[] = [];
    source = data.map(([x, y]) => `x=${x} → ${y}`);
    type T = { threshold?: number; label?: number; left?: T; right?: T };
    const gini = (rows: number[][]) => {
      if (!rows.length) return 0;
      const p = rows.filter((r) => r[1] === 1).length / rows.length;
      return 1 - p * p - (1 - p) * (1 - p);
    };
    const build = (
      rows: number[][],
      key: string,
      d: number,
      l: number,
      r: number,
      parent?: string,
    ): T => {
      const node: Node = {
        id: key,
        label: "评估中",
        x: (l + r) / 2,
        y: 45 + d * 85,
      };
      nodes.push(node);
      if (parent) edges.push({ from: parent, to: key });
      const ones = rows.filter((r) => r[1] === 1).length;
      if (!ones || ones === rows.length) {
        node.label = `类别 ${ones ? 1 : 0}`;
        add("纯叶节点", `${rows.length} 个样本标签一致，停止分裂。`, {
          nodes,
          edges,
        });
        return { label: ones ? 1 : 0 };
      }
      let best = Infinity,
        threshold = 0;
      for (let i = 0; i < rows.length - 1; i++) {
        const t = (rows[i][0] + rows[i + 1][0]) / 2,
          L = rows.filter((s) => s[0] <= t),
          R = rows.filter((s) => s[0] > t),
          score = (L.length * gini(L) + R.length * gini(R)) / rows.length;
        if (score < best) {
          best = score;
          threshold = t;
        }
        add(
          "比较候选阈值",
          `x≤${t} 的加权 Gini=${round(score)}，当前最优阈值 ${threshold}。`,
          {
            nodes,
            edges,
            stats: { 当前不纯度: round(gini(rows)), 候选不纯度: round(score) },
          },
        );
      }
      node.label = `x ≤ ${threshold}`;
      add(
        "选择最优划分",
        `选择阈值 ${threshold}，不纯度从 ${round(gini(rows))} 降到 ${round(best)}。`,
        {
          nodes,
          edges,
          checkpoint: true,
          explanation: note(
            "在当前节点候选阈值中最小化加权不纯度。",
            "左右分支获得不同的训练样本子集。",
            "不纯度降低只描述训练集；仍需验证集与剪枝防止过拟合。",
          ),
        },
      );
      return {
        threshold,
        left: build(
          rows.filter((s) => s[0] <= threshold),
          key + "L",
          d + 1,
          l,
          (l + r) / 2,
          key,
        ),
        right: build(
          rows.filter((s) => s[0] > threshold),
          key + "R",
          d + 1,
          (l + r) / 2,
          r,
          key,
        ),
      };
    };
    result = { tree: build(data, "root", 0, 0, 680), data };
  } else if (id === "minimax") {
    kind = "graph";
    const leaves = alt ? [8, 2, 5, 4, 1, 3, 7, 6] : [3, 5, 6, 9, 1, 2, 0, -1],
      nodes: Node[] = [],
      edges: Edge[] = [],
      pruned: number[] = [],
      visited: number[] = [];
    source = leaves.map(String);
    for (let i = 0; i < 15; i++) {
      const d = Math.floor(Math.log2(i + 1)),
        j = i - (2 ** d - 1);
      nodes.push({
        id: String(i),
        label: i >= 7 ? String(leaves[i - 7]) : d % 2 ? "MIN" : "MAX",
        x: ((j + 0.5) * 660) / 2 ** d + 10,
        y: 35 + d * 85,
      });
      if (i) edges.push({ from: String((i - 1) >> 1), to: String(i) });
    }
    add("完整博弈树", "根为 MAX，下一层 MIN；叶子给定效用，双方都最优行动。", {
      nodes,
      edges,
    });
    const mark = (i: number) => {
      pruned.push(i);
      nodes[i].color = undefined;
      nodes[i].subtitle = "剪枝";
      if (i < 7) {
        mark(i * 2 + 1);
        mark(i * 2 + 2);
      }
    };
    const search = (
      i: number,
      alpha: number,
      beta: number,
      max: boolean,
    ): number => {
      visited.push(i);
      if (i >= 7) {
        add("读取叶子效用", `节点 ${i} 返回 ${leaves[i - 7]}。`, {
          nodes: nodes.map((n) => ({
            ...n,
            color: n.id === String(i) ? "orange" : n.color,
          })),
          edges,
        });
        return leaves[i - 7];
      }
      let value = max ? -Infinity : Infinity;
      for (const child of [i * 2 + 1, i * 2 + 2]) {
        const v = search(child, alpha, beta, !max);
        value = max ? Math.max(value, v) : Math.min(value, v);
        if (max) alpha = Math.max(alpha, value);
        else beta = Math.min(beta, value);
        nodes[i].label = `${max ? "MAX" : "MIN"} ${value}`;
        add(
          "更新搜索界",
          `节点 ${i}：α=${alpha}，β=${beta}，当前值=${value}。`,
          { nodes, edges, checkpoint: true },
        );
        if (alpha >= beta && child === i * 2 + 1) {
          mark(i * 2 + 2);
          add("α–β 剪枝", `α=${alpha}≥β=${beta}，跳过未访问的兄弟子树。`, {
            nodes,
            edges,
            checkpoint: true,
            explanation: note(
              "祖先已有不差于此分支的选择，继续搜索不会改变根的最优决策。",
              "剪枝节点仍留在示意树上并标记，未读取其效用。",
              "剪枝减少计算，不更改 minimax 结果。",
            ),
          });
          break;
        }
      }
      return value;
    };
    const value = search(0, -Infinity, Infinity, true);
    result = { value, leaves, visited, pruned };
    add(
      "根节点决策",
      `根的最优效用为 ${value}，访问 ${visited.length}/15 个节点。`,
      { nodes, edges, checkpoint: true },
    );
  } else throw Error("未知 AI 课程");
  return {
    frames,
    kind,
    result,
    source,
    caption:
      "小规模确定性计算，展示机制与数值；不是训练平台或完整 AI 系统。输入、停止条件及实现复杂度以本课为准。",
  };
}
