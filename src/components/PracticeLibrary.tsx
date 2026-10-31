import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Code2,
  Lightbulb,
  Search,
  Trophy,
} from "lucide-react";
import { problems, problemById, referenceCode } from "../content/problems";
import { topicById, topics } from "../content/catalog";
import { levels } from "../content/types";
import { navigate } from "../services/routing";
import type { LearningData } from "../services/learning";
export function PracticeLibrary({
  id,
  topic = "",
  data,
  update,
}: {
  id: string;
  topic?: string;
  data: LearningData;
  update: (d: LearningData) => void;
}) {
  const [query, setQuery] = useState(""),
    [track, setTrack] = useState("all"),
    [level, setLevel] = useState("all"),
    [topicFilter, setTopic] = useState(topic),
    [page, setPage] = useState(0),
    [status, setStatus] = useState("all"),
    [hint, setHint] = useState(false),
    [answer, setAnswer] = useState(false);
  const problem = Object.hasOwn(problemById, id) ? problemById[id] : undefined,
    done = data.exerciseCompleted || [];
  const filtered = problems.filter(
    (p) =>
      (track === "all" || p.track === track) &&
      (level === "all" || p.level === +level) &&
      (!topicFilter || p.topics.includes(topicFilter)) &&
      (status === "all" ||
        (status === "done" ? done.includes(p.id) : !done.includes(p.id))) &&
      `${p.title} ${p.id} ${p.statement} ${p.topics.map((t) => topicById[t]?.name).join(" ")}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 8)),
    current = Math.min(page, totalPages - 1);
  if (problem)
    return (
      <div className="problem-detail">
        <button
          className="button"
          onClick={() =>
            navigate("practice", "", topicFilter ? "topic=" + topicFilter : "")
          }
        >
          <ArrowLeft size={16} />
          返回练习库
        </button>
        <header className="page-heading">
          <div>
            <p className="eyebrow">
              {problem.track} · {levels[problem.level]} · {problem.id}
            </p>
            <h1>{problem.title}</h1>
            <p>先独立推导，再逐层展开提示与题解。</p>
          </div>
          <Trophy size={38} />
        </header>
        <div className="problem-columns">
          <article className="article">
            <h2>题目</h2>
            <p>{problem.statement}</p>
            <h3>数据范围与约定</h3>
            <p>{problem.constraints}</p>
            <h3>函数输入样例</h3>
            <p>
              JSON
              数组按顺序对应参考函数的参数。实现你自己的程序，再用样例核对。
            </p>
            <pre className="problem-sample">
              {JSON.stringify(problem.example.args, null, 2)}
            </pre>
            <h3>期望输出</h3>
            <pre className="problem-sample">
              {JSON.stringify(problem.example.answer, null, 2)}
            </pre>
            <div className="problem-actions">
              <button className="button" onClick={() => setHint(!hint)}>
                <Lightbulb size={16} />
                {hint ? "收起提示" : "展开提示"}
              </button>
              <button
                className="button primary"
                onClick={() => setAnswer(!answer)}
              >
                <BookOpen size={16} />
                {answer ? "收起完整题解" : "查看完整题解"}
              </button>
            </div>
            {hint && (
              <div className="invariant" role="status">
                {problem.hint}
              </div>
            )}
            {answer && (
              <section className="solution" aria-label="完整题解">
                <h2>解法与正确性</h2>
                <p>{problem.solution}</p>
                <h3>为什么正确</h3>
                <p>{problem.proof}</p>
                <h3>复杂度</h3>
                <p>{problem.complexity}</p>
                <h3>易错点</h3>
                <p>{problem.pitfall}</p>
                <h3>
                  <Code2 size={18} /> TypeScript 参考实现
                </h3>
                <pre className="code-panel">
                  <code>{referenceCode(problem.id)}</code>
                </pre>
                <p className="muted">
                  参考函数已通过样例与边界测试。此处不执行任意用户代码，也不提供在线判题。
                </p>
              </section>
            )}
          </article>
          <aside className="reading-aside">
            <h3>训练路线</h3>
            <p>1. 用小输入手算答案</p>
            <p>2. 写下不变量与复杂度</p>
            <p>3. 编码并覆盖边界</p>
            <p>4. 与参考解法对照</p>
            <h3>关联课程</h3>
            {problem.caseId && (
              <button
                className="related-lesson"
                onClick={() => navigate("cases", problem.caseId)}
              >
                返回 AI 综合实验 <ArrowRight size={14} />
              </button>
            )}
            {problem.topics.map((t) => (
              <button
                key={t}
                className="related-lesson"
                onClick={() => navigate("lesson", t)}
              >
                {topicById[t]?.name}
                <ArrowRight size={14} />
              </button>
            ))}
            <button
              className="button"
              aria-pressed={done.includes(id)}
              onClick={() =>
                update({
                  ...data,
                  exerciseCompleted: done.includes(id)
                    ? done.filter((x) => x !== id)
                    : [...done, id],
                })
              }
            >
              <CheckCircle2 size={16} />
              {done.includes(id) ? "已练习（点击撤销）" : "标记已练习"}
            </button>
            <p className="muted">
              自评记录，包含在学习备份中；不代表评测通过。
            </p>
          </aside>
        </div>
      </div>
    );
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">PRACTICE LAB · 从理解到独立解题</p>
          <h1>
            练习库<span>Build your intuition</span>
          </h1>
          <p>原创题目 · 分层提示 · 完整题解 · 可验证的参考实现</p>
        </div>
        <span className="big-count">
          {problems.length}
          <small>道训练题</small>
        </span>
      </header>
      <div className="practice-track-grid">
        {["all", "竞赛基础", "竞赛进阶", "AI 数值训练"].map((t) => (
          <button
            key={t}
            className={track === t ? "track-card selected" : "track-card"}
            onClick={() => {
              setTrack(t);
              setPage(0);
            }}
          >
            <Trophy size={19} />
            <strong>{t === "all" ? "全部训练" : t}</strong>
            <span>
              {t === "all"
                ? problems.length
                : problems.filter((p) => p.track === t).length}{" "}
              题
            </span>
          </button>
        ))}
      </div>
      <div className="practice-filters">
        <label className="practice-search">
          <Search size={16} />
          <input
            aria-label="练习搜索"
            placeholder="搜索题目、算法或关键词…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <select
          aria-label="练习难度"
          value={level}
          onChange={(e) => {
            setLevel(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">全部难度</option>
          {levels.map((l, i) => (
            <option key={i} value={i}>
              {l}
            </option>
          ))}
        </select>
        <select
          aria-label="关联课程"
          value={topicFilter}
          onChange={(e) => {
            setTopic(e.target.value);
            setPage(0);
          }}
        >
          <option value="">全部专题</option>
          {topics
            .filter((t) => problems.some((p) => p.topics.includes(t.id)))
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
        <select
          aria-label="练习状态"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">全部进度</option>
          <option value="todo">未练习</option>
          <option value="done">已练习</option>
        </select>
        <button
          className="button"
          onClick={() => {
            setQuery("");
            setTrack("all");
            setLevel("all");
            setTopic("");
            setStatus("all");
            setPage(0);
          }}
        >
          清除筛选
        </button>
      </div>
      <p className="muted" role="status">
        找到 {filtered.length} 道题 · 已练习 {done.length}/{problems.length}
      </p>
      <div className="problem-list">
        {filtered.slice(current * 8, current * 8 + 8).map((p) => (
          <button
            className="problem-row"
            key={p.id}
            onClick={() =>
              navigate(
                "practice",
                p.id,
                topicFilter ? "topic=" + topicFilter : "",
              )
            }
          >
            <div className="problem-icon">
              {done.includes(p.id) ? <CheckCircle2 /> : <Code2 />}
            </div>
            <div>
              <span className="eyebrow">
                {p.track} · {levels[p.level]}
              </span>
              <h3>{p.title}</h3>
              <p>{p.topics.map((t) => topicById[t]?.name).join(" / ")}</p>
            </div>
            <span className="solution-badge">含题解</span>
            <ArrowRight size={18} />
          </button>
        ))}
      </div>
      {!filtered.length && (
        <div className="empty-panel">
          当前筛选下暂无题目。清除筛选查看已有训练；题库将按专题持续扩充。
        </div>
      )}
      <div className="pagination">
        <button
          className="button"
          disabled={current === 0}
          onClick={() => setPage(current - 1)}
        >
          上一页
        </button>
        <span>
          {current + 1} / {totalPages}
        </span>
        <button
          className="button"
          disabled={current >= totalPages - 1}
          onClick={() => setPage(current + 1)}
        >
          下一页
        </button>
      </div>
      <p className="muted">
        按专题逐步训练，从基础走向进阶。遇到困难时，先看提示，再对照完整题解。
      </p>
    </>
  );
}
