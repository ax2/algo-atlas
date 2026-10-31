import { numbers, range, recorder, textPair } from "./model";
import type { Trace } from "./model";
export function strategies(id: string, raw: string): Trace {
  const { frames, add } = recorder();
  let result: unknown,
    kind: Trace["kind"] = "cells";
  let source: Trace["source"];
  if (id === "lcs" || id === "edit-distance") {
    const [a, b] = textPair(raw, 12),
      d = range(a.length + 1).map(() => Array(b.length + 1).fill(0));
    if (id === "edit-distance") {
      for (let i = 0; i <= a.length; i++) d[i][0] = i;
      for (let j = 0; j <= b.length; j++) d[0][j] = j;
    }
    const base = { rowLabels: ["∅", ...a], colLabels: ["∅", ...b] };
    add("初始化空前缀", "首行和首列表示其中一侧为空的子问题。", {
      matrix: d,
      ...base,
    });
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++) {
        const same = a[i - 1] === b[j - 1];
        d[i][j] =
          id === "lcs"
            ? same
              ? d[i - 1][j - 1] + 1
              : Math.max(d[i - 1][j], d[i][j - 1])
            : Math.min(
                d[i - 1][j] + 1,
                d[i][j - 1] + 1,
                d[i - 1][j - 1] + (same ? 0 : 1),
              );
        add(
          "填入一个前缀状态",
          `${a[i - 1]} 与 ${b[j - 1]} ${same ? "相同" : "不同"}。dp[${i}][${j}] = ${d[i][j]}。${id === "lcs" ? "相同取左上 +1；不同取上方与左方最大值。" : "比较删除、插入、替换三种选择。"}`,
          {
            matrix: d,
            ...base,
            cells: [[i, j]],
            stats: { 已填状态: (i - 1) * b.length + j },
          },
        );
      }
    result = d[a.length][b.length];
    add(
      "读出最终答案",
      `${id === "lcs" ? "最长公共子序列长度" : "最少编辑次数"} = ${result}。`,
      { matrix: d, ...base, cells: [[a.length, b.length]] },
    );
    kind = "matrix";
  } else if (id === "knapsack") {
    const items =
        raw === "1"
          ? [
              [1, 2],
              [3, 5],
              [4, 6],
              [5, 8],
            ]
          : [
              [2, 3],
              [3, 4],
              [4, 5],
              [5, 8],
            ],
      W = raw === "1" ? 8 : 7,
      d = range(items.length + 1).map(() => Array(W + 1).fill(0));
    source = [
      `容量 W=${W}`,
      ...items.map(([w, v], i) => `物品${i + 1}：重${w} / 值${v}`),
    ];
    const base = {
      rowLabels: ["无物品", ...items.map(([w, v]) => `重${w}/值${v}`)],
      colLabels: range(W + 1).map(String),
    };
    add("初始化背包", "行表示可用物品前缀，列表示容量。每件最多选一次。", {
      matrix: d,
      ...base,
    });
    for (let i = 1; i <= items.length; i++)
      for (let c = 0; c <= W; c++) {
        const [w, v] = items[i - 1],
          skip = d[i - 1][c],
          take = c >= w ? d[i - 1][c - w] + v : -Infinity;
        d[i][c] = Math.max(skip, take);
        add(
          "比较选与不选",
          `物品 ${i}，容量 ${c}：不选=${skip}，选=${Number.isFinite(take) ? take : "放不下"}，取 ${d[i][c]}。`,
          { matrix: d, ...base, cells: [[i, c]] },
        );
      }
    let c = W;
    const picked: number[] = [];
    for (let i = items.length; i > 0; i--)
      if (d[i][c] !== d[i - 1][c]) {
        picked.push(i);
        c -= items[i - 1][0];
      }
    result = d[items.length][W];
    add(
      "回溯选择",
      `最优价值 ${result}；选择物品编号 ${picked.reverse().join(", ")}。`,
      { matrix: d, ...base },
    );
    kind = "matrix";
  } else if (id === "backtracking") {
    const n = 4,
      queens: number[] = [],
      solutions: number[][] = [];
    source = [
      "4×4 棋盘",
      "每行 1 个皇后",
      "列与两条对角线不能冲突",
      raw === "1" ? "按列从右向左尝试" : "按列从左向右尝试",
    ];
    const board = () =>
      range(n).map((r) => range(n).map((c) => (queens[r] === c ? "♛" : "·")));
    add("4 皇后搜索", "每行一个皇后，列与两条对角线都不能冲突。", {
      matrix: board(),
    });
    const go = (r: number) => {
      if (r === n) {
        solutions.push([...queens]);
        add(
          "找到一个完整解",
          `第 ${solutions.length} 个解。继续回溯寻找其他解。`,
          { matrix: board(), stats: { 解数: solutions.length } },
        );
        return;
      }
      const cols = raw === "1" ? range(n).reverse() : range(n);
      for (const c of cols) {
        const ok = queens.every((q, i) => q !== c && Math.abs(q - c) !== r - i);
        if (!ok) {
          add(
            "冲突剪枝",
            `第 ${r + 1} 行第 ${c + 1} 列与已有皇后冲突，不继续这个分支。`,
            {
              matrix: board(),
              cells: [[r, c]],
              stats: { 解数: solutions.length },
            },
          );
          continue;
        }
        queens.push(c);
        add("尝试放置", `在 (${r + 1},${c + 1}) 放皇后。`, {
          matrix: board(),
          cells: [[r, c]],
        });
        go(r + 1);
        queens.pop();
        add("撤销选择", "返回上一层，恢复进入分支前的状态。", {
          matrix: board(),
        });
      }
    };
    go(0);
    queens.push(...solutions[0]);
    add("搜索完成", `共 ${solutions.length} 个解；这里显示第一个解。`, {
      matrix: board(),
      stats: { 解数: solutions.length },
    });
    kind = "board";
    result = solutions;
  } else if (id === "greedy") {
    const intervals =
      raw === "1"
        ? [
            [0, 4],
            [1, 2],
            [2, 3],
            [3, 5],
            [4, 6],
          ]
        : [
            [0, 6],
            [1, 4],
            [3, 5],
            [5, 7],
            [5, 9],
            [8, 9],
          ];
    source = intervals.map(([l, r]) => `[${l},${r})`);
    intervals.sort((a, b) => a[1] - b[1]);
    let end = -Infinity;
    const chosen: number[][] = [];
    add("按结束时间排序", "区间使用 [start,end)，首尾相接允许安排。", {
      matrix: intervals,
      colLabels: ["开始", "结束"],
    });
    intervals.forEach(([s, e], i) => {
      const ok = s >= end;
      if (ok) {
        chosen.push([s, e]);
        end = e;
      }
      add(
        ok ? "接纳活动" : "跳过冲突活动",
        `[${s},${e}) ${ok ? "不冲突，选择它" : "与已选活动冲突"}；已选 ${chosen.length} 项。`,
        {
          matrix: intervals,
          colLabels: ["开始", "结束"],
          cells: [
            [i, 0],
            [i, 1],
          ],
          stats: { 选择数量: chosen.length },
        },
      );
    });
    result = chosen;
    kind = "matrix";
  } else if (id === "fibonacci") {
    const n = numbers(raw, 1, 1, 20)[0];
    if (n < 2) throw new Error("请输入至少 2。");
    const cache: (number | undefined)[] = Array(n + 1).fill(undefined),
      stack: number[] = [];
    cache[0] = 0;
    cache[1] = 1;
    source = [`n=${n}`, "F(0)=0", "F(1)=1"];
    const snapshot = () => ({
      values: cache.map((x) => x ?? 0),
      labels: cache.map((x, i) => `${i}:${x ?? "?"}`),
      worklists: [
        {
          name: "递归调用栈 · 栈顶在左",
          items: [...stack].reverse().map((k) => `F(${k})`),
        },
        {
          name: "已缓存的子问题",
          items: cache.flatMap((v, i) =>
            v === undefined ? [] : [`F(${i})=${v}`],
          ),
        },
      ],
    });
    add("准备记忆化缓存", "仅 F(0)、F(1) 已知；问号代表未计算。", snapshot());
    const fib = (k: number): number => {
      stack.push(k);
      add("进入递归调用", `请求 F(${k})，先检查缓存。`, snapshot());
      if (cache[k] !== undefined) {
        add(
          "命中缓存，直接返回",
          `F(${k})=${cache[k]} 已计算，无需再次展开子树。`,
          { ...snapshot(), checkpoint: true },
        );
      } else {
        const left = fib(k - 1),
          right = fib(k - 2);
        cache[k] = left + right;
        add(
          "合并并写入缓存",
          `F(${k})=${left}+${right}=${cache[k]}，以后可直接复用。`,
          { ...snapshot(), checkpoint: true },
        );
      }
      stack.pop();
      add(
        "返回上一层调用",
        `F(${k}) 返回 ${cache[k]}，当前调用出栈。`,
        snapshot(),
      );
      return cache[k]!;
    };
    result = fib(n);
    add(
      "记忆化计算完成",
      `F(${n})=${result}；每个非边界状态只计算一次，缓存与递归栈都是 O(n)。`,
      snapshot(),
    );
  } else if (id === "coin-change") {
    const n = numbers(raw, 1, 1, 24)[0];
    if (n < 2) throw new Error("请输入至少 2。");
    source = [`目标金额=${n}`, "硬币：1、3、4（无限供应）"];
    const d = Array(n + 1).fill(Infinity);
    d[0] = 0;
    add("设定边界", "dp[0]=0，其余金额暂不可达；面额为 1、3、4。", {
      values: d.map((x) => (Number.isFinite(x) ? x : 0)),
      labels: d.map((x) => (Number.isFinite(x) ? String(x) : "∞")),
    });
    for (let i = 1; i <= n; i++) {
      for (const coin of [1, 3, 4])
        if (i >= coin) d[i] = Math.min(d[i], d[i - coin] + 1);
      add(
        "复用已知子问题",
        `dp[${i}] = ${d[i]}；尝试最后一枚为 1、3、4 后的最优结果。`,
        {
          values: d.map((x) => (Number.isFinite(x) ? x : 0)),
          labels: d.map((x) => (Number.isFinite(x) ? String(x) : "∞")),
          active: [i],
          settled: range(i),
          stats: { 状态: i },
        },
      );
    }
    result = d[n];
  } else {
    const a = numbers(raw);
    add("输入序列", a.join(", "), { values: a });
    if (id === "prefix-sum") {
      const prefix = [0];
      for (let i = 0; i < a.length; i++) {
        prefix.push(prefix[i] + a[i]);
        add(
          "累计一个元素",
          `prefix[${i + 1}] = ${prefix[i]} + ${a[i]} = ${prefix[i + 1]}。`,
          { values: prefix, active: [i + 1] },
        );
      }
      const l = 1,
        r = a.length - 1;
      add(
        "用两个前缀回答查询",
        `sum[${l},${r}] = prefix[${r + 1}] − prefix[${l}] = ${prefix[r + 1] - prefix[l]}。`,
        { values: prefix, active: [l, r + 1] },
      );
      result = prefix;
    } else if (id === "two-pointers") {
      a.sort((a, b) => a - b);
      const target = a[0] + a.at(-1)!;
      let l = 0,
        r = a.length - 1;
      const pairs: number[][] = [];
      add(
        "排序并设定目标",
        `目标和 ${target}（最小 + 最大），找出不重复的数值对。排序成本单独计算。`,
        { values: a },
      );
      while (l < r) {
        const sum = a[l] + a[r];
        add("比较两端之和", `${a[l]} + ${a[r]} = ${sum}，目标 ${target}。`, {
          values: a,
          active: [l, r],
        });
        if (sum === target) {
          pairs.push([a[l], a[r]]);
          const x = a[l],
            y = a[r];
          while (l < r && a[l] === x) l++;
          while (l < r && a[r] === y) r--;
        } else if (sum < target) l++;
        else r--;
      }
      result = pairs;
      add(
        "所有候选处理完成",
        `数值对：${pairs.map((p) => p.join("+")).join("；")}。`,
        { values: a },
      );
    } else if (id === "sliding-window") {
      const k = Math.min(3, a.length);
      let sum = 0,
        best = -Infinity;
      for (let i = 0; i < a.length; i++) {
        sum += a[i];
        if (i >= k) sum -= a[i - k];
        if (i >= k - 1) best = Math.max(best, sum);
        add(
          `移动长度为 ${k} 的窗口`,
          `加入 ${a[i]}${i >= k ? `，移出 ${a[i - k]}` : ""}，当前和 ${sum}。`,
          {
            values: a,
            active: range(Math.min(i + 1, k)).map((j) => i - j),
            stats: {
              窗口和: sum,
              最佳完整窗口: Number.isFinite(best) ? best : "尚未形成",
            },
          },
        );
      }
      result = best;
    } else if (id === "monotonic-stack") {
      const stack: number[] = [],
        next = Array(a.length).fill(-1);
      for (let i = 0; i < a.length; i++) {
        while (stack.length && a[stack.at(-1)!] < a[i]) {
          const j = stack.pop()!;
          next[j] = a[i];
          add("弹出并得到答案", `${a[j]} 的下一个更大值是 ${a[i]}。`, {
            values: a,
            active: [j, i],
            stats: { 栈: stack.map((k) => a[k]).join(", ") || "∅" },
            worklists: [
              {
                name: "单调栈 · 栈顶在左（下标:值）",
                items: [...stack].reverse().map((k) => `${k}:${a[k]}`),
              },
            ],
          });
        }
        stack.push(i);
        add("维护单调递减栈", `入栈 ${a[i]}，等待后面的更大元素。`, {
          values: a,
          active: stack,
          worklists: [
            {
              name: "单调栈 · 栈顶在左（下标:值）",
              items: [...stack].reverse().map((k) => `${k}:${a[k]}`),
            },
          ],
        });
      }
      result = next;
      add("输出下一更大值", "−1 表示右侧不存在更大的值。", {
        values: next,
        labels: next.map(String),
        worklists: [
          {
            name: "仍未匹配的下标 · 右侧已无更大元素",
            items: [...stack].reverse().map((k) => `${k}:${a[k]}`),
          },
        ],
      });
    } else if (id === "lis") {
      const d = Array(a.length).fill(1);
      for (let i = 0; i < a.length; i++) {
        for (let j = 0; j < i; j++)
          if (a[j] < a[i]) {
            d[i] = Math.max(d[i], d[j] + 1);
            add(
              "尝试较小前驱",
              `a[${j}]=${a[j]} < ${a[i]}，dp[${i}] = ${d[i]}。`,
              { values: a, active: [i, j], stats: { 当前位置最长: d[i] } },
            );
          }
        add("确定当前位置答案", `以 ${a[i]} 结尾的最长递增长度为 ${d[i]}。`, {
          values: d,
          active: [i],
        });
      }
      result = Math.max(...d);
      add("取全局最大值", `最长严格递增子序列长度 = ${result}。`, {
        values: d,
      });
    } else throw new Error(`未知策略 ${id}`);
  }
  return {
    frames,
    kind,
    result,
    source,
    caption:
      "动态规划的数值来自实际状态转移。复杂度分析不包含为了回放而保存的帧副本。",
  };
}
