import { describe, it, expect } from "vitest";
import { runTrace } from "../src/engine";
import { topics } from "../src/content/catalog";
import { graphScenario } from "../src/engine/graphs";

describe("demonstration teaching semantics", () => {
  it("all 79 units retain concrete original input, snapshot-safe working sets and bounded complete traces", () => {
    for (const topic of topics)
      for (const input of topic.mode === "scenario"
        ? ["0", "1"]
        : [topic.input]) {
        const trace = runTrace(topic.id, input);
        expect(trace.source?.length, topic.id).toBeGreaterThan(0);
        expect(trace.source?.join(" "), topic.id).not.toContain(
          "见初始状态与说明",
        );
        expect(trace.frames.at(-1)?.explanation?.predict).toContain("核对");
        const before = JSON.stringify(trace.frames[0]);
        for (const frame of trace.frames) {
          for (const list of frame.worklists || []) {
            expect(list.name).toBeTruthy();
            expect(list.items.every((x) => typeof x === "string")).toBe(true);
          }
          for (const table of frame.tables || [])
            for (const row of table.rows)
              expect(row.length).toBe(table.columns.length);
        }
        trace.frames
          .at(-1)!
          .worklists?.forEach((list) => list.items.push("mutation probe"));
        expect(JSON.stringify(trace.frames[0])).toBe(before);
      }
  });
  for (const text of [
    "aaaa",
    "ab",
    "aaabbc",
    "abcdef",
    "abracadabra",
    "abcdefghijklmnopqrst",
  ])
    it(`Huffman: ${text} encodes, decodes and has optimal weighted length`, () => {
      const trace = runTrace("huffman", text),
        codes = trace.result as Record<string, string>;
      const frequencies = [...new Set(text)].map(
        (c) => [...text].filter((x) => x === c).length,
      );
      let optimal = frequencies.length === 1 ? text.length : 0;
      while (frequencies.length > 1) {
        frequencies.sort((a, b) => a - b);
        const sum = frequencies.shift()! + frequencies.shift()!;
        optimal += sum;
        frequencies.push(sum);
      }
      const encoded = [...text].map((c) => codes[c]).join("");
      expect(encoded.length).toBe(optimal);
      expect(trace.source?.[0]).toBe("原文：" + text);
      expect(trace.output?.summary).toContain("编码位串：" + encoded);
      expect(trace.output?.summary).toContain("解码原文：" + text);
      expect(trace.output?.summary).toContain("往返校验：一致");
      expect(
        trace.frames.filter((f) => f.title === "逐字符编码原文"),
      ).toHaveLength(text.length);
      expect(
        trace.frames.filter((f) => f.title === "命中叶子，输出字符"),
      ).toHaveLength(text.length);
      for (const f of trace.frames)
        expect(f.tables?.[0].rows.map((r) => [r[0], r[1]])).toEqual(
          [...new Set(text)].map((c) => [
            c,
            [...text].filter((x) => x === c).length,
          ]),
        );
    });
  for (const id of ["bfs", "dfs", "topological"])
    for (const variant of ["0", "1"])
      it(`${id}/${variant}: consumed vertices never remain in queue or stack`, () => {
        const trace = runTrace(id, variant);
        for (const frame of trace.frames.filter((f) => f.worklists?.length)) {
          const pending = frame.worklists![0].items,
            visited = frame.worklists![1].items;
          expect(new Set(pending).size).toBe(pending.length);
          expect(
            pending.every((v) => !visited.includes(v)),
            frame.title,
          ).toBe(true);
        }
        expect(trace.frames.at(-1)?.worklists?.[0].items).toEqual([]);
      });
  for (const variant of [0, 1])
    it(`max flow/${variant}: every augmentation conserves flow and residual capacity`, () => {
      const { links } = graphScenario("max-flow", variant),
        trace = runTrace("max-flow", String(variant));
      const capacity = Array.from({ length: 6 }, () => Array(6).fill(0));
      links.forEach(([u, v, c]) => (capacity[u][v] += c));
      let previous = 0;
      for (const f of trace.frames.filter((f) => f.title === "查看残量网络")) {
        const residual = f.matrix as number[][],
          total = Number(f.stats["总流量"]);
        expect(total).toBeGreaterThan(previous);
        previous = total;
        for (let u = 0; u < 6; u++) {
          let net = 0;
          for (let v = 0; v < 6; v++) {
            expect(residual[u][v]).toBeGreaterThanOrEqual(0);
            expect(residual[u][v] + residual[v][u]).toBe(
              capacity[u][v] + capacity[v][u],
            );
            net += capacity[u][v] - residual[u][v];
          }
          expect(net).toBe(u === 0 ? total : u === 5 ? -total : 0);
        }
      }
      expect(previous).toBe(trace.result);
      expect(
        trace.frames.filter((f) => f.title === "残量 BFS 出队").length,
      ).toBeGreaterThan(2);
    });
  it("SCC records each first-pass exit and unwinds its actual stack", () => {
    const trace = runTrace("scc", "0");
    const exits = trace.frames.filter((f) => f.title === "退出递归，记录后序");
    expect(exits).toHaveLength(6);
    expect(exits.at(-1)?.worklists?.[0].items).toEqual([]);
    expect(new Set(exits.at(-1)?.worklists?.[1].items).size).toBe(6);
  });
  it("heap pop preserves the multiset minus exactly one minimum and restores heap order", () => {
    for (const a of [
      [2, 1],
      [7, 2, 9, 4, 3, 8, 1, 6, 5, 10],
      [4, 4, 4],
      [1, 2, 3, 4, 5],
    ]) {
      const trace = runTrace("heap", a.join(",")),
        heap = trace.result as number[];
      expect([...heap].sort((a, b) => a - b)).toEqual(
        [...a].sort((a, b) => a - b).slice(1),
      );
      heap
        .slice(1)
        .forEach((x, i) =>
          expect(heap[Math.floor(i / 2)]).toBeLessThanOrEqual(x),
        );
      expect(trace.frames.some((f) => f.title === "弹出最小值，末尾补根")).toBe(
        true,
      );
    }
  });
  it("linear structures have independent operation oracles including duplicates", () => {
    for (const a of [
      [2, 1],
      [7, 2, 7, 1, 9],
      [0, 0, 0, 0],
    ]) {
      const raw = a.join(",");
      expect(runTrace("array", raw).result).toEqual(a);
      expect(runTrace("stack", raw).result).toEqual([...a].reverse());
      expect(runTrace("queue", raw).result).toEqual(a);
      const deque: number[] = [];
      a.forEach((x, i) => (i % 2 ? deque.push(x) : deque.unshift(x)));
      expect(runTrace("deque", raw).result).toEqual(deque);
      expect(runTrace("linked-list", raw).result).toEqual(
        a.length > 2 ? a.filter((_, i) => i !== 1) : a,
      );
      const buckets = Array.from({ length: 7 }, () => [] as number[]);
      for (const x of a)
        if (!buckets[x % 7].includes(x)) buckets[x % 7].push(x);
      expect(runTrace("hash-table", raw).result).toEqual(buckets);
      const n = Math.min(a.length, 10),
        labels = Array.from({ length: n }, (_, i) => i);
      for (let i = 0; i < a.length - 1; i++) {
        const from = labels[a[i] % n],
          to = labels[a[i + 1] % n];
        labels.forEach((x, j) => {
          if (x === from) labels[j] = to;
        });
      }
      const parent = runTrace("union-find", raw).result as number[];
      const root = (i: number): number =>
        parent[i] === i ? i : root(parent[i]);
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          expect(root(i) === root(j)).toBe(labels[i] === labels[j]);
      const bloom = runTrace("bloom", raw).result as {
        bits: number[];
        probe: number;
        maybe: boolean;
      };
      const hashes = (x: number) => [
        x % 24,
        (x * 7 + 3) % 24,
        (x * 11 + 5) % 24,
      ];
      for (const x of a)
        expect(hashes(x).every((h) => bloom.bits[h] === 1)).toBe(true);
      expect(bloom.maybe).toBe(
        hashes(bloom.probe).every((h) => bloom.bits[h] === 1),
      );
    }
  });
  it("short windows state actual width and static scenario inputs are concrete", () => {
    expect(
      runTrace("sliding-window", "2,3").frames.some(
        (f) => f.title === "移动长度为 2 的窗口",
      ),
    ).toBe(true);
    expect(runTrace("knapsack", "0").source?.[0]).toBe("容量 W=7");
    expect(runTrace("greedy", "0").source?.[0]).toBe("[0,6)");
    expect(runTrace("skip-list", "0").source?.at(-1)).toBe("查找目标=11");
  });
  it("memoization computes each non-base state exactly once and exposes cache hits", () => {
    const trace = runTrace("fibonacci", "10");
    expect(trace.result).toBe(55);
    expect(
      trace.frames.filter((f) => f.title === "合并并写入缓存"),
    ).toHaveLength(9);
    expect(
      trace.frames.filter((f) => f.title === "命中缓存，直接返回").length,
    ).toBeGreaterThan(2);
    expect(trace.frames.at(-1)?.worklists?.[0].items).toEqual([]);
  });
});
