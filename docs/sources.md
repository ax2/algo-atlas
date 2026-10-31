# 资料与内容口径

## 2026-10-31 · AI 综合专题

- [PyTorch 训练优化](https://docs.pytorch.org/tutorials/beginner/basics/optimization_tutorial.html)：前向、损失、清零梯度、反向与优化更新。
- [Harvard Annotated Transformer](https://nlp.seas.harvard.edu/annotated-transformer/) 与 [原始论文](https://arxiv.org/abs/1706.03762)：多头注意力、掩码、残差、位置编码与训练。本站另明确采用单层 decoder-only Pre-LN 教学变体，非完整论文复现。
- [OpenAI Spinning Up 基本概念](https://spinningup.openai.com/en/latest/spinningup/rl_intro.html) 与 [Q-learning/Bellman 方程章节](https://spinningup.openai.com/en/latest/algorithms/ddpg.html#the-q-learning-side-of-ddpg)：状态动作、回报、自举和终止项；本站实际实现的是离散表格 Q-learning，不是 DDPG。
- 1986 年反向传播历史链接保留 Nature DOI 入口；该网站本次要求跳转身份域，未声称获取全文。Sutton/Barto 官方 PDF 本次抓取失败，强化学习公式以已取得的一手文档交叉核验。

以下为早期单元资料记录。

2026-10-30 核查以下教材/维护者入口。课程中文说明、类比与实验代码独立编写；未复制教材正文或第三方算法实现。

- [Princeton Algorithms, 4th Edition](https://algs4.cs.princeton.edu/home/)：课程范围、排序/查找/图/字符串的组织入口。
- [Open Data Structures](https://opendatastructures.org/)：线性结构、平衡树、跳表、散列、堆、B 树的参考教材入口。
- [CP-Algorithms](https://cp-algorithms.com/)：动态规划、字符串、数学、几何与图算法的进一步阅读入口。

历史介绍采用教科书中普遍使用的简短发展背景，未核实到原始文献页码的条目不提供伪造页码或直接引文。通用数据结构不声称由一个人独立发明。后续专业审稿可逐项加入原始论文链接与定理证明。

## 容易混淆的实现口径

- 快排：Lomuto 类末尾基准，允许重复值，平均界依赖随机排列假设；无随机化保护。
- 希尔：二分增量，不套用其他增量序列界。
- Dijkstra：线性选点，O(V²+E)；A* 的本实验使用 h=0。
- Prim：逐轮扫描边，O(VE)，并列出矩阵与堆优化版。
- Huffman：线性选最小，O(n+σ²)；教材堆版本为 O(n+σ log σ)。
- 后缀数组：显式后缀 + 插入排序，最坏字符比较 O(n³)，不冒充倍增或线性构造。
- LRU：实际机制轨迹用数组展现次序，期望 O(1) 理论对应哈希 + 双链表。
- 栈/队列的实验数组拷贝是教学开销，理论对应规定的容器实现。
- 图/树图中的位置是布局坐标，不是真实内存地址。

评级解释：难度是学习所需前置知识；重要性是其在后续课程中的基础作用；常用度是教学编辑对通用工程中的适用广度判断。不提供虚构调查比例或实时热门榜。

## Stage 003 扩展资料（2026-10-30 核查）

- [Princeton 左倾红黑树](https://algs4.cs.princeton.edu/33balanced/)：旋转与颜色翻转的性质核对。
- [Sleator / Tarjan 原始 Splay 论文入口](https://www.cs.cmu.edu/~sleator/papers/Self-Adjusting.htm)：摊还界与单次界的区分。
- [CP-Algorithms Treap](https://cp-algorithms.com/data_structures/treap.html)、[Segment Tree](https://cp-algorithms.com/data_structures/segment_tree.html)、[Sparse Table](https://cp-algorithms.com/data_structures/sparse-table.html)：机制与复杂度核对。
- [scikit-learn 分类树](https://scikit-learn.org/stable/modules/tree.html)、[聚类](https://scikit-learn.org/stable/modules/clustering.html)、[近邻](https://scikit-learn.org/stable/modules/neighbors.html)：算法前提与工程边界。
- [Stanford CS231n 反向传播](https://cs231n.github.io/optimization-2/)：链式法则与计算图。
- [Attention Is All You Need](https://arxiv.org/abs/1706.03762)：缩放点积注意力公式及来源。

课程文字、题目与参考实现均独立编写。没有复制外部竞赛题库题面；这些题是原创训练，不冒称某赛事真题。
