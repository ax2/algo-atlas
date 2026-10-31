// Reference functions are authored for this project. Inputs follow each problem contract.
// @prefix-query
export function prefixQuery(a: number[], queries: number[][]) {
  const p = [0];
  for (const x of a) p.push(p.at(-1)! + x);
  return queries.map(([l, r]) => p[r + 1] - p[l]);
}
// @window-max
export function windowMax(a: number[], k: number) {
  const q: number[] = [],
    out: number[] = [];
  let head = 0;
  for (let i = 0; i < a.length; i++) {
    while (q.length > head && a[q.at(-1)!] <= a[i]) q.pop();
    q.push(i);
    while (q[head] <= i - k) head++;
    if (i >= k - 1) out.push(a[q[head]]);
  }
  return out;
}
// @inversions
export function inversions(a: number[]): number {
  const b = a.slice();
  const go = (l: number, r: number): number => {
    if (r - l <= 1) return 0;
    const m = (l + r) >> 1;
    let answer = go(l, m) + go(m, r),
      i = l,
      j = m;
    const temp: number[] = [];
    while (i < m || j < r) {
      if (j === r || (i < m && b[i] <= b[j])) temp.push(b[i++]);
      else {
        temp.push(b[j++]);
        answer += m - i;
      }
    }
    temp.forEach((x, k) => (b[l + k] = x));
    return answer;
  };
  return go(0, b.length);
}
// @lower-bound
export function lowerBound(a: number[], target: number) {
  let l = 0,
    r = a.length;
  while (l < r) {
    const m = (l + r) >> 1;
    if (a[m] < target) l = m + 1;
    else r = m;
  }
  return l;
}
// @shortest-path
export function shortestPath(n: number, edges: number[][], source: number) {
  const adj: number[][][] = Array.from({ length: n }, () => []);
  for (const [u, v, w] of edges) adj[u].push([v, w]);
  const d = Array(n).fill(Infinity),
    done = Array(n).fill(false);
  d[source] = 0;
  for (let k = 0; k < n; k++) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || d[i] < d[u])) u = i;
    if (u < 0 || !Number.isFinite(d[u])) break;
    done[u] = true;
    for (const [v, w] of adj[u]) d[v] = Math.min(d[v], d[u] + w);
  }
  return d.map((x) => (Number.isFinite(x) ? x : -1));
}
// @topo-order
export function topoOrder(n: number, edges: number[][]) {
  const adj: number[][] = Array.from({ length: n }, () => []),
    degree = Array(n).fill(0);
  for (const [u, v] of edges) {
    adj[u].push(v);
    degree[v]++;
  }
  const q = degree.flatMap((d, i) => (d ? [] : [i]));
  let head = 0;
  while (head < q.length) {
    const u = q[head++];
    for (const v of adj[u]) if (--degree[v] === 0) q.push(v);
  }
  return q.length === n ? q : [];
}
// @knapsack-value
export function knapsackValue(items: number[][], capacity: number) {
  const dp = Array(capacity + 1).fill(0);
  for (const [w, v] of items)
    for (let c = capacity; c >= w; c--) dp[c] = Math.max(dp[c], dp[c - w] + v);
  return dp[capacity];
}
// @lis-length
export function lisLength(a: number[]) {
  const tails: number[] = [];
  for (const x of a) {
    let l = 0,
      r = tails.length;
    while (l < r) {
      const m = (l + r) >> 1;
      if (tails[m] < x) l = m + 1;
      else r = m;
    }
    tails[l] = x;
  }
  return tails.length;
}
// @edit-distance
export function editDistance(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + Number(a[i - 1] !== b[j - 1]),
      );
    prev = cur;
  }
  return prev[b.length];
}
// @kmp-matches
export function kmpMatches(text: string, pattern: string) {
  const pi = Array(pattern.length).fill(0),
    out: number[] = [];
  for (let i = 1, j = 0; i < pattern.length; i++) {
    while (j && pattern[i] !== pattern[j]) j = pi[j - 1];
    if (pattern[i] === pattern[j]) j++;
    pi[i] = j;
  }
  for (let i = 0, j = 0; i < text.length; i++) {
    while (j && text[i] !== pattern[j]) j = pi[j - 1];
    if (text[i] === pattern[j]) j++;
    if (j === pattern.length) {
      out.push(i - j + 1);
      j = pi[j - 1];
    }
  }
  return out;
}
// @mst-weight
export function mstWeight(n: number, edges: number[][]) {
  const p = Array.from({ length: n }, (_, i) => i),
    size = Array(n).fill(1);
  const find = (x: number): number => (p[x] === x ? x : (p[x] = find(p[x])));
  let sum = 0,
    count = 0;
  for (const [u, v, w] of edges.slice().sort((a, b) => a[2] - b[2])) {
    let x = find(u),
      y = find(v);
    if (x !== y) {
      if (size[x] < size[y]) [x, y] = [y, x];
      p[y] = x;
      size[x] += size[y];
      sum += w;
      count++;
    }
  }
  return count === n - 1 ? sum : -1;
}
// @grid-path
export function gridPath(grid: number[][]) {
  const n = grid.length,
    m = grid[0].length;
  if (grid[0][0] || grid[n - 1][m - 1]) return -1;
  const d = grid.map((r) => r.map(() => -1)),
    q = [[0, 0]];
  d[0][0] = 0;
  let head = 0;
  while (head < q.length) {
    const [x, y] = q[head++];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const a = x + dx,
        b = y + dy;
      if (a >= 0 && a < n && b >= 0 && b < m && !grid[a][b] && d[a][b] < 0) {
        d[a][b] = d[x][y] + 1;
        q.push([a, b]);
      }
    }
  }
  return d[n - 1][m - 1];
}
// @range-add
export function rangeAdd(a: number[], updates: number[][]) {
  const diff = Array(a.length + 1).fill(0);
  for (const [l, r, v] of updates) {
    diff[l] += v;
    diff[r + 1] -= v;
  }
  let delta = 0;
  return a.map((x, i) => {
    delta += diff[i];
    return x + delta;
  });
}
// @next-greater
export function nextGreater(a: number[]) {
  const out = Array(a.length).fill(-1),
    stack: number[] = [];
  for (let i = 0; i < a.length; i++) {
    while (stack.length && a[stack.at(-1)!] < a[i]) out[stack.pop()!] = a[i];
    stack.push(i);
  }
  return out;
}
// @interval-schedule
export function intervalSchedule(intervals: number[][]) {
  let end = -Infinity,
    count = 0;
  for (const [l, r] of intervals.slice().sort((a, b) => a[1] - b[1]))
    if (l >= end) {
      end = r;
      count++;
    }
  return count;
}
// @coin-min
export function coinMin(coins: number[], amount: number) {
  const dp = Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let v = 1; v <= amount; v++)
    for (const c of coins) if (c <= v) dp[v] = Math.min(dp[v], dp[v - c] + 1);
  return Number.isFinite(dp[amount]) ? dp[amount] : -1;
}
// @pow-mod
export function powMod(base: number, exponent: number, modulus: number) {
  let b = BigInt(base) % BigInt(modulus),
    e = BigInt(exponent),
    out = 1n % BigInt(modulus),
    m = BigInt(modulus);
  while (e) {
    if (e & 1n) out = (out * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return Number(out);
}
// @convex-area
export function convexArea(points: number[][]) {
  const ps = [...new Map(points.map((p) => [p.join(","), p])).values()].sort(
    (a, b) => a[0] - b[0] || a[1] - b[1],
  );
  const cross = (a: number[], b: number[], c: number[]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const chain = (p: number[][]) => {
    const s: number[][] = [];
    for (const x of p) {
      while (s.length > 1 && cross(s.at(-2)!, s.at(-1)!, x) <= 0) s.pop();
      s.push(x);
    }
    return s;
  };
  if (ps.length < 3) return 0;
  const h = [
    ...chain(ps).slice(0, -1),
    ...chain(ps.slice().reverse()).slice(0, -1),
  ];
  return (
    Math.abs(
      h.reduce((s, p, i) => {
        const q = h[(i + 1) % h.length];
        return s + p[0] * q[1] - p[1] * q[0];
      }, 0),
    ) / 2
  );
}
// @softmax
export function softmax(scores: number[]) {
  const max = Math.max(...scores),
    e = scores.map((s) => Math.exp(s - max)),
    total = e.reduce((a, b) => a + b);
  return e.map((x) => x / total);
}
// @gradient-step
export function gradientStep(
  xs: number[],
  ys: number[],
  w: number,
  rate: number,
) {
  const gradient =
    xs.reduce((s, x, i) => s + (w * x - ys[i]) * x, 0) / xs.length;
  return w - rate * gradient;
}
// @knn-vote
export function knnVote(
  points: number[][],
  labels: number[],
  query: number[],
  k: number,
) {
  const nearest = points
      .map((p, i) => ({
        i,
        d: p.reduce((s, x, j) => s + (x - query[j]) ** 2, 0),
      }))
      .sort((a, b) => a.d - b.d || a.i - b.i)
      .slice(0, k),
    counts = new Map<number, number>();
  for (const { i } of nearest)
    counts.set(labels[i], (counts.get(labels[i]) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}
// @minimax-value
export function minimaxValue(leaves: number[], max = true): number {
  if (leaves.length === 1) return leaves[0];
  const m = leaves.length >> 1;
  return (max ? Math.max : Math.min)(
    minimaxValue(leaves.slice(0, m), !max),
    minimaxValue(leaves.slice(m), !max),
  );
}
// @heap-topk
export function heapTopK(a: number[], k: number) {
  const h: number[] = [];
  for (const x of a) {
    if (h.length < k) {
      h.push(x);
      let i = h.length - 1;
      while (i) {
        const p = (i - 1) >> 1;
        if (h[p] <= h[i]) break;
        [h[p], h[i]] = [h[i], h[p]];
        i = p;
      }
    } else if (x > h[0]) {
      h[0] = x;
      let i = 0;
      for (;;) {
        let j = i * 2 + 1;
        if (j >= h.length) break;
        if (j + 1 < h.length && h[j + 1] < h[j]) j++;
        if (h[i] <= h[j]) break;
        [h[i], h[j]] = [h[j], h[i]];
        i = j;
      }
    }
  }
  return h.slice().sort((a, b) => b - a);
}
// @lru-misses
export function lruMisses(requests: number[], capacity: number) {
  const cache = new Map<number, boolean>();
  let misses = 0;
  for (const x of requests) {
    if (cache.has(x)) cache.delete(x);
    else misses++;
    cache.set(x, true);
    if (cache.size > capacity) cache.delete(cache.keys().next().value!);
  }
  return misses;
}
// @avl-three
export function avlThree(keys: number[]) {
  const [a, b, c] = keys,
    sorted = keys.slice().sort((x, y) => x - y);
  let rotation = "无需旋转";
  if (b < a && c < a) rotation = c < b ? "LL：右旋" : "LR：先左后右";
  if (b > a && c > a) rotation = c > b ? "RR：左旋" : "RL：先右后左";
  return { root: sorted[1], rotation };
}
// @fenwick-ops
export function fenwickOps(a: number[], ops: number[][]) {
  const tree = Array(a.length + 1).fill(0),
    out: number[] = [];
  const add = (at: number, delta: number) => {
    for (let i = at + 1; i < tree.length; i += i & -i) tree[i] += delta;
  };
  a.forEach((v, i) => add(i, v));
  for (const [type, index, delta] of ops) {
    if (type === 0) add(index, delta);
    else {
      let sum = 0;
      for (let i = index + 1; i > 0; i -= i & -i) sum += tree[i];
      out.push(sum);
    }
  }
  return out;
}
// @static-rmq
export function staticRmq(a: number[], queries: number[][]) {
  const st = [a.slice()],
    logs = Array(a.length + 1).fill(0);
  for (let i = 2; i <= a.length; i++) logs[i] = logs[i >> 1] + 1;
  for (let k = 1; 1 << k <= a.length; k++) {
    st[k] = [];
    for (let i = 0; i + (1 << k) <= a.length; i++)
      st[k][i] = Math.min(st[k - 1][i], st[k - 1][i + (1 << (k - 1))]);
  }
  return queries.map(([l, r]) => {
    const k = logs[r - l + 1];
    return Math.min(st[k][l], st[k][r - (1 << k) + 1]);
  });
}
// @historical-sum
export function historicalSum(
  initial: number[],
  updates: number[][],
  queries: number[][],
) {
  const versions = [initial.slice()];
  for (const [base, index, value] of updates) {
    const copy = versions[base].slice();
    copy[index] = value;
    versions.push(copy);
  }
  return queries.map(([version, l, r]) =>
    versions[version].slice(l, r + 1).reduce((s, x) => s + x, 0),
  );
}
