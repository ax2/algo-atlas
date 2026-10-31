import { useState } from "react";
import {
  ArrowRight,
  Route,
  Database,
  Workflow,
  Briefcase,
  Search,
  GitCompareArrows,
  Lightbulb,
  BrainCircuit,
} from "lucide-react";
import { cases } from "../content/cases";
import { topicById } from "../content/catalog";
import { runTrace } from "../engine";
import { graphScenario } from "../engine/graphs";
import { navigate } from "../services/routing";
import { AdaptiveNotes } from "./AdaptiveNotes";
import { AILab } from "./AILab";
import { aiLabs } from "../content/ai-labs";
import type { LabId } from "../engine/ai-labs";
const icons = [Route, Database, Workflow, Briefcase, Search, GitCompareArrows];
function evaluate(
  id: string,
  scenario: number,
  capacity: number,
  text: string,
): { metrics: [string, string][]; events: string[] } {
  if (id === "routes") {
    const { links } = graphScenario("dijkstra", scenario),
      adj = Array.from({ length: 6 }, () => [] as number[]);
    links.forEach(([u, v]) => adj[u].push(v));
    const parent = Array(6).fill(-1),
      q = [0];
    parent[0] = 0;
    while (q.length) {
      const u = q.shift()!;
      for (const v of adj[u])
        if (parent[v] < 0) {
          parent[v] = u;
          q.push(v);
        }
    }
    let u = 5;
    const path = [u];
    while (u !== 0) {
      u = parent[u];
      path.unshift(u);
    }
    const cost = path
        .slice(1)
        .reduce(
          (s, v, i) => s + links.find(([a, b]) => a === path[i] && b === v)![2],
          0,
        ),
      d = runTrace("dijkstra", String(scenario)).result as number[];
    return {
      metrics: [
        ["BFS 路线", path.map((x) => String.fromCharCode(65 + x)).join(" → ")],
        ["BFS 耗时", `${cost}`],
        ["Dijkstra 最短耗时", `${d[5]}`],
      ],
      events: [
        `用 ${links.length} 条有向边建立同一张地图。`,
        `BFS 先发现 ${path.length - 1} 条边的路线，但只比较跳数。`,
        `Dijkstra 松弛边权，得到总耗时 ${d[5]}。`,
        `二者结果${cost === d[5] ? "在本场景恰好一致，不能由此推断一般等价" : "不同：少经过一站不一定更快"}。`,
      ],
    };
  }
  if (id === "cache") {
    const seq = scenario
        ? [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 99]
        : [1, 2, 1, 3, 1, 2, 4, 1, 2, 99, 3],
      existing = new Set([1, 2, 3, 4, 5]),
      bits = Array(16).fill(0),
      hash = (x: number) => [x % 16, (x * 7 + 1) % 16];
    for (const x of existing) for (const h of hash(x)) bits[h] = 1;
    const lru: number[] = [],
      events: string[] = [];
    let hits = 0,
      reads = 0,
      blocked = 0;
    for (const key of seq) {
      if (!hash(key).every((h) => bits[h])) {
        blocked++;
        events.push(`${key} → 过滤器判定不存在，停止。`);
        continue;
      }
      const pos = lru.indexOf(key);
      if (pos >= 0) {
        hits++;
        lru.splice(pos, 1);
        lru.unshift(key);
        events.push(`${key} → 缓存命中，移动至最近端。`);
      } else {
        reads++;
        if (existing.has(key)) {
          lru.unshift(key);
          const evicted = lru.length > capacity ? lru.pop() : undefined;
          events.push(
            `${key} → 回源成功${evicted === undefined ? "" : `，淘汰 ${evicted}`}。`,
          );
        } else events.push(`${key} → 过滤器误报，回源确认不存在。`);
      }
    }
    return {
      metrics: [
        ["缓存命中", `${hits} / ${seq.length}`],
        ["回源次数", String(reads)],
        ["直接拦截", String(blocked)],
      ],
      events,
    };
  }
  if (id === "scheduler") {
    const top = runTrace("topological", String(scenario)).result as {
      order: number[];
      cycle: boolean;
    };
    const intervals = runTrace("greedy", String(scenario)).result as number[][];
    return {
      metrics: [
        ["依赖检查", top.cycle ? "存在环，无法全部排程" : "无环，可以排程"],
        ["可输出任务", `${top.order.length} / 6`],
        ["独立预约问题", `${intervals.length} 个相容活动`],
      ],
      events: [
        `拓扑输出：${top.order.map((x) => String.fromCharCode(65 + x)).join(" → ") || "没有零入度入口"}。`,
        top.cycle
          ? "必须先拆除依赖环，不能伪造完整任务顺序。"
          : "合法顺序不唯一；接下来才处理并发资源限制。",
        `另一组独立预约可选：${intervals.map((x) => `[${x})`).join(", ")}。`,
        "这两个模型不可直接混成一个最优调度器；先声明约束再选算法。",
      ],
    };
  }
  if (id === "budget") {
    const items = scenario
        ? [
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
      cap = scenario ? 8 : 7;
    let left = cap,
      greedy = 0;
    for (const [w, v] of [...items].sort((a, b) => b[1] / b[0] - a[1] / a[0]))
      if (w <= left) {
        left -= w;
        greedy += v;
      }
    const d = Array(cap + 1).fill(0),
      events: string[] = [];
    items.forEach(([w, v], i) => {
      for (let c = cap; c >= w; c--) d[c] = Math.max(d[c], d[c - w] + v);
      events.push(
        `处理物品 ${i + 1}（重 ${w}，值 ${v}）：容量 ${cap} 的最优值现在为 ${d[cap]}。`,
      );
    });
    return {
      metrics: [
        ["总容量", String(cap)],
        ["价值密度贪心", String(greedy)],
        ["0/1 DP 最优值", String(d[cap])],
      ],
      events: [
        ...events,
        `贪心${greedy < d[cap] ? "错过更优组合" : "本次恰好最优，但还需要一般正确性证明"}。`,
      ],
    };
  }
  if (id === "search") {
    const word = scenario ? "ABAB" : "ABABC",
      body = "ABABABCABAB",
      matches = runTrace("kmp", `${body}|${word}`).result as number[];
    const words = ["algo", "algorithm", "array", "atlas", "tree", "trie"],
      prefix = scenario ? "tr" : "al";
    return {
      metrics: [
        ["前缀", prefix],
        ["补全词数", String(words.filter((x) => x.startsWith(prefix)).length)],
        ["正文匹配数", String(matches.length)],
      ],
      events: [
        `词典：${words.join(", ")}。`,
        `前缀 ${prefix} → ${words.filter((x) => x.startsWith(prefix)).join(", ")}。`,
        `正文 ${body}，模式 ${word}。`,
        `KMP 匹配位置：${matches.join(", ")}。`,
        "补全与正文匹配使用不同索引；反复查询长文时可进一步建立后缀或倒排索引。",
      ],
    };
  }
  const pair = text || "kitten|sitting",
    lcs = runTrace("lcs", pair).result as number,
    edit = runTrace("edit-distance", pair).result as number,
    [a, b] = pair.split("|");
  return {
    metrics: [
      ["LCS 长度", String(lcs)],
      ["允许替换的编辑距离", String(edit)],
      ["仅插入删除的成本", String(a.length + b.length - 2 * lcs)],
    ],
    events: [
      `输入 ${a} 与 ${b}。`,
      "两个算法都在前缀对构成的二维状态空间转移。",
      `LCS 保留 ${lcs} 个顺序相同的字符；编辑距离需要 ${edit} 次操作。`,
      "长度答案不能直接作为差异列表；生成具体修改还要回溯转移路径。",
    ],
  };
}
export function Cases({ id }: { id: string }) {
  const selected = cases.find((c) => c.id === id);
  const [scenario, setScenario] = useState(0),
    [capacity, setCapacity] = useState(3),
    [pair, setPair] = useState("kitten|sitting"),
    [input, setInput] = useState(pair),
    [error, setError] = useState(""),
    [revealed, setRevealed] = useState(false);
  if (Object.hasOwn(aiLabs, id)) return <AILab key={id} id={id as LabId} />;
  if (!selected)
    return (
      <>
        <header className="page-heading">
          <div>
            <h1>
              综合专题<span>Connect the dots</span>
            </h1>
            <p>从“知道一个算法”，走向“为一个问题选择系统方案”。</p>
          </div>
        </header>
        <div className="case-grid">
          {cases.map((c, i) => {
            const Icon = icons[i] || BrainCircuit;
            return (
              <button
                key={c.id}
                className="case-card"
                onClick={() => navigate("cases", c.id)}
              >
                <div className={`case-art art-${i}`}>
                  <Icon size={62} strokeWidth={1} />
                  <span>0{i + 1}</span>
                  <div className="art-orbit" />
                </div>
                <div className="case-copy">
                  <span>
                    {c.en} · {c.level}
                  </span>
                  <h2>{c.title}</h2>
                  <p>{c.description}</p>
                  <footer>
                    {c.lessons.length} 个关联单元
                    <ArrowRight size={20} />
                  </footer>
                </div>
              </button>
            );
          })}
        </div>
      </>
    );
  let outcome;
  try {
    outcome = evaluate(selected.id, scenario, capacity, input);
  } catch {
    outcome = evaluate(selected.id, scenario, capacity, "kitten|sitting");
  }
  return (
    <>
      <button className="text-button" onClick={() => navigate("cases")}>
        ← 返回综合专题
      </button>
      <header className="page-heading">
        <div>
          <h1>{selected.title}</h1>
          <p>{selected.description}</p>
        </div>
      </header>
      <section id="section-experiment" className="case-experiment classic-case">
        <div className="case-sandbox single-screen">
          <section className="case-comparison">
            <div className="sandbox-toolbar">
              <h2>改变约束，比较结果</h2>
              <div>
                {selected.id === "diff" ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      try {
                        evaluate("diff", 0, 3, pair);
                        setInput(pair);
                        setError("");
                      } catch (err) {
                        setError((err as Error).message);
                      }
                    }}
                  >
                    <input
                      aria-label="比较的字符串"
                      value={pair}
                      onChange={(e) => setPair(e.target.value)}
                    />
                    <button className="button compact">比较</button>
                  </form>
                ) : (
                  <select
                    aria-label="专题场景"
                    value={scenario}
                    onChange={(e) => setScenario(+e.target.value)}
                  >
                    <option value="0">场景 A · 基准条件</option>
                    <option value="1">场景 B · 改变输入</option>
                  </select>
                )}
                {selected.id === "cache" && (
                  <label>
                    缓存容量{" "}
                    <select
                      aria-label="缓存容量"
                      value={capacity}
                      onChange={(e) => setCapacity(+e.target.value)}
                    >
                      {[1, 2, 3, 4, 5].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="case-pipeline">
              {selected.steps.map((s, i) => (
                <div key={s}>
                  <b>0{i + 1}</b>
                  <span>{s}</span>
                  {i < 2 && <ArrowRight size={20} />}
                </div>
              ))}
            </div>
            <div className="case-metrics">
              {outcome.metrics.map(([k, v]) => (
                <div key={k}>
                  <span>{k}</span>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
          </section>
          <aside className="ai-inspector">
            <h2 className="case-process-title">过程与判断</h2>
            <AdaptiveNotes
              key={`${id}-${scenario}-${capacity}-${input}`}
              className="case-notes"
              label="专题过程讲解"
              blocks={[
                ...outcome.events.map((text, i) => ({
                  title: `${String(i + 1).padStart(2, "0")} · 过程记录`,
                  text,
                })),
                { title: "工程上的取舍", text: selected.constraint },
              ]}
            />
          </aside>
        </div>
      </section>
      <div className="reading-grid">
        <article className="article">
          <h2>工程上的取舍</h2>
          <p>{selected.constraint}</p>
          <h2>把构件逐个拆开</h2>
          <div className="lesson-links">
            {selected.lessons.map((id) => (
              <button key={id} onClick={() => navigate("lesson", id)}>
                <span>{topicById[id].name}</span>
                <ArrowUpRightIcon />
              </button>
            ))}
          </div>
        </article>
        <aside className="reading-aside">
          <Lightbulb size={24} />
          <h3>把问题再推进一步</h3>
          <p>{selected.challenge}</p>
          <button className="button" onClick={() => setRevealed(!revealed)}>
            {revealed ? "收起解释" : "查看解析"}
          </button>
          {revealed && <p className="case-answer">{selected.answer}</p>}
        </aside>
      </div>
    </>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={17} />;
}
