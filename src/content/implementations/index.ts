export type Implementation = {
  id: string;
  scope: string;
  pseudocode: string;
  javascript: string;
  python: string;
  examples: { args: unknown[]; answer: unknown }[];
};
const sources = import.meta.glob<string>("./*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
});
const codes: Record<string, { javascript?: string; python?: string }> = {};
for (const [path, source] of Object.entries(sources)) {
  const language = path.endsWith(".js.txt") ? "javascript" : "python";
  const parts = source.split(/^(?:\/\/|#) @([\w-]+)\r?\n/m);
  for (let i = 1; i < parts.length; i += 2)
    (codes[parts[i]] ||= {})[language] = parts[i + 1].trim();
}
export const implementations: Record<string, Implementation> = {};
function define(
  id: string,
  scope: string,
  pseudo: string,
  args: unknown[],
  answer: unknown,
  extra: { args: unknown[]; answer: unknown }[] = [],
) {
  const code = codes[id];
  if (!code?.javascript || !code.python)
    throw new Error(`Missing implementation: ${id}`);
  implementations[id] = {
    id,
    scope,
    pseudocode: pseudo
      .split(" → ")
      .map((s, i) => `${i + 1}. ${s}`)
      .join("\n"),
    javascript: code.javascript,
    python: code.python,
    examples: [{ args, answer }, ...extra],
  };
}
const sample = [5, 1, 3, 1, 0],
  sorted = [0, 1, 1, 3, 5];
const sortPseudocode: Record<string, string> = {
  bubble: "相邻逆序则交换 → 每轮最大值沉到末尾 → 无交换时提前结束",
  selection: "扫描未排序区间找最小值 → 与区间首位交换 → 缩小未排序区间",
  insertion: "取出下一个值 → 已排序部分中比它大的值右移 → 插入空位",
  quick: "选末元素为枢轴 → 小于枢轴的值搬到左侧 → 放置枢轴并递归两侧",
  merge: "将区间平分并递归排序 → 比较两边首元素，取较小者 → 追加剩余元素",
  "heap-sort": "自底向上建最大堆 → 堆顶与末尾交换 → 缩小堆并下沉新堆顶",
  counting: "统计每个值出现次数 → 按值从小到大枚举 → 按次数输出",
  radix: "从最低位开始 → 按当前数位稳定分桶 → 顺序合并桶，处理更高位",
  shell: "设置 n/2 间隔 → 对各间隔子序列做插入排序 → 间隔减半，直到处理完 1",
};
for (const [id, pseudo] of Object.entries(sortPseudocode))
  define(
    id,
    `solve(数组) 返回升序副本，保留重复值。${id === "counting" ? "非负整数；值域大小 K；O(n+K) 时间/空间，本版输出数值，不展示记录稳定性。" : id === "radix" ? "非负安全整数；十进制 LSD 稳定分桶。" : id === "quick" ? "固定末尾枢轴，最坏 O(n²) 时间/O(n) 栈。" : id === "merge" ? "稳定归并；切片递归与结果数组需要额外存储。" : id === "shell" ? "折半增量，最坏 O(n²)，不稳定。" : "有限数值数组；教学代码复制输入需 O(n) 额外空间。"}`,
    pseudo,
    [sample],
    sorted,
    [
      { args: [[]], answer: [] },
      { args: [[2, 2, 1]], answer: [1, 2, 2] },
    ],
  );
define(
  "linear-search",
  "solve(数组,目标) 返回第一个匹配下标，不存在返回 -1。",
  "从左到右比较 → 相等立即返回下标 → 扫描完返回 -1",
  [[4, 2, 4], 4],
  0,
  [{ args: [[], 4], answer: -1 }],
);
define(
  "binary-search",
  "solve(升序数组,目标) 查找最左匹配；输入必须有序。半开区间。",
  "维护 [lo,hi) → 中点小于目标则丢弃左半 → 否则收缩右边界 → 验证 lo 是否命中",
  [[1, 2, 2, 5], 2],
  1,
  [{ args: [[1, 2], 3], answer: -1 }],
);
define(
  "quickselect",
  "solve(数组,k) 返回第 k 小（k 从 0 开始）；0≤k<n。固定枢轴最坏 O(n²)，输入副本 O(n)。",
  "分区并得到枢轴位置 p → p=k 则返回 → 仅保留包含 k 的一侧",
  [[5, 1, 3, 1], 2],
  3,
  [{ args: [[2, 2, 2], 1], answer: 2 }],
);
define(
  "array",
  "solve(数组,插入位置,值) 手动搬移并返回新数组；0≤位置≤n。O(n)。",
  "在末尾预留空间 → 从右向左搬移 → 写入目标位置",
  [[1, 3], 1, 2],
  [1, 2, 3],
  [{ args: [[], 0, 7], answer: [7] }],
);
define(
  "linked-list",
  "solve(数组) 构建单链表，再原地反转 next 指针，输出反转后的值。建表/输出 O(n)，反转本身 O(1) 辅助空间。",
  "构建 next 链 → 保存下个结点 → 当前 next 指向前驱 → 三个指针向前移动",
  [[1, 2, 3]],
  [3, 2, 1],
  [{ args: [[]], answer: [] }],
);
const operations = [
  ["push", 1],
  ["push", 2],
  ["peek"],
  ["pop"],
  ["pop"],
  ["pop"],
];
define(
  "stack",
  "solve(操作列表) 支持 push/pop/peek；返回读取结果，空栈返回 null / None。",
  "push 追加到栈顶 → peek 读取末尾 → pop 移除末尾",
  [operations],
  [2, 2, 1, null],
);
define(
  "queue",
  "solve(操作列表) 支持 push/pop/peek；空队列返回 null / None。JS 用 head 游标，示例批次结束释放数组，长期运行需定期压缩已出队前缀。",
  "入队放末尾 → 出队取 head → head 前移，禁止重复处理",
  [operations],
  [1, 1, 2, null],
);
define(
  "deque",
  "solve(操作列表) 支持 pushLeft/pushRight/popLeft/popRight，空端返回 null / None。",
  "两端分别维护位置 → 指定端入队 → 指定端取值并移除",
  [[["pushRight", 2], ["pushLeft", 1], ["popRight"], ["popLeft"], ["popLeft"]]],
  [2, 1, null],
);
define(
  "hash-table",
  "solve(操作列表) ASCII 字符串键，set/get/delete；固定 17 桶链地址法，未实现扩容，最坏 O(n)，值不能用 null 表示有效数据。",
  "计算桶号 → 桶内按完整键查找 → 插入或更新 / 读取 / 删除",
  [
    [
      ["set", "a", 1],
      ["set", "r", 2],
      ["set", "a", 3],
      ["get", "r"],
      ["get", "a"],
      ["delete", "a"],
      ["get", "a"],
    ],
  ],
  [2, 3, null],
);
define(
  "bst",
  "solve(插入键,查询键) 构建集合型 BST 并查询；重复键忽略；不含删除。最坏 O(n) 单次。",
  "按大小递归插入 → 相等忽略 → 查询沿左右子树向下",
  [
    [3, 1, 4, 1],
    [1, 2, 4],
  ],
  [true, false, true],
);
define(
  "avl",
  "solve(插入键) 集合型 AVL 插入，返回 [键,左,右,高度]；空树 null。包含 LL/LR/RL/RR，不含删除。",
  "BST 插入 → 自底向上更新高度 → 检查平衡因子 → 单旋或双旋并更新高度",
  [[3, 1, 2]],
  [2, [1, null, null, 1], [3, null, null, 1], 2],
  [{ args: [[]], answer: null }],
);
define(
  "red-black",
  "solve(插入键) 左倾红黑树 LLRB 集合插入，返回 [键,左,右,R/B]；不含删除。",
  "插入红结点 → 右红左黑则左旋 → 连续左红则右旋 → 双红孩子翻色 → 根染黑",
  [[3, 1, 2]],
  [2, [1, null, null, "B"], [3, null, null, "B"], "B"],
  [{ args: [[]], answer: null }],
);
define(
  "heap",
  "solve(数组) 逐个插入小根堆，再连续弹出最小值；O(n log n)，不依赖库堆。",
  "插入末尾并上浮 → 取出根 → 末值补根并下沉 → 重复直到堆空",
  [sample],
  sorted,
  [{ args: [[]], answer: [] }],
);
define(
  "trie",
  "solve(单词列表,查询列表) 查询形如 [word/prefix,文本]；支持插入、完整词和前缀检索，不含删除。",
  "按字符扩展路径 → 末节点标记词尾 → 查询逐字符走边 → 检查词尾或前缀模式",
  [
    ["cat", "car"],
    [
      ["word", "ca"],
      ["prefix", "ca"],
      ["word", "cat"],
    ],
  ],
  [false, true, true],
);
define(
  "union-find",
  "solve(n,合并对,查询对) 元素为 0…n-1，按大小合并并路径压缩。返回连通性。",
  "find 递归找根并压缩路径 → 小集合挂到大集合 → 根相同即连通",
  [
    4,
    [
      [0, 1],
      [1, 2],
    ],
    [
      [0, 2],
      [0, 3],
    ],
  ],
  [true, false],
);
define(
  "fenwick",
  "solve(数组,操作)；add(index,delta)，sum(l,r) 为 [l,r)；合法 0 基下标。O(log n) 每次操作。",
  "沿 i+=lowbit(i) 更新 → 沿 i-=lowbit(i) 求前缀 → 区间和=前缀(r)-前缀(l)",
  [
    [1, 2, 3],
    [
      ["sum", 0, 3],
      ["add", 1, 5],
      ["sum", 1, 3],
    ],
  ],
  [6, 10],
);
define(
  "segment-tree",
  "solve(数组,操作)；set(index,value)，sum(l,r) 为 [l,r)。迭代线段树，O(log n) 每次操作。",
  "叶子存值，自底向上求和 → 点更新后重算祖先 → 区间两端向上聚合",
  [
    [1, 2, 3],
    [
      ["sum", 0, 3],
      ["set", 1, 5],
      ["sum", 1, 3],
    ],
  ],
  [6, 8],
);
define(
  "skip-list",
  "solve(键,高度,查询) 插入和查找；每个高度 1…4，重复忽略。固定高度方便复现，不构成随机期望保证；不含删除。",
  "高层向右、受阻向下 → 记录各层前驱 → 在指定高度接入新结点 → 同法查询",
  [
    [3, 1, 5],
    [1, 3, 2],
    [1, 4, 5],
  ],
  [true, false, true],
);
define(
  "b-tree",
  "solve(键,查询) t=2 B 树插入和查找；最多 3 键、4 孩子，重复忽略；不含删除。",
  "下降前分裂满孩子 → 中间键提升父结点 → 选择正确分支 → 叶子有序插入",
  [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [1, 6, 9],
  ],
  [true, true, false],
);
define(
  "bloom",
  "solve(已插入词,查询词) ASCII 字符串，64 位教学位图和 3 个多项式哈希；true 仅可能存在，不支持删除，不用于安全哈希。",
  "用多个哈希定位位 → 插入置 1 → 查询任何位为 0 则不存在 → 全为 1 仍可能误报",
  [
    ["cat", "dog"],
    ["cat", "dog", "z"],
  ],
  [true, true, false],
);
define(
  "lru",
  "solve(容量,操作) set/get；缺失 null。JS Map 的插入顺序、Python OrderedDict 维护最近使用顺序；容量为非负整数。",
  "命中时移到最近端 → 写入后更新位置 → 超容量淘汰最久未使用项",
  [
    2,
    [
      ["set", "a", 1],
      ["set", "b", 2],
      ["get", "a"],
      ["set", "c", 3],
      ["get", "b"],
      ["get", "c"],
    ],
  ],
  [1, null, 3],
);
define(
  "graph",
  "solve(n,边,directed) 构建邻接表；节点 0…n-1，允许重边，保留输入顺序；无向自环记录两次。",
  "为每个点创建邻接表 → 加入 u→v → 无向图额外加入 v→u",
  [
    3,
    [
      [0, 1],
      [1, 2],
    ],
    false,
  ],
  [[1], [0, 2], [1]],
);
define(
  "treap",
  "solve(键,优先级,查询) BST 键 + 小根堆优先级插入与查询；重复键忽略。给定优先级可复现，随机期望界要求独立随机优先级。",
  "按 BST 插入 → 子优先级更小则旋转上提 → 沿 BST 查询",
  [
    [3, 1, 5],
    [5, 2, 7],
    [1, 2, 5],
  ],
  [true, false, true],
);
define(
  "splay",
  "solve(插入键,访问键) 插入并伸展；返回每次访问后的根键。未命中伸展最后访问节点，空树返回 null；不含删除。",
  "向目标下降 → 同向两步做 zig-zig → 反向两步做 zig-zag → 目标或最后访问点成为根",
  [
    [3, 1, 5],
    [1, 5, 3],
  ],
  [1, 5, 3],
);
define(
  "lazy-segment",
  "solve(非空数组,操作) add(l,r,delta) / sum(l,r)，半开区间；此版 O(n log n) 建树，O(log n) 操作。",
  "整段命中更新 sum 与 tag → 部分命中先下传 → 递归孩子 → 回算父 sum",
  [
    [1, 2, 3],
    [
      ["add", 0, 2, 5],
      ["sum", 0, 3],
      ["sum", 1, 2],
    ],
  ],
  [16, 7],
);
define(
  "persistent-segment",
  "solve(非空数组,更新,查询)。更新 [基版本,下标,新值] 产生新版本；查询 [版本,l,r)；初始版本 0，历史只读，O(log n) 新结点/更新。",
  "从指定旧根出发 → 只复制修改路径 → 未改子树共享 → 保存新根 → 用任一版本根求和",
  [
    [1, 2, 3],
    [
      [0, 1, 9],
      [0, 0, 5],
    ],
    [
      [0, 0, 3],
      [1, 0, 3],
      [2, 0, 3],
    ],
  ],
  [6, 13, 10],
);
define(
  "sparse-table",
  "solve(非空数组,区间) 静态最小值；0≤l<r≤n，半开区间；O(n log n) 预处理、O(1) 查询，不支持修改。",
  "存所有 2^k 区间最小值 → k=floor(log2(区间长)) → 取左右两个可重叠块的最小值",
  [
    [5, 2, 7, 1],
    [
      [0, 3],
      [1, 4],
    ],
  ],
  [2, 1],
);
define(
  "kd-tree",
  "solve(二维点,查询点) 建树并找最近点下标；平方距离相同取最小原始下标；空集 -1。排序建树 O(n log²n)，查询最坏 O(n)。",
  "按轴交替取中位数建树 → 先搜索近侧 → 更新最优距离 → 分割平面仍可能更优则搜远侧",
  [
    [
      [0, 0],
      [3, 4],
      [1, 1],
    ],
    [2, 2],
  ],
  2,
  [{ args: [[], [0, 0]], answer: -1 }],
);
const adj = [[1, 2], [3], [3], []];
define(
  "bfs",
  "solve(邻接表,起点) 返回从起点可达部分的 BFS 顺序，入队即标记；不自动遍历其他分量。",
  "起点入队并标记 → 出队访问 → 未访问邻居标记并入队 → 队列空则结束",
  [adj, 0],
  [0, 1, 2, 3],
);
define(
  "dfs",
  "solve(邻接表,起点) 显式栈 DFS，入栈即标记；按邻接顺序压栈，因此后压入者先访问。",
  "起点入栈并标记 → 弹栈访问 → 未访问邻居入栈 → 栈空则结束",
  [adj, 0],
  [0, 2, 3, 1],
);
const edges = [
  [0, 1, 2],
  [0, 2, 6],
  [1, 2, 1],
];
define(
  "dijkstra",
  "solve(n,有向带权边,起点) 非负权；返回距离，不可达 null。线性选最小 + 邻接表，O(V²+E)。",
  "距离初始 ∞，起点 0 → 选未确定的最小距离点 → 用它松弛出边 → 重复直到无可达候选",
  [4, edges, 0],
  [0, 2, 3, null],
);
define(
  "bellman-ford",
  "solve(n,有向边,起点) 支持负边；检测起点可达负环，有负环时不返回误导性有限距离。",
  "至多 V-1 轮松弛所有边 → 无变化提前结束 → 再检验是否仍能松弛 → 报告可达负环",
  [
    3,
    [
      [0, 1, 2],
      [1, 2, -3],
    ],
    0,
  ],
  { negativeCycle: false, distances: [0, 2, -1] },
  [
    {
      args: [
        2,
        [
          [0, 1, -1],
          [1, 0, -1],
        ],
        0,
      ],
      answer: { negativeCycle: true, distances: null },
    },
  ],
);
define(
  "floyd",
  "solve(n,有向边) 返回全源距离，不可达 null；发现任一负环则 distances=null。允许平行边取最小权。",
  "初始化直达距离 → 逐个允许中转点 k → d[i][j]=min(d[i][j],d[i][k]+d[k][j]) → 对角线负数意味着负环",
  [3, edges],
  {
    negativeCycle: false,
    distances: [
      [0, 2, 3],
      [null, 0, 1],
      [null, null, 0],
    ],
  },
);
define(
  "topological",
  "solve(邻接表) Kahn 拓扑排序；有环返回 null。初始零入度点按下标入队。",
  "计算入度并将零入度点入队 → 出队输出 → 邻居入度减一 → 新零入度点入队 → 输出不足 V 则有环",
  [adj],
  [0, 1, 2, 3],
  [{ args: [[[1], [0]]], answer: null }],
);
define(
  "kruskal",
  "solve(n,无向带权边) 返回最小生成森林的边、总权与 connected；每条边仅给一次。",
  "边按权排序 → 并查集检查是否同分量 → 不同则选边并合并 → 检查是否达到 V-1 条",
  [3, edges],
  {
    weight: 3,
    edges: [
      [1, 2, 1],
      [0, 1, 2],
    ],
    connected: true,
  },
);
define(
  "prim",
  "solve(n,无向带权边) 从节点 0 扩展；断开时返回当前分量权和 connected=false；扫描割边 O(VE)。",
  "初始集合含 0 → 找跨越集合的最小边 → 将新节点加入 → 无割边则报告不连通",
  [3, edges],
  { weight: 3, connected: true },
  [{ args: [3, [[0, 1, 2]]], answer: { weight: 2, connected: false } }],
);
define(
  "astar",
  "solve(n,有向非负边,start,goal,h)。要求一致启发式且 h(goal)=0；返回路径和代价；线性开放集，O(V²+VE)。h=0 退化 Dijkstra。",
  "按 g+h 选开放节点 → 弹出目标即完成 → 改善邻居 g 并记录前驱 → 一致启发式下关闭节点不必重开",
  [3, edges, 0, 2, [3, 1, 0]],
  { cost: 3, path: [0, 1, 2] },
);
define(
  "scc",
  "solve(有向邻接表) Kosaraju 两遍 DFS；输出分量内部和分量列表排序后结果；递归栈最坏 O(V)。",
  "原图 DFS 按完成顺序入表 → 转置所有边 → 逆完成顺序 DFS → 每次搜索得到一个强连通分量",
  [[[1], [0, 2], [3], [2]]],
  [
    [0, 1],
    [2, 3],
  ],
);
define(
  "max-flow",
  "solve(n,有向容量边,source,sink) Edmonds–Karp；非负容量，源汇不同；平行容量相加。矩阵 BFS 每轮 O(V²)，总计 O(V³E) 上界。",
  "BFS 搜残量正的增广路 → 找路径瓶颈 → 正向减、反向加 → 累计流量 → 不存在增广路即停止",
  [
    4,
    [
      [0, 1, 3],
      [0, 2, 2],
      [1, 2, 1],
      [1, 3, 2],
      [2, 3, 3],
    ],
    0,
    3,
  ],
  5,
);
define(
  "prefix-sum",
  "solve(数组,查询)；查询 [l,r) 为半开区间，0≤l≤r≤n。预处理 O(n)，每次 O(1)。",
  "prefix[0]=0 → 逐项累加 → 用 prefix[r]-prefix[l] 回答",
  [
    [1, 2, 3],
    [
      [0, 3],
      [1, 2],
      [2, 2],
    ],
  ],
  [6, 2, 0],
);
define(
  "two-pointers",
  "solve(升序数组,目标和) 返回一对不同下标，无解 []；必须已排序。",
  "左右指针夹住数组 → 和小则左移进，和大则右退 → 命中返回 → 相遇则无解",
  [[1, 2, 4, 7], 6],
  [1, 2],
);
define(
  "sliding-window",
  "solve(数组,k) 固定窗口最大和；1≤k≤n，支持负数。",
  "加入新元素 → 移除离窗元素 → 窗口完整时更新最大和",
  [[-2, -1, -3], 2],
  -3,
);
define(
  "monotonic-stack",
  "solve(数组) 返回每项右侧第一个严格更大值的下标；不存在 -1。",
  "维护未解决下标递减栈 → 新值更大时弹栈并填写答案 → 当前下标入栈",
  [[2, 1, 2, 4, 3]],
  [3, 2, 3, -1, -1],
);
define(
  "fibonacci",
  "solve(n) 返回 F(n)，F(0)=0、F(1)=1；自顶向下记忆化，O(n) 时间/缓存/递归栈；双语言对照限定整数 0≤n≤78（JS 安全整数）。",
  "缓存命中直接返回 → 否则递归 F(n-1) 与 F(n-2) → 求和写入缓存 → 返回结果",
  [10],
  55,
  [{ args: [0], answer: 0 }],
);
define(
  "knapsack",
  "solve(正整数重量,价值,非负容量) 0/1 背包最大价值；每件最多一次，允许不选；两数组等长。",
  "dp 初始 0 → 逐件枚举 → 容量倒序更新 max(dp[c],dp[c-w]+v)",
  [[2, 3, 4], [3, 4, 5], 5],
  7,
);
define(
  "coin-change",
  "solve(正整数币值,非负金额) 无限使用硬币的最少枚数；无解 -1。",
  "dp[0]=0，其余 ∞ → 按金额递增 → 枚举最后一枚硬币 → 返回最小数量",
  [[1, 3, 4], 6],
  2,
  [{ args: [[2], 3], answer: -1 }],
);
define(
  "lcs",
  "solve(ASCII 字符串 a,b) 返回最长公共子序列长度（不要求连续）；O(nm) 时间/空间。",
  "相等则左上+1 → 不等则取上、左最大 → 返回右下格",
  ["abcde", "ace"],
  3,
  [{ args: ["", "abc"], answer: 0 }],
);
define(
  "edit-distance",
  "solve(ASCII 字符串 a,b) Levenshtein 距离；插删改各成本 1，O(nm) 时间/空间。",
  "空串边界为长度 → 枚举删除、插入、替换/匹配 → 每格取最小",
  ["kitten", "sitting"],
  3,
);
define(
  "lis",
  "solve(数组) 严格递增子序列长度；tails+二分，O(n log n)。tails 不是原数组中的完整答案路径。",
  "为每个长度保留最小结尾 → 二分首个 ≥x 的位置 → 替换或追加 x → tails 长度即答案",
  [[3, 1, 2, 2, 4]],
  3,
);
define(
  "backtracking",
  "solve(n) 枚举 n 皇后所有解；每个解是逐行列下标，n≥0；演示建议 n≤8。",
  "按行尝试列 → 排除同列和两条对角线 → 放置并递归 → 撤销状态 → 放满则记录",
  [4],
  [
    [1, 3, 0, 2],
    [2, 0, 3, 1],
  ],
);
define(
  "greedy",
  "solve(区间列表) 选最多互不重叠活动；半开区间 start<end，允许首尾相接；返回原下标。",
  "按结束时间排序 → 能接上上一个结束时间则选择 → 更新结束时间",
  [
    [
      [0, 3],
      [1, 2],
      [2, 4],
      [3, 5],
    ],
  ],
  [1, 2],
);
for (const id of ["naive-match", "kmp", "rabin-karp"])
  define(
    id,
    `solve(文本,模式) 返回所有匹配起点，允许重叠；限定 ASCII，空模式匹配 n+1 个边界。${id === "rabin-karp" ? "滚动哈希后逐字验证；碰撞或大量匹配时最坏 O(nm)。" : ""}`,
    id === "kmp"
      ? "预处理模式最长相等前后缀 pi → 失配时 j=pi[j-1]，文本不回退 → 完整匹配后记录并继续回退找重叠"
      : id === "rabin-karp"
        ? "计算模式和首窗口哈希 → 哈希相等时逐字确认 → 移除旧字符贡献并加入新字符"
        : "枚举所有起点 → 逐字符比较 → 全部相同则记录",
    ["ababa", "aba"],
    [0, 2],
    [{ args: ["abc", ""], answer: [0, 1, 2, 3] }],
  );
define(
  "z-function",
  "solve(ASCII 字符串) 返回 Z 数组，z[0]=0。本实现是 Z 原语；课程匹配实验对 模式+分隔符+文本 使用该原语。",
  "复用已知匹配区间 [l,r) → 从边界继续比较 → 延长最右匹配区间",
  ["aabcaab"],
  [0, 1, 0, 0, 3, 1, 0],
);
define(
  "suffix-array",
  "solve(ASCII 字符串) 按后缀字典序输出起点；直观排序版，非倍增算法。最坏 O(n² log n) 字符比较上界，Python 缓存切片需 O(n²) 空间。",
  "枚举后缀起点 → 以整个后缀为排序键 → 输出排序后的起点",
  ["banana"],
  [5, 3, 1, 0, 4, 2],
);
define(
  "huffman",
  "solve(ASCII 文本) 返回码表、编码位串、解码文本；同频稳定选择，单字符编码为 0，空串可用。每轮排序森林的简洁版，O(k² log k+nL)，k 为字符种类、L 为最大码长；位串不含码表开销。",
  "统计频率 → 取两个最小树合并 → 左 0 右 1 得码表 → 逐字编码 → 按前缀解码验证",
  ["aaabbc"],
  {
    codes: { a: "0", c: "10", b: "11" },
    encoded: "000111110",
    decoded: "aaabbc",
  },
  [
    {
      args: ["aaaa"],
      answer: { codes: { a: "0" }, encoded: "0000", decoded: "aaaa" },
    },
    { args: [""], answer: { codes: {}, encoded: "", decoded: "" } },
  ],
);
define(
  "gcd",
  "solve(a,b) 整数，返回非负最大公约数；约定 gcd(0,0)=0。",
  "取绝对值 → (a,b)←(b,a mod b) → b=0 时返回 a",
  [48, 18],
  6,
  [{ args: [0, 0], answer: 0 }],
);
define(
  "sieve",
  "solve(n) 返回 ≤n 的质数，n 为非负整数，O(n log log n) 时间/O(n) 空间。",
  "从 2 枚举未标记数 → 从 p² 起标记倍数 → 收集未标记数",
  [12],
  [2, 3, 5, 7, 11],
);
define(
  "fast-power",
  "solve(base,exponent,modulus) 整数；exponent≥0，modulus>0；参数与结果须为 JS 安全整数，JS 中间乘法使用 BigInt 防溢出。",
  "结果设为 1 mod m → 指数奇数则乘底数 → 底数平方、指数折半 → 指数为 0 返回",
  [3, 13, 17],
  12,
  [{ args: [5, 0, 1], answer: 0 }],
);
define(
  "bitmask",
  "solve(n) 枚举集合 {0,…,n-1} 的所有子集，按掩码升序；0≤n≤20，输出本身 O(n·2ⁿ)。",
  "枚举 0…2ⁿ-1 → 第 i 位为 1 则选择 i → 记录子集",
  [2],
  [[], [0], [1], [0, 1]],
);
define(
  "convex-hull",
  "solve(二维点集) Andrew 单调链；去重，排除边上中间共线点；逆时针顶点从字典序最小点开始，不重复首点。",
  "按坐标排序去重 → 下链非左转时弹出 → 逆序构建上链 → 去除重复端点并连接",
  [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0.5, 0.5],
    ],
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ],
);
define(
  "gradient-descent",
  "solve(start,target,rate,steps) 对 L=(w-target)² 做固定步长梯度下降；返回更新后参数和损失。0<rate<1 才有收敛保证。",
  "计算梯度 2(w-target) → w←w-rate·梯度 → 记录更新后损失",
  [0, 2, 0.25, 2],
  [
    { w: 1, loss: 1 },
    { w: 1.5, loss: 0.25 },
  ],
);
define(
  "kmeans",
  "solve(点集,初始中心,轮数) Lloyd 聚类；同维非空点和中心，空簇保留原中心，返回最终中心及重新分配标签。O(rounds·n·k·d)。",
  "分配到最近中心 → 各簇求均值 → 空簇保留中心 → 重复后用最终中心重新分配",
  [[[0], [2], [8], [10]], [[0], [10]], 2],
  { centers: [[1], [9]], labels: [0, 0, 1, 1] },
);
define(
  "knn",
  "solve(点集,整数标签,查询,k) 1≤k≤n；平方欧氏距离，距离相同按输入序，投票平局选小标签；排序版 O(nd+n log n)。",
  "计算到样本的距离 → 排序取最近 k 个 → 计票 → 按票数、标签打破平局",
  [[[0], [1], [9]], [0, 0, 1], [2], 2],
  0,
);
define(
  "perceptron",
  "solve(非空点集,±1 标签,最大轮数) 学习率 1，权重偏置初始 0；边界 score=0 也更新，不保证非线性可分数据收敛。",
  "逐样本计算 score → y·score≤0 则 w+=y·x,b+=y → 一轮无错或达到上限结束",
  [[[-1], [1]], [-1, 1], 10],
  { weights: [2], bias: 0, predictions: [-1, 1] },
);
define(
  "decision-tree",
  "solve(一维特征,整数标签,查询) 递归 CART 分类树；按加权 Gini 选择阈值，无剪枝；同特征冲突用多数票，小标签优先。教学穷举版最坏 O(n³)。",
  "枚举相邻特征中点 → 选择加权 Gini 最小划分 → 递归左右子集 → 纯节点或不可分则停止",
  [
    [0, 1, 4, 5],
    [0, 0, 1, 1],
    [0.5, 4.5],
  ],
  [0, 1],
);
define(
  "backprop",
  "solve(x,target,w1,w2,rate) 一个 sigmoid 隐藏神经元 + 线性输出；无偏置，半平方误差；返回更新前预测/梯度及一次 SGD 后权重。完整多层训练见综合专题。",
  "前向算隐藏值与预测 → 求输出误差 → 链式法则回传两个梯度 → 同时更新权重",
  [1, 1, 0, 2, 0.1],
  { prediction: 1, loss: 0, grad1: 0, grad2: 0, weights: [0, 2] },
);
define(
  "attention",
  "solve(Q,K,V,causal) 单头缩放点积注意力；形状兼容且非空，因果模式要求自注意力序列等长。稳定 softmax；不含投影参数更新，完整 Transformer 见综合专题。",
  "QKᵀ/√d → 未来位置屏蔽为 -∞ → 减行最大值后 softmax → 权重乘 V",
  [[[0], [0]], [[0], [0]], [[2], [6]], true],
  {
    weights: [
      [1, 0],
      [0.5, 0.5],
    ],
    output: [[2], [4]],
  },
);
define(
  "minimax",
  "solve(嵌套博弈树) 叶子为数值，内节点为非空子数组；根为 MAX，逐层交替，返回根值，带 α–β 剪枝。",
  "MAX 取最大、MIN 取最小 → 更新 α 或 β → α≥β 时剪枝 → 返回当前界内最优值",
  [
    [
      [3, 5],
      [2, 9],
    ],
  ],
  3,
);
