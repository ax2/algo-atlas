import { numbers, range, recorder } from "./model";
import type { Trace } from "./model";

export function sorting(id: string, raw: string, target = 5): Trace {
  const a = numbers(raw);
  let comparisons = 0,
    writes = 0;
  const { frames, add } = recorder(a);
  const emit = (
    title: string,
    detail: string,
    active: number[] = [],
    settled: number[] = [],
    pivot?: number,
  ) =>
    add(title, detail, {
      values: a,
      active,
      settled,
      pivot,
      stats: { 比较: comparisons, 写入: writes },
    });
  const swap = (i: number, j: number) => {
    if (i !== j) {
      [a[i], a[j]] = [a[j], a[i]];
      writes += 2;
    }
  };
  emit(
    "准备实验",
    `输入 ${a.length} 个元素。绿色表示已确定的部分，橙色表示当前基准，紫色表示正在处理。`,
  );
  if (id === "linear-search" || id === "binary-search") {
    if (!Number.isInteger(target) || target < 0 || target > 99)
      throw new Error("搜索目标应为 0–99 的整数。");
    if (id === "binary-search") {
      a.sort((a, b) => a - b);
      emit("建立有序前提", "自动排序输入；此预处理成本不计入搜索比较次数。");
    }
    let found = -1;
    if (id === "linear-search") {
      for (let i = 0; i < a.length; i++) {
        comparisons++;
        emit("检查一个候选", `a[${i}] = ${a[i]}，与目标 ${target} 比较。`, [i]);
        if (a[i] === target) {
          found = i;
          break;
        }
      }
    } else {
      let lo = 0,
        hi = a.length - 1;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        comparisons++;
        emit(
          "检查区间中点",
          `候选区间 [${lo}, ${hi}]，mid=${mid}，值为 ${a[mid]}，目标 ${target}。`,
          [mid],
          range(a.length).filter((i) => i < lo || i > hi),
        );
        if (a[mid] === target) {
          found = mid;
          break;
        }
        if (a[mid] < target) lo = mid + 1;
        else hi = mid - 1;
      }
    }
    emit(
      found < 0 ? "目标不存在" : "找到目标",
      found < 0 ? "候选区间已穷尽。" : `目标 ${target} 的一个位置是 ${found}。`,
      [],
      found < 0 ? [] : [found],
    );
    return {
      frames,
      kind: "cells",
      result: found,
      caption: "下标从 0 开始；重复元素可返回任意一个匹配位置。",
    };
  }
  if (id === "bubble")
    for (let end = a.length - 1; end > 0; end--) {
      let changed = false;
      for (let j = 0; j < end; j++) {
        comparisons++;
        emit(
          "比较相邻元素",
          `${a[j]} 与 ${a[j + 1]}：逆序时交换。`,
          [j, j + 1],
          range(a.length).filter((i) => i > end),
        );
        if (a[j] > a[j + 1]) {
          swap(j, j + 1);
          changed = true;
          emit("交换逆序对", "较大元素向右移动一格。", [j, j + 1]);
        }
      }
      if (!changed) {
        emit("提前结束", "整轮没有交换，整个序列已经有序。");
        break;
      }
    }
  else if (id === "selection")
    for (let i = 0; i < a.length - 1; i++) {
      let m = i;
      for (let j = i + 1; j < a.length; j++) {
        comparisons++;
        if (a[j] < a[m]) m = j;
        emit("寻找剩余最小值", `当前最小候选在 ${m}。`, [j, m], range(i));
      }
      swap(i, m);
      emit("放入有序前缀", `将最小值放到位置 ${i}。`, [i], range(i + 1));
    }
  else if (id === "insertion" || id === "shell") {
    const gaps =
      id === "shell"
        ? (() => {
            const g = [];
            for (let k = Math.floor(a.length / 2); k > 0; k = Math.floor(k / 2))
              g.push(k);
            return g;
          })()
        : [1];
    for (const gap of gaps) {
      emit("处理间隔", `gap=${gap}，对每个间隔子序列执行插入。`);
      for (let i = gap; i < a.length; i++) {
        const v = a[i];
        let j = i;
        while (j >= gap) {
          comparisons++;
          emit("比较前驱", `待插入 ${v}，与位置 ${j - gap} 比较。`, [
            j,
            j - gap,
          ]);
          if (a[j - gap] <= v) break;
          a[j] = a[j - gap];
          writes++;
          j -= gap;
          emit("向后移动", "为待插入值腾出空间。", [j, j + gap]);
        }
        a[j] = v;
        writes++;
        emit("插入目标位置", `将 ${v} 放在 ${j}。`, [j]);
      }
    }
  } else if (id === "quick" || id === "quickselect") {
    const partition = (lo: number, hi: number) => {
      const p = a[hi];
      let i = lo;
      emit(
        "选择基准值",
        `区间 [${lo}, ${hi}] 的最后元素 ${p} 为 pivot。`,
        [],
        [],
        hi,
      );
      for (let j = lo; j < hi; j++) {
        comparisons++;
        emit(
          "比较并划分",
          `${a[j]} ${a[j] <= p ? "≤" : ">"} ${p}；左区间边界 i=${i}。`,
          [j, i],
          [],
          hi,
        );
        if (a[j] <= p) {
          swap(i, j);
          emit("扩展左区间", "把不大于基准的元素纳入左区间。", [i, j], [], hi);
          i++;
        }
      }
      swap(i, hi);
      emit("基准归位", `位置 ${i} 的值已处于最终排名。`, [], [i], i);
      return i;
    };
    if (id === "quick") {
      const go = (l: number, h: number) => {
        if (l >= h) return;
        const p = partition(l, h);
        go(l, p - 1);
        go(p + 1, h);
      };
      go(0, a.length - 1);
    } else {
      const k = Math.floor((a.length - 1) / 2);
      let l = 0,
        h = a.length - 1;
      while (l <= h) {
        const p = partition(l, h);
        if (p === k) break;
        if (p < k) l = p + 1;
        else h = p - 1;
      }
      emit(
        "选出第 k 小",
        `第 ${k + 1} 小元素是 ${a[k]}；其他元素不需要完全排序。`,
        [],
        [k],
      );
      return {
        frames,
        kind: "bars",
        result: a[k],
        caption: `选择排名 k=${k + 1}，保留未排序部分以展示选择与排序的区别。`,
      };
    }
  } else if (id === "merge") {
    const go = (l: number, r: number) => {
      if (r - l < 2) return;
      const m = Math.floor((l + r) / 2);
      emit(
        "分解区间",
        `[${l}, ${r}) → [${l}, ${m}) 与 [${m}, ${r})。`,
        range(r - l).map((i) => i + l),
      );
      go(l, m);
      go(m, r);
      const left = a.slice(l, m),
        right = a.slice(m, r);
      let i = 0,
        j = 0,
        k = l;
      while (i < left.length || j < right.length) {
        if (i < left.length && j < right.length) comparisons++;
        a[k] =
          j >= right.length || (i < left.length && left[i] <= right[j])
            ? left[i++]
            : right[j++];
        writes++;
        emit("合并两个有序段", `写入位置 ${k}，相等时先取左侧，保持稳定性。`, [
          k,
        ]);
        k++;
      }
    };
    go(0, a.length);
  } else if (id === "heap-sort") {
    const sift = (i: number, n: number) => {
      while (2 * i + 1 < n) {
        let c = 2 * i + 1;
        if (c + 1 < n) {
          comparisons++;
          if (a[c + 1] > a[c]) c++;
        }
        comparisons++;
        if (a[i] >= a[c]) break;
        swap(i, c);
        emit(
          "修复最大堆",
          `父位置 ${i} 与较大的孩子 ${c} 交换。`,
          [i, c],
          range(a.length).filter((x) => x >= n),
        );
        i = c;
      }
    };
    for (let i = Math.floor(a.length / 2) - 1; i >= 0; i--) sift(i, a.length);
    for (let end = a.length - 1; end > 0; end--) {
      swap(0, end);
      emit(
        "移走最大值",
        `最大值进入最终位置 ${end}。`,
        [0],
        range(a.length).filter((x) => x >= end),
      );
      sift(0, end);
    }
  } else if (id === "counting") {
    const counts = Array(Math.max(...a) + 1).fill(0);
    for (let i = 0; i < a.length; i++) {
      counts[a[i]]++;
      emit("计数入桶", `count[${a[i]}] = ${counts[a[i]]}。`, [i]);
    }
    let k = 0;
    for (let v = 0; v < counts.length; v++)
      for (let j = 0; j < counts[v]; j++) {
        a[k] = v;
        writes++;
        emit("按桶顺序重建", `写入第 ${k} 项 = ${v}。`, [k], range(k));
        k++;
      }
  } else if (id === "radix") {
    for (let exp = 1; Math.floor(Math.max(...a) / exp) > 0; exp *= 10) {
      const buckets: number[][] = Array.from({ length: 10 }, () => []);
      for (let i = 0; i < a.length; i++) {
        const d = Math.floor(a[i] / exp) % 10;
        buckets[d].push(a[i]);
        emit("按位分桶", `数值 ${a[i]} 的 ${exp} 位数字为 ${d}。`, [i]);
      }
      a.splice(0, a.length, ...buckets.flat());
      writes += a.length;
      emit("稳定收集", `完成 ${exp} 位；桶内保持原有先后次序。`);
    }
  } else throw new Error(`未实现排序实验：${id}`);
  emit("排序完成", "所有元素已经按非递减顺序排列。", [], range(a.length));
  return {
    frames,
    kind: "bars",
    result: [...a],
    caption: "演示统计的是本次输入的比较与写入次数，不是复杂度的数学证明。",
  };
}
