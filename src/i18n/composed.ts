// Runtime compositions and comments in downloadable teaching source files.
export const composed: Record<string, string> = {
  本路贡献: "Path contribution",
  已有累积: "Previous total",
  累计梯度: "Accumulated gradient",
  "加入 {0}，移出 {1}，当前和 {2}。": "Add {0}, remove {1}; current sum {2}.",
  "插入 {0}，固定教学优先级 {1}。": "Insert {0}, fixed teaching priority {1}.",
  "{0}, 类别{1}": "{0}, class {1}",
  "{0}。本回合{1}，回报 {2}，下一回合回到 s0。":
    "{0}. Episode {1}, return {2}; restart at s0 next episode.",
  "在 index 插入：先追加空位，再从右向左移动。":
    "Insert at index: append a vacant slot, then shift right to left.",
  "最小度数 t=2：每个结点至多 3 个键；重复键作为集合忽略。":
    "Minimum degree t=2: at most 3 keys per node; ignore duplicate set keys.",
  "true 仅表示“可能存在”": "true means only possibly present",
  "非负边；h 必须一致且 h(goal)=0，才可永久关闭结点。":
    "Nonnegative edges; permanent closure requires consistent h and h(goal)=0.",
  "要求非负边、一致启发式，且 h[goal] == 0。":
    "Requires nonnegative edges, a consistent heuristic and h[goal] == 0.",
  "直观版，切片和字符比较有额外成本。":
    "Direct version: slicing and character comparisons have additional costs.",
  "单隐藏 sigmoid 神经元 → 线性输出，L = (prediction-target)^2 / 2。":
    "One sigmoid hidden neuron -> linear output, L = (prediction-target)^2 / 2.",
  "哈希相同仍逐字验证，避免碰撞导致错误。":
    "Verify characters after hash matches to reject collisions.",
  "直观比较排序版；字符比较成本不可当作 O(1)。":
    "Direct comparison sort; character comparison is not O(1).",
  "稳定排序处理同频结点。": "Stable sorting resolves equal-frequency ties.",
};
