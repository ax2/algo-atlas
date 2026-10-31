import {
  actions,
  fmt,
  type LabConfig,
  type LabFrame,
  type LabId,
  type Tensor,
  type Update,
} from "./ai-labs";
import { neuralModel, transformerModel } from "./ai-models";

export type ValueSelection = {
  key: string;
  row: number;
  col: number;
  parameter?: string;
  field?: "before" | "gradient" | "after";
};
export type CalculationBlock = {
  title: string;
  text?: string;
  columns?: string[];
  rows?: (string | number)[][];
};
export type Calculation = {
  title: string;
  value?: number | string;
  sample?: number;
  nodeValues?: Record<string, string>;
  nodes: string[];
  edges: [string, string][];
  blocks: CalculationBlock[];
  update?: Update;
  field?: ValueSelection["field"];
};
export function selectCell(
  t: Tensor,
  row: number,
  col: number,
): ValueSelection {
  return {
    key: t.ref?.key || "unavailable",
    row: t.ref?.rows?.[row] ?? row,
    col: t.ref?.cols?.[col] ?? col,
    parameter: t.parameters?.[row],
    field: t.parameters?.[row]
      ? (["before", "gradient", "after"][col] as ValueSelection["field"])
      : undefined,
  };
}
export function parameterDiagram(
  id: LabId,
  name: string,
): Pick<Calculation, "nodes" | "edges"> {
  const [group, a, b] = name.split(/[\[\],]/),
    i = +a,
    j = +b;
  if (id === "reinforcement-lab") return { nodes: [a], edges: [] };
  if (id === "neural-training") {
    if (group === "W1")
      return { nodes: [`x${i}`, `h${j}`], edges: [[`x${i}`, `h${j}`]] };
    if (group === "W2")
      return { nodes: [`h${i}`, "z"], edges: [[`h${i}`, "z"]] };
    return { nodes: [group === "b1" ? `h${j}` : "z"], edges: [] };
  }
  const n =
    group === "E"
      ? 1
      : ["WQ", "WK", "WV"].includes(group)
        ? 2
        : ["U", "outbias"].includes(group)
          ? 5
          : 4;
  return {
    nodes: [String(n - 1), String(n)],
    edges: [[String(n - 1), String(n)]],
  };
}
export function calculateValue(
  id: LabId,
  frame: LabFrame,
  config: LabConfig,
  s: ValueSelection,
  history: readonly LabFrame[] = [],
): Calculation {
  const blocks: CalculationBlock[] = [],
    result: Calculation = {
      title: s.parameter || `${s.key}[${s.row},${s.col}]`,
      nodes: [],
      edges: [],
      blocks,
      field: s.field,
    };
  const text = (title: string, value: string) =>
    blocks.push({ title, text: value });
  const table = (
    title: string,
    columns: string[],
    rows: (string | number)[][],
  ) => blocks.push({ title, columns, rows });
  const ready = ["backward", "target", "update"].includes(frame.phase),
    written = frame.phase === "update";
  if (s.parameter) {
    Object.assign(result, parameterDiagram(id, s.parameter));
    const p = frame.updates.find((p) => p.name === s.parameter);
    if (!p) {
      text(
        "尚未计算",
        "当前步骤尚未计算这个参数的更新方向；先取得环境反馈或前向结果。",
      );
      return result;
    }
    result.update = p;
    result.value =
      s.field === "gradient"
        ? ready
          ? p.gradient
          : "待计算"
        : s.field === "after"
          ? p.after
          : p.before;
    blocks.push({
      title: `${s.parameter} · ${{ before: "旧值", gradient: id === "reinforcement-lab" ? "−TD 方向" : "梯度", after: written ? "新值" : "更新预览" }[s.field || "before"]} = ${typeof result.value === "number" ? fmt(result.value) : result.value}`,
    });
    if (!ready) {
      text(
        "当前参数",
        `θ = ${fmt(p.before)}。此阶段权重保持不变；梯度和更新量要等反向传播后才能确定。`,
      );
      return result;
    }
    text(
      written ? "本步已写入" : "下一步写入预览",
      `旧值 ${fmt(p.before)} − 学习率 ${config.rate} × ${id === "reinforcement-lab" ? "方向 −TD" : "梯度"} ${fmt(p.gradient)} = 新值 ${fmt(p.after)}；变化量 Δ = ${fmt(-config.rate * p.gradient)}。`,
    );
    if (id === "reinforcement-lab") {
      const t = frame.transition!;
      text(
        "TD 目标",
        `奖励 ${fmt(t.reward)} + 折扣 ${config.gamma} × ${t.done ? "0（终止，不自举）" : `下一状态最大 Q ${fmt(t.bootstrap)}`} = ${fmt(t.target)}。`,
      );
      text(
        "误差与方向",
        `TD = 目标 ${fmt(t.target)} − 旧 Q ${fmt(t.old)} = ${fmt(t.target - t.old)}；方向 −TD = ${fmt(p.gradient)}。`,
      );
      result.nodes = [String(t.state), String(t.next)];
      result.edges = [[String(t.state), String(t.next)]];
    } else {
      // Rebuild only on inspection. Capture numeric local contributions, never store a graph in playback frames.
      const model = (id === "neural-training" ? neuralModel : transformerModel)(
        config.variant,
        Object.fromEntries(frame.updates.map((p) => [p.name, p.before])),
      );
      const parameter = model.params.find((p) => p.name === s.parameter)!;
      const contributions: number[][] = [];
      model.loss.backward((parent, upstream, local) => {
        if (parent === parameter.node)
          contributions.push([upstream, local, upstream * local]);
      });
      text(
        "链式法则",
        `∂L/∂${p.name} = Σ（上游梯度 × 局部导数）= ${fmt(parameter.node.grad)}。以下为该参数每次被使用时的实际贡献，顺序是反向遍历顺序。`,
      );
      table(
        "本轮反传贡献",
        ["上游梯度", "局部导数", "贡献"],
        contributions.map((r) => r.map(fmt)),
      );
      text(
        "时间关系",
        "梯度来自更新前的整批损失；学习率不包含在梯度中。所有参数同步写入，再用新参数重新计算激活。",
      );
    }
    return result;
  }
  const tensors = [...Object.values(frame.data || {}).flat(), ...frame.tensors];
  const tensor = tensors.find((t) => t.ref?.key === s.key);
  if (!tensor) {
    text(
      "尚未计算",
      "当前阶段没有这项张量；推进到对应计算阶段后可查看。不会提前显示未来结果。",
    );
    return result;
  }
  result.title = `${tensor.name} · [${s.row},${s.col}]`;
  result.value = tensor.rows[s.row]?.[s.col];
  const show = (v: number | string) => (typeof v === "number" ? fmt(v) : v);
  text(
    "所选单元格",
    `${tensor.name} · [${s.row},${s.col}] = ${show(result.value ?? "不可用")}。${written && id !== "reinforcement-lab" && s.key !== "loss-comparison" ? "这里的激活来自更新后参数。" : ""}`,
  );
  if (s.key === "q-table") {
    result.nodes = [String(s.row)];
    result.nodeValues = {
      [String(s.row)]: `${actions[s.col]} Q=${show(result.value!)}`,
    };
    const t = frame.transition!,
      active = ready && s.row === t.state && s.col === t.action;
    if (active) {
      const detail = calculateValue(id, frame, config, {
        ...s,
        parameter: `Q[${s.row},${actions[s.col]}]`,
        field: written ? "after" : "before",
      });
      result.update = detail.update;
      result.nodes = detail.nodes;
      result.edges = detail.edges;
      blocks.push(...detail.blocks.slice(1));
    } else {
      text(
        "Q 表的来源",
        `Q[s${s.row},${actions[s.col]}] 从 0 初始化，仅在实际访问这个状态动作对时用 TD 更新；本步未写入该项，沿用已有值 ${show(result.value!)}。`,
      );
      const last = history.findLast(
        (f) =>
          f.phase === "update" &&
          f.transition?.state === s.row &&
          f.transition.action === s.col,
      );
      if (last) {
        const detail = calculateValue(id, last, config, {
          ...s,
          parameter: `Q[${s.row},${actions[s.col]}]`,
          field: "after",
        });
        text(
          "最近一次历史写入",
          `下面回溯第 ${last.iteration} 回合对该项的写入；不是当前步骤的新更新。`,
        );
        blocks.push(
          ...detail.blocks.slice(1).map((b) => ({
            ...b,
            title: b.title === "本步已写入" ? "历史更新等式" : b.title,
          })),
        );
      } else if (history.length)
        text("尚未访问", "截至当前步骤还没有写入过这项 Q 值，保留初始化的 0。");
    }
    return result;
  }
  if (s.key === "gradient-norm") {
    const group = String(tensor.rows[s.row][0]),
      params = frame.updates.filter((p) => p.group === group);
    Object.assign(result, parameterDiagram(id, params[0].name));
    text(
      "组梯度范数",
      `||∇${group}||₂ = √Σ gᵢ² = ${fmt(Math.sqrt(params.reduce((sum, p) => sum + p.gradient ** 2, 0)))}。这是组内梯度的长度，不是单个参数，也没有自己的学习率更新。`,
    );
    table(
      "平方项",
      ["参数", "梯度", "平方"],
      params.map((p) => [p.name, fmt(p.gradient), fmt(p.gradient ** 2)]),
    );
    return result;
  }
  const after = s.key === "loss-comparison" ? s.col === 1 : written;
  const model = (id === "neural-training" ? neuralModel : transformerModel)(
    config.variant,
    Object.fromEntries(
      frame.updates.map((p) => [p.name, after ? p.after : p.before]),
    ),
  );
  const weights = Object.fromEntries(
    model.params.map((p) => [p.name, p.node.value]),
  );
  const w = (group: string, i: number, j: number) =>
    weights[`${group}[${i},${j}]`];
  const dot = (label: string, a: number[], b: number[], bias = 0) => {
    table(
      label,
      ["输入", "权重", "乘积"],
      a.map((v, i) => [fmt(v), fmt(b[i]), fmt(v * b[i])]),
    );
    const total = a.reduce((sum, v, i) => sum + v * b[i], bias);
    text("求和", `Σ 乘积 + 偏置 ${fmt(bias)} = ${fmt(total)}。`);
    return total;
  };
  const path = (nodes: string[]) => {
    result.nodes = nodes;
    result.edges = nodes.slice(1).map((n, i) => [nodes[i], n]);
  };
  const r = s.row,
    c = s.col;
  if ("hidden" in model) {
    if (["input", "hidden", "prediction"].includes(s.key)) {
      result.sample = r;
      result.nodeValues = {
        x0: fmt(model.data[r][0]),
        x1: fmt(model.data[r][1]),
      };
      if (frame.data?.forward)
        model.hidden[r].forEach((v, i) => {
          result.nodeValues![`h${i}`] = fmt(v);
        });
      if (frame.data?.prediction)
        Object.assign(result.nodeValues, {
          z: fmt(model.logits[r]),
          p: fmt(model.predictions[r]),
        });
    }
    if (s.key === "input") {
      path(c < 2 ? [`x${c}`] : ["loss"]);
      text(
        "样本来源",
        c < 2
          ? `第 ${r + 1} 个样本的第 ${c + 1} 个输入，来自固定训练集；不由模型参数计算。`
          : `${config.variant ? "AND" : "XOR"} 的监督标签，由任务定义，不由预测产生。`,
      );
    }
    if (s.key === "hidden") {
      result.nodes = ["x0", "x1", `h${c}`];
      result.edges = [
        ["x0", `h${c}`],
        ["x1", `h${c}`],
      ];
      const z = dot(
        `样本 ${r} 的线性组合`,
        model.data[r],
        [w("W1", 0, c), w("W1", 1, c)],
        w("b1", 0, c),
      );
      text(
        "非线性激活",
        `h[${r},${c}] = tanh(${fmt(z)}) = ${fmt(model.hidden[r][c])}。`,
      );
    }
    if (s.key === "prediction") {
      if (c === 2) {
        path(["loss"]);
        text(
          "监督目标",
          `训练集给定 y[${r}] = ${model.targets[r]}，仅在损失计算中使用。`,
        );
      } else {
        result.nodes = ["h0", "h1", "h2", "z", ...(c === 1 ? ["p"] : [])];
        result.edges = [
          ["h0", "z"],
          ["h1", "z"],
          ["h2", "z"],
          ...(c === 1 ? [["z", "p"] as [string, string]] : []),
        ];
        dot(
          `样本 ${r} 的输出 logit`,
          model.hidden[r],
          model.hidden[r].map((_, i) => w("W2", i, 0)),
          w("b2", 0, 0),
        );
        if (c === 1)
          text(
            "概率",
            `p = sigmoid(z) = 1 / (1 + exp(−${fmt(model.logits[r])})) = ${fmt(model.predictions[r])}。`,
          );
      }
    }
  } else {
    const norm = (a: number[]) => {
      const mean = a.reduce((s, v) => s + v, 0) / a.length,
        variance = a.reduce((s, v) => s + (v - mean) ** 2, 0) / a.length;
      text(
        "LayerNorm",
        `均值 μ = ${fmt(mean)}，方差 σ² = ${fmt(variance)}；LN(x) = (x−μ)/√(σ²+0.00001)，本实验固定缩放 1、偏置 0。`,
      );
    };
    if (s.key === "tokens") {
      path(["0"]);
      text(
        "离散输入",
        `位置 ${r} 的${c ? "下一符号监督目标" : "输入 Token ID"} = ${result.value}；来自所选训练序列，不是可训练参数。`,
      );
    }
    if (s.key === "embedding") {
      path(["0", "1"]);
      text(
        "查表并加位置",
        `X[${r},${c}] = E[${model.tokens[r]},${c}] + PE[${r},${c}] = ${fmt(w("E", model.tokens[r], c))} + ${fmt(model.position[r][c])} = ${fmt(model.x[r][c])}。`,
      );
    }
    if (s.key === "position") {
      path(["1"]);
      text(
        "固定正弦位置",
        `PE[${r},${c}] = ${c % 2 ? "cos" : "sin"}(${r} / ${c < 2 ? 1 : 100}) = ${fmt(model.position[r][c])}；位置编码不参与参数更新。`,
      );
    }
    if (["q", "k", "v"].includes(s.key)) {
      path(["1", "2"]);
      norm(model.x[r]);
      dot(
        `${s.key.toUpperCase()}[${r},${c}] = LN(X)[${r},:] · W${s.key.toUpperCase()}[:,${c}]`,
        model.normalizedInput[r],
        model.normalizedInput[r].map((_, i) =>
          w(`W${s.key.toUpperCase()}`, i, c),
        ),
      );
    }
    if (s.key.startsWith("scores-") || s.key.startsWith("attention-")) {
      path(["2", "3"]);
      const h = +s.key.split("-")[1];
      if (c > r)
        text(
          "因果掩码",
          `键位置 ${c} > 查询位置 ${r}，属于未来。分数设为 −∞，Softmax 概率严格为 0；不参与归一化分母。`,
        );
      else {
        const a = model.q[r].slice(h * 2, h * 2 + 2),
          b = model.k[c].slice(h * 2, h * 2 + 2);
        const sum = dot(`头 ${h + 1} 的 Q·K`, a, b);
        text(
          "缩放点积",
          `${fmt(sum)} / √2 = ${fmt(Number(model.scores[h][r][c]))}。`,
        );
        if (s.key.startsWith("attention-")) {
          const logits = model.scores[h][r].slice(0, r + 1) as number[],
            max = Math.max(...logits),
            terms = logits.map((v) => Math.exp(v - max)),
            den = terms.reduce((s, v) => s + v, 0);
          text(
            "稳定 Softmax",
            `只对可见位置归一化：m = ${fmt(max)}；exp(score[${c}]−m) / Σ exp(score[j]−m) = ${fmt(terms[c])} / ${fmt(den)} = ${fmt(model.weights[h][r][c])}。`,
          );
          table(
            "可见位置的分母项",
            ["位置", "分数", "exp(score−m)"],
            logits.map((v, j) => [j, fmt(v), fmt(terms[j])]),
          );
        }
      }
    }
    if (s.key === "concat") {
      path(["2", "3", "4"]);
      const h = Math.floor(c / 2);
      dot(
        `头 ${h + 1} 加权 V · 通道 ${c % 2}`,
        model.weights[h][r],
        model.v.map((row) => row[c]),
      );
      text(
        "拼接",
        `两头各 2 维，当前列 ${c} 属于头 ${h + 1}。被掩码的位置权重为 0。`,
      );
    }
    if (s.key === "residual") {
      path(["3", "4"]);
      const z = dot(
        "注意力输出投影",
        model.concat[r],
        model.concat[r].map((_, i) => w("WO", i, c)),
      );
      text(
        "残差相加",
        `R = X + 投影 = ${fmt(model.x[r][c])} + ${fmt(z)} = ${fmt(model.residual[r][c])}。`,
      );
    }
    if (s.key === "feed") {
      path(["4"]);
      norm(model.residual[r]);
      table(
        "第一层 + ReLU",
        ["隐藏单元", "线性值", "ReLU"],
        model.feedHidden[r].map((v, j) => {
          const z = model.normalizedResidual[r].reduce(
            (sum, x, i) => sum + x * w("F1", i, j),
            w("f1bias", 0, j),
          );
          return [j, fmt(z), fmt(v)];
        }),
      );
      text(
        "第一层定义",
        "每列 zⱼ = Σ LN(R)ᵢ × F1ᵢⱼ + b1ⱼ，再令 hⱼ = max(0,zⱼ)。",
      );
      dot(
        "第二层输出",
        model.feedHidden[r],
        model.feedHidden[r].map((_, i) => w("F2", i, c)),
        w("f2bias", 0, c),
      );
    }
    if (s.key === "output") {
      path(["4"]);
      text(
        "第二条残差",
        `Z[${r},${c}] = R + FFN = ${fmt(model.residual[r][c])} + ${fmt(model.feed[r][c])} = ${fmt(model.output[r][c])}。FFN = ReLU(LN(R)F1+b1)F2+b2。`,
      );
    }
    if (s.key === "probabilities") {
      path(["4", "5"]);
      norm(model.output[r]);
      dot(
        `符号 ${c} 的 logit`,
        model.normalizedOutput[r],
        model.normalizedOutput[r].map((_, i) => w("U", i, c)),
        w("outbias", 0, c),
      );
      const logits = model.logits[r],
        max = Math.max(...logits),
        terms = logits.map((v) => Math.exp(v - max));
      table(
        "词表归一化",
        ["符号", "logit", "exp(logit−m)"],
        logits.map((v, j) => ["ABCD"[j], fmt(v), fmt(terms[j])]),
      );
      text(
        "概率",
        `m = ${fmt(max)}；P[${r},${c}] = ${fmt(terms[c])} / ${fmt(terms.reduce((s, v) => s + v, 0))} = ${fmt(model.probabilities[r][c])}。`,
      );
    }
  }
  if (["loss", "loss-comparison"].includes(s.key)) {
    path(id === "neural-training" ? ["p", "loss"] : ["5", "6"]);
    const losses =
      "hidden" in model
        ? model.logits.map(
            (z, i) =>
              Math.max(0, z) +
              Math.log1p(Math.exp(-Math.abs(z))) -
              model.targets[i] * z,
          )
        : model.logits.map((row, i) => {
            const max = Math.max(...row);
            return (
              max +
              Math.log(row.reduce((s, v) => s + Math.exp(v - max), 0)) -
              row[model.targets[i]]
            );
          });
    table(
      `${after ? "更新后" : "更新前"}的样本损失`,
      ["样本/位置", "目标", "交叉熵"],
      losses.map((v, i) => [i, model.targets[i], fmt(v)]),
    );
    text(
      "稳定交叉熵与平均",
      "hidden" in model
        ? "BCE(z,y) = max(0,z) + log(1+exp(−|z|)) − yz，避免极端概率下 log(0)。"
        : "CE = m + log Σ exp(logit−m) − logit[target]，m 是该行最大 logit。",
    );
    text(
      "批平均",
      `Σ 单项损失 / ${losses.length} = ${fmt(model.loss.value)}。`,
    );
  }
  return result;
}
