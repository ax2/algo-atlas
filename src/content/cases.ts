export const cases = [
  {
    id: "routes",
    title: "城市里的最短一程",
    en: "Route planning",
    description: "从“少换乘”到“最短耗时”，同一个地图，目标不同，算法就不同。",
    icon: "route",
    level: "进阶",
    lessons: ["graph", "bfs", "dijkstra", "heap", "astar"],
    steps: [
      "用邻接表建模路网",
      "分别计算跳数与权重代价",
      "讨论优先队列与启发式",
    ],
    constraint:
      "BFS 优化边数，Dijkstra 优化非负权重总和。A* 的启发式还需要可采纳性或一致性条件。",
    challenge: "如果给道路加入负权优惠，Dijkstra 还能直接使用吗？",
    answer:
      "不能。负权破坏“已确定最小距离不会再下降”的证明，可改用 Bellman–Ford，并检查负环。",
  },
  {
    id: "cache",
    title: "一次请求的缓存之旅",
    en: "Cache & membership",
    description: "让布隆过滤器挡住不存在的键，让 LRU 为热点数据留下空间。",
    icon: "database",
    level: "进阶",
    lessons: ["hash-table", "linked-list", "lru", "bloom"],
    steps: [
      "过滤明确不存在的请求",
      "检查 LRU 并更新访问次序",
      "回源后写入并淘汰旧条目",
    ],
    constraint:
      "布隆过滤器只能预筛；误报要回源确认。LRU 的容量与访问局部性共同决定命中率。",
    challenge: "过滤器说“可能存在”时，能直接把数据返回给用户吗？",
    answer: "不能。它不保存原始记录，而且可能误报；仍要查缓存或真实数据源。",
  },
  {
    id: "scheduler",
    title: "把混乱任务排成秩序",
    en: "Dependency scheduling",
    description: "依赖决定能否开工，资源约束决定何时开工。先把问题分清楚。",
    icon: "workflow",
    level: "进阶",
    lessons: ["topological", "queue", "heap", "greedy"],
    steps: [
      "建立任务依赖图",
      "用拓扑排序检测环并给出合法顺序",
      "另用区间调度选择互不冲突的预约",
    ],
    constraint:
      "拓扑序只解决先后约束；它不自动优化多核完工时间。带权或多资源调度需要更丰富模型。",
    challenge: "为什么不能简单地按任务时长排序来满足依赖？",
    answer:
      "时长排序不包含前驱关系，可能先安排尚未满足前置条件的任务。必须先维护可执行任务集合。",
  },
  {
    id: "budget",
    title: "有限预算，如何选得更好",
    en: "Resource allocation",
    description:
      "看起来最划算的一件，不一定组成最划算的一组。亲手比较贪心与动态规划。",
    icon: "briefcase",
    level: "进阶",
    lessons: ["greedy", "knapsack", "coin-change"],
    steps: [
      "定义重量、价值与容量",
      "运行单位价值贪心作为基线",
      "用 0/1 背包验证全局最优",
    ],
    constraint:
      "分数背包可按价值密度贪心；物品不可拆分时需要不同证明或算法。容量大时还要考虑状态压缩。",
    challenge: "为什么 0/1 背包的一维 DP 要逆序遍历容量？",
    answer:
      "正序可能读取本轮已经更新的状态，重复使用同一物品，变成完全背包的语义。",
  },
  {
    id: "search",
    title: "做一个懂前缀的搜索器",
    en: "Search architecture",
    description:
      "先完成前缀补全，再检索正文；不同数据规模与匹配语义，需要不同结构。",
    icon: "search",
    level: "基础",
    lessons: ["trie", "hash-table", "kmp", "suffix-array"],
    steps: [
      "用 Trie 组织检索词前缀",
      "用 KMP 在正文找到完整匹配",
      "按是否重复查询选择预处理索引",
    ],
    constraint:
      "前缀、子串和模糊相似是三种不同需求。真实搜索还涉及分词、倒排索引、排序与更新一致性。",
    challenge: "把所有词放入哈希表，为什么不能直接高效回答任意前缀查询？",
    answer:
      "哈希散列破坏了共同前缀的局部关系；完整键查询快，不代表前缀枚举快。可以使用 Trie 或有序范围索引。",
  },
  {
    id: "diff",
    title: "两段文字之间发生了什么",
    en: "Text comparison",
    description: "从共同内容到修改代价，用两个二维 DP 模型理解版本差异。",
    icon: "git",
    level: "进阶",
    lessons: ["lcs", "edit-distance", "hash-table"],
    steps: [
      "用 LCS 衡量保留的顺序结构",
      "用编辑距离计量插入、删除、替换",
      "考虑分词、回溯与大文件优化",
    ],
    constraint:
      "这里按字符计算；实际文档常按行或词比较。最优对齐可能不唯一，长度相同不等于变更内容相同。",
    challenge: "能否直接把 n+m−2×LCS 当成允许替换时的编辑距离？",
    answer:
      "不能。这个式子对应仅插入和删除；若一次替换成本为 1，两个字符不同可用一次替换，而删加需要两次。",
  },
];
