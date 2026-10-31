import type { Frame, Node, Edge } from "./model";
import { neuralModel, transformerModel } from "./ai-models";
export type LabId = "neural-training" | "transformer-lab" | "reinforcement-lab";
export type LabConfig = {
  variant: number;
  rate: number;
  rounds: number;
  epsilon: number;
  gamma: number;
};
export type Tensor = {
  name: string;
  rows: (number | string)[][];
  columns?: string[];
  labels?: string[];
};
export type Update = {
  name: string;
  group: string;
  before: number;
  gradient: number;
  after: number;
};
export type LabFrame = {
  title: string;
  phase: string;
  iteration: number;
  formula: string;
  why: string;
  change: string;
  check: string;
  question: string;
  diagram: Frame;
  tensors: Tensor[];
  updates: Update[];
  history: number[];
  checkpoint: boolean;
  transition?: {
    state: number;
    action: number;
    next: number;
    reward: number;
    done: boolean;
    target: number;
    old: number;
    updated: number;
    bootstrap: number;
  };
  position?: number;
  policy?: number[];
};
export type LabTrace = {
  frames: LabFrame[];
  source: string[];
  parameterCount: number;
  summary: string;
};
export const fmt = (x: number) =>
  Number.isFinite(x) ? x.toFixed(4) : String(x);
function neuralDiagram(
  model: ReturnType<typeof neuralModel>,
  phase: string,
): Frame {
  const backward = phase === "backward",
    all = backward || phase === "update",
    sample = 1;
  const nodes: Node[] = [
    ...model.data[sample].map((v, i) => ({
      id: `x${i}`,
      label: `x${i + 1}`,
      subtitle: String(v),
      x: 65,
      y: 100 + i * 130,
      color: phase === "input" ? "mint" : undefined,
    })),
    ...model.hidden[sample].map((v, i) => ({
      id: `h${i}`,
      label: `h${i + 1}`,
      subtitle: phase === "input" ? "待计算" : fmt(v),
      x: 240,
      y: 60 + i * 100,
      color: all || phase === "forward" ? "mint" : undefined,
    })),
    {
      id: "z",
      label: "logit",
      subtitle: ["input", "forward"].includes(phase)
        ? "待计算"
        : fmt(model.logits[sample]),
      x: 420,
      y: 160,
      color: all || phase === "prediction" ? "mint" : undefined,
    },
    {
      id: "p",
      label: "p(y=1)",
      subtitle: ["input", "forward"].includes(phase)
        ? "待计算"
        : fmt(model.predictions[sample]),
      x: 600,
      y: 85,
      color: phase === "prediction" ? "mint" : undefined,
    },
    {
      id: "loss",
      label: "整批 L",
      subtitle: ["loss", "backward", "update"].includes(phase)
        ? fmt(model.loss.value)
        : "待汇总",
      x: 600,
      y: 245,
      color: phase === "loss" || all ? "orange" : undefined,
    },
  ];
  const edges: Edge[] = [
    ...[0, 1].flatMap((i) =>
      [0, 1, 2].map((j) => ({
        from: `x${i}`,
        to: `h${j}`,
        active: all || phase === "forward",
      })),
    ),
    ...[0, 1, 2].map((j) => ({
      from: `h${j}`,
      to: "z",
      active: all || phase === "prediction",
    })),
    { from: "z", to: "p", active: all || phase === "prediction" },
    { from: "p", to: "loss", active: all || phase === "loss" },
  ].map((e) => ({
    ...e,
    from: backward ? e.to : e.from,
    to: backward ? e.from : e.to,
    directed: true,
  }));
  return {
    title: "样本 (0,1) 的神经元；损失汇总整批",
    detail: "",
    nodes,
    edges,
    values: [],
    active: [],
    settled: [],
    stats: {},
  };
}
function flow(
  labels: string[],
  active: number,
  backward = false,
  subtitles: string[] = [],
): Frame {
  const nodes: Node[] = labels.map((label, i) => ({
    id: String(i),
    label,
    x: i < 4 ? 75 + i * 175 : 600 - (i - 4) * 175,
    y: i < 4 ? 70 : 200,
    subtitle: subtitles[i],
    color: active === i ? "mint" : undefined,
  }));
  const edges: Edge[] = labels
    .slice(1)
    .map((_, i) => ({
      from: String(backward ? i + 1 : i),
      to: String(backward ? i : i + 1),
      directed: true,
      active: backward || i === active - 1,
    }))
    .filter((_, i) => !backward || (i > 0 && i < labels.length - 2));
  return {
    title: "数据流",
    detail: "",
    nodes,
    edges,
    values: [],
    active: [],
    settled: [],
    stats: {},
  };
}
export function defaults(id: LabId): LabConfig {
  return {
    variant: 0,
    rate:
      id === "neural-training" ? 0.8 : id === "transformer-lab" ? 0.08 : 0.5,
    rounds: id === "neural-training" ? 40 : id === "transformer-lab" ? 8 : 16,
    epsilon: 0.25,
    gamma: 0.9,
  };
}
export function runAILab(id: LabId, config: LabConfig): LabTrace {
  if (
    ![0, 1].includes(config.variant) ||
    !Number.isInteger(config.rounds) ||
    config.rounds < 1 ||
    config.rounds > 64 ||
    !Number.isFinite(config.rate) ||
    config.rate <= 0 ||
    config.rate > 2 ||
    (id === "reinforcement-lab" && config.rate > 1) ||
    !Number.isFinite(config.epsilon) ||
    config.epsilon < 0 ||
    config.epsilon > 1 ||
    !Number.isFinite(config.gamma) ||
    config.gamma < 0 ||
    config.gamma >= 1
  )
    throw new Error("实验参数超出范围");
  if (id === "reinforcement-lab") return reinforcement(config);
  const frames: LabFrame[] = [],
    history: number[] = [],
    transformer = id === "transformer-lab";
  let parameters: Record<string, number> = {},
    parameterCount = 0;
  const labels = transformer
    ? [
        "Token",
        "嵌入 + 位置",
        "Q / K / V",
        "双头注意力",
        "残差 + FFN",
        "词表概率",
        "交叉熵",
        "SGD 更新",
      ]
    : ["训练数据", "隐藏层", "预测概率", "平均损失", "反向梯度", "SGD 更新"];
  for (let epoch = 0; epoch < config.rounds; epoch++) {
    const model = transformer
      ? transformerModel(config.variant, parameters)
      : neuralModel(config.variant, parameters);
    parameterCount = model.params.length;
    history.push(model.loss.value);
    const paramsBefore = model.params.map((p) => ({
      name: p.name,
      group: p.group,
      before: p.node.value,
      gradient: 0,
      after: p.node.value,
    }));
    const add = (
      phase: string,
      title: string,
      active: number,
      tensors: Tensor[],
      formula: string,
      why: string,
      change: string,
      check: string,
      question: string,
      updates = paramsBefore,
      back = false,
    ) => {
      frames.push({
        phase,
        title,
        iteration: epoch + 1,
        formula,
        why,
        change,
        check,
        question,
        tensors,
        updates,
        history: [...history],
        checkpoint: ["loss", "backward", "update", "mask"].includes(phase),
        diagram:
          "hidden" in model
            ? neuralDiagram(model, phase)
            : flow(
                labels,
                active,
                back,
                labels.map((_, i) =>
                  i === active ? `第 ${epoch + 1} 轮` : "",
                ),
              ),
      });
    };
    if ("hidden" in model) {
      add(
        "input",
        "读取整批训练样本",
        0,
        [
          {
            name: "X 与标签 y · 4×3",
            rows: model.data.map((r, i) => [...r, model.targets[i]]),
            columns: ["x₁", "x₂", "y"],
          },
        ],
        "X: 4×2 → H: 4×3 → z: 4×1",
        "把四个样本一起计算，避免把一个样本的梯度误当成整批梯度。",
        `本轮读取同一组 ${config.variant ? "AND" : "XOR"} 标签；从上一轮参数继续计算。`,
        "样本、标签与参数是三种不同数据。标签只进入损失，不参与预测。",
        "XOR 为什么不能只用一个线性分类器？",
      );
      add(
        "forward",
        "隐藏层提取非线性特征",
        1,
        [{ name: "H = tanh(XW₁ + b₁) · 4×3", rows: model.hidden }],
        "hⱼ = tanh(Σᵢ xᵢW₁ᵢⱼ + b₁ⱼ)",
        "非线性隐藏层能改变输入表示；只有线性层堆叠仍等价于一次线性变换。",
        `第一个样本的隐藏状态为 ${model.hidden[0].map(fmt).join("，")}。`,
        "前向计算不会修改任何权重。所有样本共享同一组 W 和 b。",
        "若把 tanh 去掉，网络表达能力会发生什么变化？",
      );
      add(
        "prediction",
        "输出概率，不偷看标签",
        2,
        [
          {
            name: "样本预测 · 4×3",
            rows: model.predictions.map((p, i) => [
              model.logits[i],
              p,
              model.targets[i],
            ]),
            columns: ["logit", "P(y=1)", "标签"],
          },
        ],
        "z = hW₂ + b₂；p = sigmoid(z)",
        "logit 是未归一化证据；sigmoid 把它压到 0 与 1 之间，0.5 只是展示分类阈值。",
        "预测来自当前参数；此处展示标签用于比较，模型计算预测时没有读它。",
        "概率接近 0.5 表示当前模型没有强偏好，不表示数据没有规律。",
        "预测 0.9 而标签为 0 时，损失应该大还是小？",
      );
    } else {
      add(
        "input",
        "嵌入与位置编码进入模型",
        1,
        [
          {
            name: "Token ID → 下一个 Token",
            rows: model.tokens.map((t, i) => [t, model.targets[i]]),
            columns: ["输入", "训练目标"],
          },
          { name: "X = E[token] + PE · 3×4", rows: model.x },
          { name: "固定正弦位置编码 · 3×4", rows: model.position },
        ],
        "Xᵢ = E[tokenᵢ] + PEᵢ",
        "词向量给出可训练的内容表示，位置编码使同样的 token 在不同位置具有不同输入。",
        "词表只有 4 个符号 A/B/C/D，输入长度 3；每个位置预测下一个符号。",
        "这是单层 decoder-only 教学模型；固定位置编码，不训练 PE。",
        "如果交换前两个 token，哪些中间张量会改变？",
      );
      add(
        "qkv",
        "投影为查询、键和值",
        2,
        [
          { name: "Q · 3×4", rows: model.q },
          { name: "K · 3×4", rows: model.k },
          { name: "V · 3×4", rows: model.v },
        ],
        "Q = LN(X)WQ；K = LN(X)WK；V = LN(X)WV",
        "Q 与 K 决定寻找谁，V 决定从对方取回什么。两个头各使用两维，最后拼接回四维。",
        "三种投影共享输入但使用独立参数；本模型是 Pre-LN。",
        "Q/K/V 是激活值，每轮重算；WQ/WK/WV 才是跨轮更新的参数。",
        "为什么不能把注意力权重矩阵当成可训练参数本身？",
      );
      add(
        "mask",
        "因果掩码与双头 Softmax",
        3,
        model.weights.flatMap((rows, h) => [
          { name: `头 ${h + 1} · 掩码后分数`, rows: model.scores[h] },
          {
            name: `头 ${h + 1} · 注意力概率`,
            rows,
            columns: ["位置 0", "位置 1", "位置 2"],
          },
        ]),
        "Aₕ = softmax(QₕKₕᵀ / √2 + M)",
        "预测下一个 token 时不能看到未来。先屏蔽 j>i 的分数，再逐行归一化可见位置。",
        "上三角概率严格为 0；每个头每行概率和为 1。第一行只允许关注自己。",
        "−∞ 是屏蔽语义，计算时直接排除该位置；不能先归一化再简单把未来权重置零。",
        "位置 1 的第三个概率为什么必须为 0？",
      );
      add(
        "residual",
        "合并双头，经过残差与前馈层",
        4,
        [
          { name: "双头拼接 · 3×4", rows: model.concat },
          { name: "R = X + Concat·WO", rows: model.residual },
          { name: "FFN(LN(R)) · 3×4", rows: model.feed },
          { name: "Z = R + FFN · 3×4", rows: model.output },
        ],
        "R=X+Concat(head₁,head₂)WO；Z=R+ReLU(LN(R)F₁+b₁)F₂+b₂",
        "注意力混合不同位置的信息，FFN 在每个位置独立变换特征；残差保留原来的通道并提供梯度路径。",
        "FFN 中间维度 6，输出维度回到 4 才能相加。",
        "LayerNorm 沿每个 token 的特征轴计算；教学版固定缩放为 1、偏置为 0，ε=10⁻⁵。",
        "残差两侧张量形状不一致时为什么不能直接相加？",
      );
      add(
        "prediction",
        "词表分布与教师强制目标",
        5,
        [
          {
            name: "每个位置的下一符号概率 · 3×4",
            rows: model.probabilities,
            columns: ["A", "B", "C", "D"],
          },
        ],
        "P = softmax(LN(Z)U + b)",
        "训练时输入真实前缀并计算所有位置的目标损失；推理才逐个追加模型生成的 token。",
        "显示四种输出符号的概率，并与右移标签比较。",
        "本实验没有采样生成，也没有编码器交叉注意力；展示的是因果 Transformer 的训练闭环。",
        "一次训练能否只优化最后一个位置？会丢掉哪些监督信号？",
      );
    }
    add(
      "loss",
      "汇总交叉熵损失",
      transformer ? 6 : 3,
      [{ name: "本轮平均损失", rows: [[model.loss.value]] }],
      transformer
        ? "L = −(1/3) Σᵢ log Pᵢ[targetᵢ]"
        : "L = −(1/4) Σ[y log p + (1−y)log(1−p)]",
      "损失把模型输出和正确答案之间的差距变成一个标量，反向传播以它为起点。",
      `当前平均损失 ${fmt(model.loss.value)}。尚未更新权重。`,
      "训练损失下降不等于对未见样本的泛化改善；本实验没有验证集。",
      "为什么批量大小变化时通常取平均而不是直接求和？",
    );
    model.loss.backward();
    const updates = model.params.map((p) => ({
      name: p.name,
      group: p.group,
      before: p.node.value,
      gradient: p.node.grad,
      after: p.node.value - config.rate * p.node.grad,
    }));
    add(
      "backward",
      "从损失反向累加梯度",
      transformer ? 6 : 4,
      [
        {
          name: "按参数组的梯度 L₂ 范数",
          rows: [...new Set(updates.map((p) => p.group))].map((g) => [
            g,
            Math.sqrt(
              updates
                .filter((p) => p.group === g)
                .reduce((s, p) => s + p.gradient ** 2, 0),
            ),
          ]),
        },
      ],
      "∂L/∂θ = Σ所有路径 (上游梯度 × 局部导数)",
      "一个参数被多个样本、位置和分支复用，它的梯度必须累加所有路径的贡献。",
      `为 ${parameterCount} 个参数计算真实反向自动微分；表格的更新后值是下一步预览。`,
      "每轮重建计算图并清零梯度；学习率尚未乘进梯度。ReLU 在 0 处取导数 0。",
      "同一个权重被使用三次，能只保留最后一次梯度吗？",
      updates,
      true,
    );
    parameters = Object.fromEntries(updates.map((p) => [p.name, p.after]));
    const after = transformer
      ? transformerModel(config.variant, parameters)
      : neuralModel(config.variant, parameters);
    add(
      "update",
      "同步更新全部参数，再次评估",
      transformer ? 7 : 5,
      [
        {
          name: "更新前 → 更新后损失",
          rows: [[model.loss.value, after.loss.value]],
          columns: ["之前", "之后"],
        },
      ],
      `θ新 = θ旧 − ${config.rate} × ∂L/∂θ`,
      "所有梯度都来自同一次前向计算；同步更新可避免后面的参数读到半更新状态。",
      `本次更新后损失 ${fmt(after.loss.value)}；${after.loss.value < model.loss.value ? "本轮下降" : "本轮没有下降，检查步长与优化曲面"}。`,
      "训练用全批量普通 SGD，没有动量、Adam 或权重衰减；零梯度参数本轮保持不变。",
      "把学习率加倍，参数变化是否加倍？损失变化也一定加倍吗？",
      updates,
    );
    frames.at(-1)!.history.push(after.loss.value);
    if ("hidden" in after)
      frames.at(-1)!.diagram = neuralDiagram(after, "update");
  }
  return {
    frames,
    parameterCount,
    source: transformer
      ? [
          "词表 A=0 / B=1 / C=2 / D=3",
          config.variant
            ? "输入 B A C → 目标 A C D"
            : "输入 A B C → 目标 B C D",
          "d=4 · 2 heads · dFF=6 · 1 block",
        ]
      : [
          "X = [(0,0),(0,1),(1,0),(1,1)]",
          config.variant ? "AND 标签 = [0,0,0,1]" : "XOR 标签 = [0,1,1,0]",
          "2 → 3 tanh → 1 sigmoid",
          "神经元图展开样本 (0,1)；L 和梯度均汇总整批 4 个样本",
        ],
    summary: `初始损失 ${fmt(history[0])} → 最后更新后 ${fmt(frames.at(-1)!.history.at(-1)!)}；${config.rounds} 轮全批量 SGD。`,
  };
}

export const actions = ["→", "↓", "←", "↑"];
export function gridStep(state: number, action: number, variant: number) {
  const x = state % 4,
    y = Math.floor(state / 4),
    dx = [1, 0, -1, 0][action],
    dy = [0, 1, 0, -1][action];
  const nx = Math.max(0, Math.min(3, x + dx)),
    ny = Math.max(0, Math.min(2, y + dy)),
    next = ny * 4 + nx;
  return {
    next,
    reward: next === 11 ? 1 : next === 7 ? -1 : variant ? -0.2 : -0.04,
    done: next === 11 || next === 7,
  };
}
function reinforcement(c: LabConfig): LabTrace {
  const q = Array.from({ length: 12 }, () => [0, 0, 0, 0]),
    frames: LabFrame[] = [],
    history: number[] = [];
  let seed = 29;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const greedy = (s: number) => q[s].indexOf(Math.max(...q[s]));
  const diagram = (at: number, previous?: number): Frame => ({
    title: "网格环境",
    detail: "",
    values: [],
    active: [],
    settled: [],
    stats: {},
    nodes: q.map((row, i) => ({
      id: String(i),
      label:
        i === at
          ? "智能体"
          : i === 11
            ? "终点 +1"
            : i === 7
              ? "陷阱 −1"
              : `s${i}`,
      x: 90 + (i % 4) * 165,
      y: 55 + Math.floor(i / 4) * 95,
      color: i === at ? "mint" : i === 7 ? "orange" : undefined,
      subtitle:
        i === 7 || i === 11
          ? "终止状态"
          : `${actions[greedy(i)]}  ${fmt(Math.max(...row))}`,
    })),
    edges:
      previous !== undefined && previous !== at
        ? [
            {
              from: String(previous),
              to: String(at),
              active: true,
              directed: true,
            },
          ]
        : [],
  });
  for (let episode = 1; episode <= c.rounds; episode++) {
    let state = 0,
      total = 0;
    for (let t = 0; t < 20; t++) {
      const explore = random() < c.epsilon,
        action = explore ? Math.floor(random() * 4) : greedy(state),
        old = q[state][action];
      const { next, reward, done } = gridStep(state, action, c.variant),
        bootstrap = done ? 0 : Math.max(...q[next]),
        target = reward + c.gamma * bootstrap,
        updated = old + c.rate * (target - old);
      const transition = {
        state,
        action,
        next,
        reward,
        done,
        target,
        old,
        updated,
        bootstrap,
      };
      const add = (
        phase: string,
        title: string,
        at: number,
        why: string,
        change: string,
        check: string,
        formula: string,
        update = false,
      ) => {
        frames.push({
          phase,
          title,
          iteration: episode,
          position: at,
          transition: { ...transition },
          policy: q.map((_, s) => greedy(s)),
          formula,
          why,
          change,
          check,
          question: "如果下一状态是终点，目标中还能保留未来 Q 值吗？",
          checkpoint: phase === "target" || phase === "update",
          diagram: diagram(at, phase === "environment" ? state : undefined),
          tensors: [
            {
              name: "Q(s,a) · 12×4",
              rows: q.map((r) => [...r]),
              columns: actions,
              labels: q.map((_, i) => `s${i}`),
            },
          ],
          updates:
            phase === "target" || update
              ? [
                  {
                    name: `Q[${state},${actions[action]}]`,
                    group: "Q",
                    before: old,
                    gradient: old - target,
                    after: updated,
                  },
                ]
              : [],
          history: [...history],
        });
      };
      add(
        "action",
        `第 ${t + 1} 步：${explore ? "探索" : "利用"}选择 ${actions[action]}`,
        state,
        "ε-greedy 用概率 ε 随机尝试动作，其余时候选择当前 Q 最大的动作。探索也可能恰好选到贪心动作。",
        `ε=${c.epsilon}；s${state} 选择 ${actions[action]}。同值时按右、下、左、上的固定顺序选择。`,
        "Q 初始为零，智能体尚不知道陷阱和终点；地图由环境掌握。",
        "a ~ ε-greedy(Q[s,·])",
      );
      add(
        "environment",
        "环境返回下一状态与奖励",
        next,
        "智能体只提出动作，环境决定下一状态和即时奖励；撞边界留在原地。",
        `s${state} → s${next}，r=${reward}，terminated=${done}。`,
        "奖励是当前反馈，不等于未来累计回报。",
        "(s′,r,done) = env.step(s,a)",
      );
      add(
        "target",
        "构造 Bellman 自举目标",
        next,
        "Q-learning 用下一状态的最大 Q 估计后续价值；这与实际探索选什么动作不同，所以是离策略更新。",
        `目标 ${fmt(target)} = ${reward} + ${c.gamma} × ${fmt(bootstrap)}；TD 误差 ${fmt(target - old)}。`,
        done
          ? "真正终止后没有未来回报，bootstrap 必须为 0。"
          : "达到演示步数上限是截断，不是真正终止；此处仍保留自举。",
        "target = r + γ(1−done)maxₐ Q(s′,a)",
      );
      q[state][action] = updated;
      total += reward;
      const finished = done || t === 19;
      if (finished) history.push(total);
      add(
        "update",
        "只更新刚刚经历的状态动作对",
        next,
        "用 TD 误差修正一个 Q 表项，其他表项保持原值；不需要对环境求导。",
        `${fmt(old)} + ${c.rate} × (${fmt(target)} − ${fmt(old)}) = ${fmt(updated)}。${finished ? `本回合${done ? "终止" : "达到 20 步截断"}，回报 ${fmt(total)}，下一回合回到 s0。` : "接着从新状态选择动作。"}`,
        "表中 gradient 一列在本专题表示 −TD 误差，只用于统一呈现更新方向；不是神经网络反传梯度。",
        `Q新 = Q旧 + ${c.rate}(target − Q旧)`,
        true,
      );
      state = next;
      if (finished) break;
    }
  }
  const path = [0];
  let s = 0;
  for (let i = 0; i < 20; i++) {
    const result = gridStep(s, greedy(s), c.variant);
    s = result.next;
    path.push(s);
    if (result.done) break;
  }
  return {
    frames,
    source: [
      "3 行 × 4 列 · 起点 s0 · 陷阱 s7 · 终点 s11",
      `普通移动奖励 ${c.variant ? -0.2 : -0.04} · 撞墙留在原地`,
      "动作顺序 → ↓ ← ↑ · Q 表初始全 0 · 随机种子 29",
    ],
    parameterCount: 48,
    summary: `训练后关闭探索的评估路径：${path.join(" → ")}。${s === 11 ? "到达终点" : s === 7 ? "进入陷阱" : "20 步内未到终点"}；有限回合不保证收敛。`,
  };
}
