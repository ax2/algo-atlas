import type { LabId } from "../engine/ai-labs";
export const aiLabs: Record<
  LabId,
  {
    title: string;
    en: string;
    description: string;
    steps: string[];
    lessons: string[];
    concepts: { title: string; text: string }[];
    complexity: string;
    boundary: string;
    exercises: string[];
    sources: { title: string; url: string }[];
  }
> = {
  "neural-training": {
    title: "让一个神经网络真正学起来",
    en: "NEURAL NETWORK · TRAINING LOOP",
    description:
      "四个样本、十三个参数。沿着数据与梯度的方向，看一次预测如何变成一次学习。",
    steps: ["input", "forward", "prediction", "loss", "backward", "update"],
    lessons: ["perceptron", "backprop", "gradient-descent"],
    concepts: [
      {
        title: "从感知机到多层表示",
        text: "感知机只能形成线性分界，XOR 需要非线性。这里使用 2→3→1 的多层感知机，隐藏层 tanh、输出 sigmoid。1986 年 Rumelhart、Hinton 与 Williams 的工作推动了用反向传播训练多层表示；链式法则本身远早于这项工作。",
      },
      {
        title: "一次训练到底改了什么",
        text: "先用同一组旧参数完成四个样本的预测并取平均二元交叉熵，再从这个标量反向累加梯度。SGD 同时执行 θ←θ−ηg。输入和标签不变；激活每轮重新计算；只有权重与偏置跨轮保存。",
      },
      {
        title: "从玩具数据走向真实训练",
        text: "真实任务还要划分训练/验证/测试集、标准化特征、设计小批量、选择优化器并监控过拟合。训练损失下降不能代替验证集效果；学习率过大可能震荡，过小可能几乎不动。切换 AND 与 XOR 比较表达与优化的难度。",
      },
    ],
    complexity:
      "单个全连接层：批量 B、输入宽度 d、输出宽度 h，前向 O(Bdh)，反向同阶。全网络每轮 O(BΣ dₗdₗ₊₁)，E 轮再乘 E；参数 O(Σ dₗdₗ₊₁)，激活约 O(BΣ dₗ)。本实验 B=4、参数 13；标量计算图与历史快照另有教学开销。",
    boundary:
      "真实全批量 SGD；没有验证集、动量、正则化或 GPU。有限轮次不保证学会 XOR，曲线按实际结果绘制。",
    exercises: ["batch-gradient", "sgd-vector", "chain-gradient"],
    sources: [
      {
        title: "PyTorch · 优化训练循环",
        url: "https://docs.pytorch.org/tutorials/beginner/basics/optimization_tutorial.html",
      },
      {
        title: "Learning representations by back-propagating errors (1986)",
        url: "https://www.nature.com/articles/323533a0",
      },
    ],
  },
  "transformer-lab": {
    title: "走进 Transformer 的一次训练",
    en: "TRANSFORMER · INSIDE THE BLOCK",
    description:
      "从三个符号到两个注意力头，再从交叉熵回到每一组权重。把矩阵形状和数值一起看清。",
    steps: [
      "input",
      "qkv",
      "mask",
      "residual",
      "prediction",
      "loss",
      "backward",
      "update",
    ],
    lessons: ["attention", "backprop", "gradient-descent"],
    concepts: [
      {
        title: "内容、位置和可见范围",
        text: "2017 年 Transformer 将注意力作为序列建模的核心。这里选择 decoder-only 的因果块，而非原论文完整的编码器—解码器：Token 嵌入加固定位置编码，之后每个位置只能关注自己与更早的输入。未来标签不会泄漏进输入。",
      },
      {
        title: "两个头为什么不同",
        text: "d_model=4 分成两个 d_head=2 的头。每个头分别计算 QKᵀ/√2、掩码和逐行 Softmax，用概率对 V 加权；拼接两头后经 WO 投影。Q/K/V 是输入相关的激活，WQ/WK/WV 才是参数。点击矩阵单元查看具体数值。",
      },
      {
        title: "残差、归一化与学习",
        text: "使用 Pre-LN：R=X+Attention(LN(X))，Z=R+FFN(LN(R))，最后 LN→词表投影。FFN 为 4→6→4，ReLU 激活；LayerNorm 沿特征轴。平均三处交叉熵的梯度流回输出层、FFN、注意力与嵌入，每个共享参数累加全部位置贡献。",
      },
      {
        title: "训练与生成的区别",
        text: "本实验以真实前缀做教师强制训练，一轮同时监督三个位置。自回归推理则先取输出 token，再追加输入继续预测；真实模型还涉及多层堆叠、KV cache、分词、AdamW 和学习率调度。这里没有把固定四符号词表称为语言理解能力。",
      },
    ],
    complexity:
      "单层密集注意力：长度 L、宽度 d、FFN 宽度 f，前向 O(Ld²+L²d+Ldf)，反向同阶；头数 H 下注意力矩阵显存 O(HL²)，激活另需 O(Ld+Lf)，参数 O(d²+df+dV)。本模型 L=3、d=4、H=2、f=6、词表 V=4。历史快照和标量自动微分有额外开销；不把这些数值当作 GPU 基准。",
    boundary:
      "单层双头因果 Transformer，全部列出的 158 个参数真实参与反传（未被输入使用的词嵌入行梯度为零）。位置编码固定，LayerNorm 无可训练缩放/偏置，未加入 dropout、交叉注意力、生成采样或 KV cache。",
    exercises: ["causal-softmax", "attention-mix", "residual-add"],
    sources: [
      {
        title: "Harvard · The Annotated Transformer",
        url: "https://nlp.seas.harvard.edu/annotated-transformer/",
      },
      {
        title: "Attention Is All You Need (2017)",
        url: "https://arxiv.org/abs/1706.03762",
      },
    ],
  },
  "reinforcement-lab": {
    title: "让智能体从试错中找到路线",
    en: "REINFORCEMENT LEARNING · Q-LEARNING",
    description:
      "没有标准动作标签，只有行动后的奖励。跟随智能体，看经验怎样逐格改写价值表。",
    steps: ["action", "environment", "target", "update"],
    lessons: ["minimax", "gradient-descent"],
    concepts: [
      {
        title: "状态、动作、奖励与策略",
        text: "状态是当前格子，动作是四个方向，奖励来自环境。策略决定如何选择动作；Q(s,a) 估计先做 a 再继续行动的折扣回报。Q-learning 在 1989 年 Watkins 的工作中提出，把 Bellman 最优关系用于无模型的逐步学习。",
      },
      {
        title: "探索与利用是两件事",
        text: "ε-greedy 以 ε 概率均匀随机选动作，其余时候选择当前价值最大的动作。探索不是总选次优动作；未探索的路线也可能更好。固定随机种子让同一组设置可复现，改变 ε 后比较经历和最终路线。",
      },
      {
        title: "一次经验如何更新参数",
        text: "得到 (s,a,r,s′,done) 后，用 target=r+γ(1−done)max Q(s′,·) 构造目标，TD 误差 δ=target−Q(s,a)，再加上 αδ。只改一个表项。真正终止时没有未来项；演示时限截断仍保留自举。",
      },
      {
        title: "从表格到深度强化学习",
        text: "表格适合小而离散的状态空间；DQN 用神经网络近似 Q，并引入经验回放和目标网络来稳定训练。策略梯度直接优化动作分布，Actor–Critic 结合策略与价值估计。本专题先讲清表格更新；它不对环境求导，也不等同于监督分类或 Minimax 的已知模型搜索。",
      },
    ],
    complexity:
      "S 个状态、A 个动作，Q 表空间 O(SA)。每次扫描当前与下一状态动作价值，时间 O(A)，T 次交互 O(TA)。这里 S=12、A=4，每回合最多 20 步。固定 α 和有限探索回合不满足一般收敛保证；快照记录额外占 O(TSA)。",
    boundary:
      "表格 Q-learning，确定性 3×4 网格；不是 DQN/PPO 训练。曲线显示各回合未折扣奖励和，更新目标使用 γ 折扣；二者不是同一个量。最终路线用 ε=0 独立评估，未收敛会如实显示。",
    exercises: ["q-update", "discounted-return", "epsilon-policy"],
    sources: [
      {
        title: "OpenAI Spinning Up · 强化学习基本概念",
        url: "https://spinningup.openai.com/en/latest/spinningup/rl_intro.html",
      },
      {
        title: "OpenAI Spinning Up · Bellman 方程与 Q 函数",
        url: "https://spinningup.openai.com/en/latest/algorithms/ddpg.html",
      },
    ],
  },
};
export const phaseNames: Record<string, string> = {
  input: "输入",
  forward: "隐藏层",
  qkv: "Q/K/V",
  mask: "掩码注意力",
  residual: "残差与 FFN",
  prediction: "预测",
  loss: "损失",
  backward: "反向传播",
  update: "参数更新",
  action: "选择动作",
  environment: "环境反馈",
  target: "TD 目标",
};
