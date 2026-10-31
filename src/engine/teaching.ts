import type { Topic } from "../content/types";
import type { Trace } from "./model";
import { graphScenario } from "./graphs";
const rules: Record<string, [RegExp, string, string][]> = {
  dijkstra: [
    [
      /确定/,
      "选择尚未确定且距离最小的点。非负权保证任何绕经更远未确定点的路径都不会更短。",
      "只有被选中的点距离最终确定；其他点的数字仍是上界。",
    ],
    [
      /松弛/,
      "比较 d[v] 与 d[u]+w(u,v)，只有严格变小时更新；松弛并不等于最终确定。",
      "检查箭头方向和当前边权，不能把节点到源点的距离当边权。",
    ],
  ],
  "bellman-ford": [
    [
      /轮|路径|收敛/,
      "每轮扫描所有边，传播更短路径。完整一轮没有变化说明所有松弛条件都已满足。",
      "V−1 轮后仍能从可达顶点松弛则存在可达负环；不可达负环不影响源点。",
    ],
  ],
  floyd: [
    [
      /中间点/,
      "外层固定 k，只比较原来的 d[i][j] 与经过 k 的 d[i][k]+d[k][j]。",
      "k 必须是最外层；当前高亮的三个格子分别是目标和两段路径。",
    ],
  ],
  kruskal: [
    [
      /分量|成环/,
      "按边权从小到大尝试；两端在不同分量才接受，随后合并并查集。",
      "跳过边不代表它权重大，而是两端已经连通，再加会成环。",
    ],
  ],
  prim: [
    [
      /跨割/,
      "只在已选树与未选点之间找最轻边，割性质保证这条边可安全加入。",
      "不要选树内部的轻边；它不会连接新点。",
    ],
  ],
  scc: [
    [
      /反|分量/,
      "原图退出顺序反转后，在转置图依次搜索，每次搜索得到一个强连通分量。",
      "第二阶段箭头必须全部反转；不能沿原图完成同样的搜索。",
    ],
  ],
  "max-flow": [
    [
      /增广|残量/,
      "增广量等于路径上最小剩余容量；正向残量减去该量，反向残量增加同样的量。",
      "反向边表示撤回旧流量的能力，不是原网络凭空增加的通道。",
    ],
    [
      /没有/,
      "残量网络再也找不到源点到汇点的路；残量可达集合形成一条饱和割。",
      "不是所有边都必须满流；停止依据是不存在增广路。",
    ],
  ],
  "convex-hull": [
    [
      /删除/,
      "按 x、y 排序后，当前链只允许严格左转。新点使最后两条边叉积≤0 时，弹出中间点并重新检查。",
      "一次新点可能连续弹出多个旧点；新点此时还没有加入链。",
    ],
    [
      /加入/,
      "当链末尾不再出现非左转，才能把当前点压入链。上链使用反向点序。",
      "下链与上链分别构造；最终去掉重复端点再闭合。",
    ],
  ],
  knapsack: [
    [
      /比较/,
      "不选物品沿用上一行同容量；选择物品则读取上一行扣除重量的容量，再加该物品价值。",
      "两条候选都来自上一行，所以一件物品最多使用一次。",
    ],
  ],
  lcs: [
    [
      /填入/,
      "dp[i][j] 只描述两个前缀。末字符相同则接在左上答案后；不同则至少舍弃一侧末字符。",
      "子序列可以不连续；别把 LCS 与最长公共子串混淆。",
    ],
  ],
  "edit-distance": [
    [
      /填入/,
      "删除来自上方+1，插入来自左方+1，替换/匹配来自左上+1/0。选三者最小。",
      "空前缀边界代表插入或删除整段，不能全初始化为 0。",
    ],
  ],
  kmp: [
    [
      /回|失配/,
      "已匹配前缀的后缀仍可能是新匹配的开头，沿前缀函数跳到最长可保留边界。",
      "文本指针不回退；只缩短模式的已匹配长度。",
    ],
    [
      /前缀/,
      "求当前前缀最长的真前缀/后缀公共长度，为之后失配提供跳转位置。",
      "“真前缀”不能是整个字符串自己。",
    ],
  ],
  "b-tree": [
    [
      /分裂/,
      "满节点有三个键，提升中间键到父节点；较小与较大键分到左右孩子。",
      "孩子指针也必须随对应键区间拆分；所有叶子保持同层。",
    ],
  ],
  huffman: [
    [
      /合并/,
      "取当前森林中权重最小的两棵树作为兄弟，再把合并树放回候选集合。",
      "下一轮应重新比较所有树，不能一直按最初字符频率合并。",
    ],
  ],
  "segment-tree": [
    [
      /合并/,
      "父区间拆成互不重叠、完整覆盖的左右两段，父和等于两孩子之和。",
      "孩子先创建再连接；中点属于左区间，右区间从 mid+1 开始。",
    ],
  ],
  backtracking: [
    [
      /撤销/,
      "一个分支探索结束后，撤销本层选择，恢复进入分支前的状态。",
      "如果不清理棋盘或占用集合，下一分支会被之前的选择污染。",
    ],
  ],
};
export function teach(topic: Topic, trace: Trace, input: string): Trace {
  const source =
    topic.category === "graphs" || topic.id === "graph"
      ? graphScenario(topic.id, Number(input) || 0).links.map(
          ([u, v, w]) =>
            `${String.fromCharCode(65 + u)}${graphScenario(topic.id, Number(input) || 0).directed ? "→" : "—"}${String.fromCharCode(65 + v)} (${w})`,
        )
      : topic.mode !== "scenario"
        ? input.split(/[,，\s]+/)
        : trace.frames[0].values.length
          ? trace.frames[0].values.map(String)
          : trace.frames[0].nodes?.map((n) => n.label) || [
              "场景 " + (input === "1" ? "B" : "A") + "：见初始状态与说明",
            ];
  trace.frames.forEach((f, i) => {
    const next = trace.frames[i + 1];
    const rule = rules[topic.id]?.find(([pattern]) => pattern.test(f.title));
    if (!f.explanation)
      f.explanation = {
        why: rule?.[1] || topic.invariant,
        changes: f.detail,
        check: rule?.[2] || topic.caveat,
        predict: next
          ? `${next.title}：先预测哪些数值或连接会改变，再单步验证。`
          : "核对最终结果，并尝试另一个输入。",
      };
    if (f.checkpoint === undefined)
      f.checkpoint =
        /旋|分裂|合并|松弛|回退|失败|增广|更新中心|反向|剪枝|最终|完成/.test(
          f.title,
        ) && i > 0;
    if (!next) {
      f.explanation.predict =
        "核对最终结果与原始输入，再尝试边界输入或另一个场景。";
      f.checkpoint = true;
    }
  });
  return {
    ...trace,
    source:
      trace.source ||
      trace.frames.find((f) => f.inputState)?.inputState?.source ||
      source,
  };
}
