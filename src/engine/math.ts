import { numbers, range, recorder } from "./model";
import type { Trace } from "./model";
export function math(id: string, raw: string): Trace {
  const { frames, add } = recorder();
  let result: unknown,
    kind: Trace["kind"] = "cells";
  if (id === "gcd") {
    let [a, b] = numbers(raw, 2, 2, 999);
    if (!a || !b) throw new Error("两个数都必须大于 0。");
    add("开始辗转相除", `求 gcd(${a},${b})。`, { values: [a, b] });
    while (b) {
      const r = a % b;
      add(
        "商与余数",
        `${a} = ${Math.floor(a / b)} × ${b} + ${r}；替换为 (${b},${r})。`,
        { values: [a, b, r], labels: ["a", "b", "余数"], active: [2] },
      );
      [a, b] = [b, r];
    }
    result = a;
    add("余数为零", `最大公约数 = ${a}。`, { values: [a], settled: [0] });
  } else if (id === "fast-power") {
    let [b, e] = numbers(raw, 2, 2, 99);
    if (b < 1 || e < 1 || e > 30) throw new Error("底数 1–99，指数 1–30。");
    const mod = 1009;
    let answer = 1;
    add("初始状态", `计算 ${b}^${e} mod ${mod}。`, {
      values: [answer, b, e],
      labels: ["结果", "底数", "指数"],
    });
    while (e) {
      if (e % 2) {
        answer = (answer * b) % mod;
        add("最低位为 1", `结果乘当前底数，再模 ${mod}，得到 ${answer}。`, {
          values: [answer, b, e],
          labels: ["结果", "底数", "指数"],
          active: [0],
        });
      }
      b = (b * b) % mod;
      e = Math.floor(e / 2);
      add("平方并右移", `底数平方取模为 ${b}，指数减半为 ${e}。`, {
        values: [answer, b, e],
        labels: ["结果", "底数", "指数"],
        active: [1, 2],
      });
    }
    result = answer;
  } else if (id === "sieve") {
    const n = numbers(raw, 1, 1, 60)[0];
    if (n < 4) throw new Error("上限应为 4–60。");
    const prime = Array(n + 1).fill(true);
    prime[0] = prime[1] = false;
    add("候选整数", "0 和 1 不是素数。", {
      values: range(n + 1),
      settled: [0, 1],
    });
    for (let p = 2; p * p <= n; p++)
      if (prime[p]) {
        for (let x = p * p; x <= n; x += p) {
          prime[x] = false;
          add("筛去合数", `${x} 是 ${p} 的倍数；从 p²=${p * p} 开始。`, {
            values: range(n + 1),
            active: [x],
            pivot: p,
            settled: range(n + 1).filter((i) => !prime[i]),
          });
        }
      }
    result = range(n + 1).filter((i) => prime[i]);
    add(
      "剩余即素数",
      `素数：${(result as number[]).join(", ")}。灰色格是已排除项。`,
      {
        values: range(n + 1),
        active: result as number[],
        settled: range(n + 1).filter((i) => !prime[i]),
      },
    );
  } else if (id === "bitmask") {
    const a = numbers(raw, 2, 6);
    const subsets: number[][] = [];
    for (let mask = 0; mask < 2 ** a.length; mask++) {
      const chosen = range(a.length).filter((i) => mask & (1 << i));
      subsets.push(chosen.map((i) => a[i]));
      add(
        "二进制选择开关",
        `mask=${mask}（${mask.toString(2).padStart(a.length, "0")}），子集 {${chosen.map((i) => a[i]).join(", ")}}。`,
        {
          values: a,
          active: chosen,
          stats: { 已枚举: mask + 1, 总数: 2 ** a.length },
        },
      );
    }
    result = subsets;
  } else if (id === "convex-hull") {
    type P = [number, number];
    const p: P[] =
      raw === "1"
        ? [
            [1, 1],
            [2, 2],
            [3, 3],
            [4, 4],
            [1, 4],
            [4, 1],
            [2, 3],
          ]
        : [
            [1, 1],
            [2, 3],
            [3, 2],
            [4, 5],
            [5, 1],
            [6, 4],
            [3, 4],
            [2, 1],
          ];
    p.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (a: P, b: P, c: P) =>
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const key = (a: P) => a.join(",");
    const emit = (title: string, detail: string, chain: P[]) =>
      add(title, detail, {
        nodes: p.map((a) => ({
          id: key(a),
          label: `(${a.join(",")})`,
          x: 30 + a[0] * 90,
          y: 320 - a[1] * 52,
          color: chain.includes(a) ? "mint" : undefined,
        })),
        edges: chain
          .slice(1)
          .map((a, i) => ({ from: key(chain[i]), to: key(a), active: true })),
      });
    const lower: P[] = [],
      upper: P[] = [];
    for (const [name, points, chain] of [
      ["下链", p, lower],
      ["上链", [...p].reverse(), upper],
    ] as const)
      for (const pt of points) {
        while (
          chain.length >= 2 &&
          cross(chain.at(-2)!, chain.at(-1)!, pt) <= 0
        ) {
          const removed = chain.pop()!;
          emit("删除非左转点", `${name}移除 (${removed})；叉积 ≤ 0。`, chain);
        }
        chain.push(pt);
        emit("加入边界候选", `${name}加入 (${pt})。`, chain);
      }
    const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
    emit("闭合凸包", "所有内部点都在边界内侧，共线中间点已删除。", [
      ...hull,
      hull[0],
    ]);
    result = hull;
    kind = "graph";
  } else throw new Error(`未知数学实验 ${id}`);
  return {
    frames,
    kind,
    result,
    caption:
      "采用小规模整数/固定坐标，方便观察精确状态。大整数与浮点数工程问题在进阶说明中另列。",
  };
}
