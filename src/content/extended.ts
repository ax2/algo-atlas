import type { Topic } from "./types";
const structureSource =
  "https://cp-algorithms.com/data_structures/segment_tree.html";
const aiSource = "https://scikit-learn.org/stable/user_guide.html";
// Original, bounded mechanism lessons. Complexity describes the actual variant.
const data = [
  [
    "treap",
    "树堆",
    "Treap",
    "structures",
    "按键维持 BST，按优先级维持小根堆；旋转兼顾两种顺序。",
    "随机化搜索树将随机优先级与旋转结合，是随机平衡结构的经典设计。",
    "动态有序集合、排名与区间拆合",
    "键中序有序，父优先级不大于孩子",
    "本实验固定优先级以复现；不能把固定序列当作随机期望保证。",
    "O(1);O(log n) 随机优先级期望;O(n) 单次;O(n)",
    "独立随机优先级让树形等价于随机 BST；单次插入期望 O(log n)，退化链仍可达 O(n)。",
    "按姓名排位置，再按随机号码决定谁在上层。",
  ],
  [
    "splay",
    "伸展树",
    "Splay Tree",
    "structures",
    "每次访问后用 zig、zig-zig 或 zig-zag 把节点提到根。",
    "Sleator 与 Tarjan 于 1980 年代提出伸展树与摊还分析。",
    "局部性强的访问、有序序列维护",
    "旋转保持中序次序，访问节点最终成为根",
    "单次操作可能 O(n)；摊还界不是每次都对数。",
    "O(1);O(log n) 摊还;O(n) 单次;O(n)",
    "本实验先建 BST 再逐次伸展查询。标准伸展操作用势能法得到每次 O(log n) 摊还界，初始化另计。",
    "常用的书会被不断搬到最容易拿的位置。",
  ],
  [
    "lazy-segment",
    "懒标记线段树",
    "Lazy Segment Tree",
    "structures",
    "区间更新整段命中时记录待下传标记，真正访问子区间再展开。",
    "懒传播是区间数据结构中推迟重复工作的经典技巧。",
    "区间加、区间求和、在线范围统计",
    "sum 已包含当前标记，tag 表示孩子尚未接收的增量",
    "下传时乘区间长度；赋值与加法标记的合成顺序不同。",
    "O(1) 整段;O(log n) 单次;O(log n) 单次;O(n)",
    "建树 O(n)；一次连续区间加或查询访问 O(log n) 个边界路径和覆盖节点。本课只实现加法标记。",
    "整箱加价先贴标签，需要开箱时再逐件登记。",
  ],
  [
    "persistent-segment",
    "可持久化线段树",
    "Persistent Segment Tree",
    "structures",
    "修改时只复制根到叶路径，让历史版本共享未改变的子树。",
    "持久化数据结构保留历史状态，路径复制是常用实现方法。",
    "历史区间查询、版本快照、离线第 k 小基础",
    "旧版本节点永不修改，新根只替换修改路径",
    "不能把旧节点原地修改；本课展示点更新与区间和。",
    "O(log n);O(log n) 单次;O(log n) 单次;O(n+q log n)",
    "初始建树 O(n)，q 次点修改各新建 O(log n) 节点；版本根选择 O(1)，范围求和 O(log n)。",
    "修改家谱时复印相关页，其余页在版本之间共享。",
  ],
  [
    "sparse-table",
    "稀疏表",
    "Sparse Table",
    "structures",
    "预处理长度为 2 的幂的区间最小值，查询用两段覆盖目标区间。",
    "倍增预处理广泛用于静态 RMQ 与祖先查询。",
    "静态区间最小值、重复查询",
    "st[k][i] 是从 i 开始、长度 2^k 的最小值",
    "重叠查询只适合 min/max/gcd 等幂等运算，不能照搬求和。",
    "O(1) 查询;O(1) 查询;O(1) 查询;O(n log n)",
    "预处理 O(n log n)。令 k=floor(log₂长度)，用左右两个 2^k 区间；重叠元素重复取 min 不改变结果。",
    "两条长尺从两端伸入，重叠部分不影响最小值。",
  ],
  [
    "kd-tree",
    "k-d 树",
    "k-d Tree",
    "structures",
    "交替沿坐标轴分割点集，最近邻查询先走近侧，再判断远侧是否可能更优。",
    "多维二叉划分在 1970 年代形成 k-d 树，用于空间检索。",
    "低维最近邻、碰撞候选、空间索引",
    "切分平面两侧分别满足当前轴的大小关系",
    "高维会退化；必须用切分距离的下界判断是否回溯。",
    "O(log n) 理想查询;依赖点分布与维数;O(n) 查询;O(n)",
    "本实验每层排序选中位数，建树 O(n log² n)；平衡树不保证最近邻查询最坏对数。",
    "先按东西分区，再按南北分区，逐层缩小地图。",
  ],
  [
    "gradient-descent",
    "梯度下降",
    "Gradient Descent",
    "ai",
    "求当前损失的导数，沿负梯度方向更新参数。",
    "梯度法源于数值优化，现代机器学习依赖其批量与随机变体。",
    "线性回归、神经网络训练、参数优化",
    "参数更新方向来自同一次前向计算的梯度",
    "学习率过大可发散；训练下降不代表泛化更好。",
    "O(Tnd);O(Tnd);O(Tnd);O(nd+d)",
    "T 轮、n 个样本、d 个参数；每轮计算预测与梯度 O(nd)。本课是单参数无偏置线性回归、全批量更新。",
    "沿坡最陡的下行方向迈一小步。",
  ],
  [
    "kmeans",
    "K 均值聚类",
    "K-means",
    "ai",
    "交替把样本分配给最近中心，再把中心移动到各簇均值。",
    "Lloyd 的迭代方法成为平方误差聚类的经典算法。",
    "数据探索、向量量化、无监督分组",
    "分配与均值更新均不增加当前平方距离目标",
    "结果依赖初始化；空簇需规则处理，不能保证全局最优。",
    "O(Tnkd);O(Tnkd);O(Tnkd) 给定迭代上限;O(nd+kd+n)",
    "T 轮、n 样本、k 簇、d 维；分配距离是主成本。实验用固定中心与保留空簇中心策略。",
    "围绕集合点分组，再把集合点移到组员的中心。",
  ],
  [
    "knn",
    "K 近邻分类",
    "k-Nearest Neighbors",
    "ai",
    "计算查询点到所有样本的距离，选最近 k 个进行多数投票。",
    "近邻判别是非参数学习的经典方法。",
    "相似案例分类、检索基线、小型数据集",
    "只使用最近的 k 个训练样本决定类别",
    "特征尺度与 k 改变结果；本课平票按较小类别确定。",
    "O(nd+n log n);O(nd+n log n);O(nd+n log n);O(n)",
    "本课显式计算并排序全部距离；可用大小 k 的堆优化为 O(nd+n log k)，但不是当前实现。",
    "询问距离你最近的几个邻居。",
  ],
  [
    "perceptron",
    "感知机",
    "Perceptron",
    "ai",
    "错分样本才更新权重，用线性边界分开两类点。",
    "Rosenblatt 的感知机是早期可学习线性分类器。",
    "线性分类、在线学习、可分性教学",
    "对错分样本执行 w←w+yx，b←b+y",
    "收敛定理要求线性可分；XOR 等数据不能由单一超平面分开。",
    "O(nd) 一轮;依赖间隔与可分性;O(Tnd) 给定轮数;O(d)",
    "实验限制最多 12 轮；每个样本点积与更新 O(d)。迭代上限结束不自动意味着收敛。",
    "错判一次就往纠正方向推一下分界线。",
  ],
  [
    "decision-tree",
    "决策树与基尼划分",
    "Decision Tree / CART",
    "ai",
    "尝试阈值，选择加权基尼不纯度最低的划分并递归建树。",
    "CART 将分类与回归的二叉树方法系统化，常用基尼指标处理分类。",
    "可解释分类、规则提取、集成学习基础",
    "每次划分只使用当前节点中的训练样本",
    "低训练误差不代表泛化；实际需要深度、叶样本数或剪枝约束。",
    "O(n²) 本课;O(n² log n) 平衡形状;O(n³) 本课最坏;O(n²) 递归样本副本",
    "本课单特征、逐阈值重新扫描样本，节点成本 O(m²)；生产实现会排序并维护统计量。",
    "每次选择最有区分力的一个是非问题。",
  ],
  [
    "backprop",
    "反向传播",
    "Backpropagation",
    "ai",
    "保存前向中间值，再沿计算图反向应用链式法则求导。",
    "反向模式自动微分与神经网络训练共同推动了反向传播的应用。",
    "神经网络梯度、可微计算、自动微分",
    "每条边贡献局部导数乘上游梯度，多路径贡献相加",
    "反向传播是求梯度，不是参数更新本身；两者需要区分。",
    "O(E);O(E);O(E);O(V+E)",
    "计算图 V 个节点 E 条依赖边，前向与反向各线性遍历。本课计算 L=(sigmoid(wx+b)−y)²/2，随后一次梯度更新。",
    "先算总价，再追问每个小变化会让总价变多少。",
  ],
  [
    "attention",
    "缩放点积注意力",
    "Scaled Dot-Product Attention",
    "ai",
    "计算 QKᵀ/√d，按行 softmax 得到权重，再加权汇总 V。",
    "2017 年 Transformer 工作系统使用缩放点积注意力。",
    "上下文信息聚合、Transformer、序列建模",
    "每行未屏蔽的权重非负且和为 1",
    "权重不是因果解释；实验未包含多头、掩码、位置编码或完整语言模型。",
    "O(n²d);O(n²d);O(n²d);O(n²+nd)",
    "n 个 token、键与值维数为 d；两次矩阵乘法各 O(n²d)，显式存储注意力矩阵 O(n²)。",
    "每个词给其他词打相关性分数，再按比例收集信息。",
  ],
  [
    "minimax",
    "极小极大与 α–β 剪枝",
    "Minimax / Alpha-Beta",
    "ai",
    "双方轮流最大化与最小化效用，用已知上下界剪去不可能影响结果的分支。",
    "博弈树搜索是早期人工智能与计算机棋类的重要方法。",
    "对抗游戏、有限深度博弈、搜索剪枝",
    "α 是 MAX 已保证的下界，β 是 MIN 已保证的上界",
    "只有 α≥β 才可剪；搜索顺序影响效率，不改变精确根值。",
    "O(b^(d/2)) 理想排序;依赖分支顺序;O(b^d);O(d) 深搜栈",
    "b 分支因子、d 深度。实验保留整棵示意树用额外 O(b^d) 显示空间，算法递归栈仅 O(d)。",
    "一方挑最好，另一方挑最坏；已知无望的备选可以停看。",
  ],
];
export const extendedTopics: Topic[] = data.map(
  ([
    id,
    name,
    en,
    category,
    intro,
    history,
    use,
    invariant,
    caveat,
    cost,
    analysis,
    analogy,
  ]) => {
    const [best, average, worst, space] = cost.split(";");
    return {
      id,
      name,
      en,
      category: category as Topic["category"],
      level: 3,
      importance: 4,
      popularity: 3,
      intro,
      history,
      use,
      invariant,
      caveat,
      best,
      average,
      worst,
      space,
      analysis,
      analogy,
      mode: "scenario",
      input: "0",
      inputHint: "两组可复现机制场景；先看输入数据，再逐步计算",
      source:
        id === "attention"
          ? "https://arxiv.org/abs/1706.03762"
          : id === "backprop"
            ? "https://cs231n.github.io/optimization-2/"
            : category === "ai"
              ? aiSource
              : id === "sparse-table"
                ? "https://cp-algorithms.com/data_structures/sparse-table.html"
                : id === "treap"
                  ? "https://cp-algorithms.com/data_structures/treap.html"
                  : structureSource,
    };
  },
);

for (const t of extendedTopics) {
  if (t.id === "splay")
    t.source = "https://www.cs.cmu.edu/~sleator/papers/Self-Adjusting.htm";
  if (t.id === "kd-tree")
    t.source =
      "https://scikit-learn.org/stable/modules/generated/sklearn.neighbors.KDTree.html";
}

const scenarioNames: Record<string, [string, string]> = {
  "gradient-descent": ["A · 从 w=0 拟合 y=2x", "B · 从 w=4 拟合 y=3x"],
  kmeans: ["A · 两个初始中心过近", "B · 改变数据与初始中心"],
  knn: ["A · 查询 (5,4)，k=3", "B · 查询 (4,5)，k=3"],
  perceptron: ["A · AND：线性可分", "B · XOR：不可线性分离"],
  attention: ["A · 三个二维 token", "B · 改变 Q，保持 K/V"],
  backprop: ["A · 目标 1，正向误差", "B · 目标 0，反向误差"],
  minimax: ["A · 观察剪枝", "B · 改变叶子效用"],
  "persistent-segment": ["A · 两次路径复制", "B · 修改不同位置"],
  "lazy-segment": ["A · 整段 +3，子段 +2", "B · 整段 +2，子段 +3"],
};
for (const t of extendedTopics) {
  t.scenarios = scenarioNames[t.id];
  if (["gradient-descent", "kmeans", "knn", "perceptron"].includes(t.id))
    t.level = 2;
  if (["gradient-descent", "attention", "backprop"].includes(t.id)) {
    t.importance = 5;
    t.popularity = 5;
  }
}
