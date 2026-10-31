import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useMotionPreference } from "../services/motion-preference";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  Shuffle,
  Info,
  ArrowRight,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import type { Topic } from "../content/types";
import { runTrace } from "../engine";
import { Diagram } from "./AnimatedDiagram";
export type ExperimentState = { input: string; target: number; step: number };
export function Experiment({
  topic,
  initial,
  onState,
}: {
  topic: Topic;
  initial: ExperimentState;
  onState: (s: ExperimentState) => void;
}) {
  const [draft, setDraft] = useState(initial.input),
    [input, setInput] = useState(initial.input),
    [targetDraft, setTargetDraft] = useState(String(initial.target)),
    [target, setTarget] = useState(initial.target),
    [step, setStep] = useState(Math.max(0, initial.step)),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(700),
    [inspect, setInspect] = useState(""),
    [error, setError] = useState("");
  const [effects, setEffects] = useState(true);
  const [guided, setGuided] = useState(false);
  const [zoom, setZoom] = useState(() =>
    window.matchMedia("(max-width: 600px)").matches ? 1.8 : 1,
  );
  const reduced = useMotionPreference();
  const computed = useMemo(() => {
    try {
      return { trace: runTrace(topic.id, input, target), error: "" };
    } catch (e) {
      return {
        trace: runTrace(topic.id, topic.input, 5),
        error: (e as Error).message,
      };
    }
  }, [topic.id, topic.input, input, target]);
  const trace = computed.trace,
    position = Math.min(step, trace.frames.length - 1),
    frame = trace.frames[position];
  useEffect(() => {
    onState({
      input: computed.error ? topic.input : input,
      target: computed.error ? 5 : target,
      step: position,
    });
  }, [input, target, position, onState, computed.error, topic.input]);
  useEffect(() => {
    if (!playing) return;
    if (position >= trace.frames.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      const next = position + 1;
      setStep(next);
      if (guided && trace.frames[next].checkpoint) setPlaying(false);
    }, speed);
    return () => clearTimeout(timer);
  }, [playing, speed, trace, position, guided]);
  const apply = (value = draft, t = Number(targetDraft)) => {
    try {
      runTrace(topic.id, value, t);
      setInput(value);
      setDraft(value);
      setTarget(t);
      setTargetDraft(String(t));
      setStep(0);
      setPlaying(false);
      setError("");
      setInspect("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const special = ["fibonacci", "coin-change", "gcd", "fast-power", "sieve"];
  const canRandom = topic.mode === "numbers" && !special.includes(topic.id);
  const isSearch = topic.id === "binary-search" || topic.id === "linear-search";
  return (
    <>
      <div className="experiment-grid">
        <section className="lab-panel" aria-label="交互实验">
          <form
            className="input-toolbar"
            onSubmit={(e) => {
              e.preventDefault();
              apply();
            }}
          >
            <label className="input-main">
              <span>{topic.mode === "scenario" ? "实验场景" : "输入数据"}</span>
              {topic.mode === "scenario" ? (
                <select
                  aria-label="实验场景"
                  value={input}
                  onChange={(e) => apply(e.target.value)}
                >
                  <option value="0">
                    {topic.scenarios?.[0] || "场景 A · 理解机制"}
                  </option>
                  <option value="1">
                    {topic.scenarios?.[1] || "场景 B · 改变条件"}
                  </option>
                </select>
              ) : (
                <input
                  aria-label="输入数据"
                  value={draft}
                  maxLength={150}
                  onChange={(e) => setDraft(e.target.value)}
                />
              )}
            </label>
            {isSearch && (
              <label className="target-label">
                目标
                <input
                  aria-label="搜索目标"
                  type="number"
                  min="0"
                  max="99"
                  value={targetDraft}
                  onChange={(e) => setTargetDraft(e.target.value)}
                />
              </label>
            )}
            {topic.mode !== "scenario" && (
              <button type="submit" className="button compact">
                应用
              </button>
            )}
            {canRandom && (
              <button
                className="icon-button"
                title="随机生成"
                aria-label="随机生成"
                type="button"
                onClick={() =>
                  apply(
                    Array.from(
                      { length: topic.id === "bitmask" ? 4 : 10 },
                      () => 1 + Math.floor(Math.random() * 30),
                    ).join(", "),
                  )
                }
              >
                <Shuffle size={17} />
              </button>
            )}
          </form>
          <p className="input-hint">
            {topic.inputHint}
            {topic.category === "sorting" && !isSearch && (
              <button onClick={() => apply("1, 2, 3, 4, 5, 6, 7, 8, 9, 10")}>
                试试有序输入 <ArrowRight size={12} />
              </button>
            )}
          </p>
          {(error || computed.error) && (
            <div className="form-error" role="alert">
              {error || computed.error}
            </div>
          )}
          <div className="input-context" aria-label="实验数据上下文">
            <details open>
              <summary>
                初始数据 ·{" "}
                {(frame.inputState?.source || trace.source || []).length} 项
              </summary>
              <div className="data-chips">
                {(frame.inputState?.source || trace.source || []).map(
                  (v, i) => (
                    <span key={i}>{v}</span>
                  ),
                )}
              </div>
            </details>
            {frame.inputState && (
              <div className="processing-row">
                {frame.inputState.label && (
                  <span>{frame.inputState.label}</span>
                )}
                <span>
                  当前处理 <b>{frame.inputState.current ?? "—"}</b>
                </span>
                <span>
                  下一个 <b>{frame.inputState.pending[0] ?? "无"}</b>
                </span>
                <span>
                  待处理 <b>{frame.inputState.pending.join(" → ") || "无"}</b>
                </span>
              </div>
            )}
            <p>
              下一步：{trace.frames[position + 1]?.title || "演示结束"}
              {trace.frames[position + 1]
                ? " · " + trace.frames[position + 1].detail
                : ""}
            </p>
          </div>
          <div className="canvas">
            <div className="canvas-top">
              <span>
                <i /> LIVE EXPERIMENT
              </span>
              <button
                type="button"
                className="effects-toggle"
                aria-label="光影动效"
                aria-pressed={effects && !reduced}
                onClick={() => setEffects((v) => !v)}
                disabled={!!reduced}
                title={
                  reduced
                    ? "系统已启用减少动态效果"
                    : "切换光迹、惯性位移与局部光波"
                }
              >
                <Sparkles size={12} />
                {reduced
                  ? "减少动态效果"
                  : effects
                    ? "光影动效开启"
                    : "简洁动效"}
              </button>
            </div>
            {frame.nodes && (
              <div className="diagram-tools">
                <span>图解缩放 · 可滚动查看</span>
                <button
                  type="button"
                  aria-label="缩小图解"
                  onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
                  disabled={zoom <= 1}
                >
                  −
                </button>
                <button
                  type="button"
                  aria-label="适应宽度"
                  onClick={() => setZoom(1)}
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  aria-label="放大图解"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  disabled={zoom >= 3}
                >
                  ＋
                </button>
              </div>
            )}
            <div
              className={frame.nodes ? "diagram-viewport" : "diagram-plain"}
              tabIndex={frame.nodes ? 0 : undefined}
              aria-label={frame.nodes ? "可滚动图解" : undefined}
            >
              <div
                className={frame.nodes ? "diagram-content" : undefined}
                style={frame.nodes ? { width: `${zoom * 100}%` } : undefined}
              >
                <Diagram
                  frame={frame}
                  kind={trace.kind}
                  onInspect={setInspect}
                  tick={position}
                  milliseconds={playing ? speed : 850}
                  effects={effects}
                />
              </div>
            </div>
            <div className="canvas-bottom">
              <span>
                <i className="mint-dot" /> 已确定 / 已访问
              </span>
              <span>
                <i className="orange-dot" /> 基准 / 当前节点
              </span>
              <span>
                <i className="purple-dot" /> 正在处理
              </span>
            </div>
          </div>
          {inspect && (
            <div className="inspect" role="status">
              <Info size={14} />
              {inspect}
            </div>
          )}
          <div className="playback">
            <button
              className="play-button"
              aria-label={playing ? "暂停" : "播放"}
              onClick={() => {
                if (position === trace.frames.length - 1) setStep(0);
                setPlaying(!playing);
              }}
            >
              {playing ? (
                <Pause size={19} fill="currentColor" />
              ) : (
                <Play size={19} fill="currentColor" />
              )}
              <span>{playing ? "暂停" : "播放"}</span>
            </button>
            <button
              className="icon-button"
              aria-label="上一步"
              disabled={position === 0}
              onClick={() => {
                setPlaying(false);
                setStep(position - 1);
              }}
            >
              <SkipBack size={18} />
            </button>
            <button
              className="button compact"
              aria-label="下一步"
              disabled={position === trace.frames.length - 1}
              onClick={() => {
                setPlaying(false);
                setStep(position + 1);
              }}
            >
              <SkipForward size={17} />
              <span>单步</span>
            </button>
            <button
              className="icon-button"
              aria-label="重置"
              onClick={() => {
                setPlaying(false);
                setStep(0);
              }}
            >
              <RotateCcw size={17} />
            </button>
            <label className="timeline">
              <span>
                步骤 {position} / {trace.frames.length - 1}
              </span>
              <input
                aria-label="演示进度"
                type="range"
                min="0"
                max={trace.frames.length - 1}
                value={position}
                onChange={(e) => {
                  setPlaying(false);
                  setStep(+e.target.value);
                }}
              />
            </label>
            <label className="speed">
              <SlidersHorizontal size={15} />
              <select
                aria-label="动画速度"
                value={speed}
                onChange={(e) => setSpeed(+e.target.value)}
              >
                <option value="1400">0.5×</option>
                <option value="700">1×</option>
                <option value="350">2×</option>
                <option value="140">5×</option>
              </select>
            </label>
          </div>
          <p className="lab-caption">{trace.caption}</p>
          <label className="guided-toggle">
            <input
              type="checkbox"
              checked={guided}
              onChange={(e) => setGuided(e.target.checked)}
            />{" "}
            讲解模式：关键节点自动暂停
          </label>
          <div className="checkpoint-list" aria-label="关键节点导航">
            {trace.frames.map((f, i) =>
              f.checkpoint ? (
                <button
                  key={i}
                  className={i === position ? "active" : ""}
                  onClick={() => {
                    setPlaying(false);
                    setStep(i);
                  }}
                >
                  {i} · {f.title}
                </button>
              ) : null,
            )}
          </div>
        </section>
        <aside className="inspector">
          <h3>
            <Info size={17} /> 学习指引
          </h3>
          <div className="current-step">
            <div className="section-label">
              当前步骤{" "}
              <span>
                {position} / {trace.frames.length - 1}
              </span>
            </div>
            <motion.div
              key={position}
              initial={
                reduced || !effects
                  ? false
                  : { opacity: 0.35, y: 8, filter: "blur(2px)" }
              }
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{
                duration:
                  reduced || !effects ? 0 : Math.min(0.32, speed / 1500),
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <h4>{frame.title}</h4>
              <p aria-live="polite">{frame.detail}</p>
            </motion.div>
          </div>
          {frame.explanation && (
            <section className="step-explanation" aria-label="关键步骤详解">
              <h4>{frame.checkpoint ? "关键节点详解" : "读懂这一步"}</h4>
              <dl>
                <dt>为什么这样做</dt>
                <dd>{frame.explanation.why}</dd>
                <dt>具体改变</dt>
                <dd>{frame.explanation.changes}</dd>
                <dt>检查与边界</dt>
                <dd>{frame.explanation.check}</dd>
                <dt>先想一想</dt>
                <dd>{frame.explanation.predict}</dd>
              </dl>
            </section>
          )}
          <h4 className="small-title">关键不变量</h4>
          <div className="invariant">{topic.invariant}</div>
          {Object.keys(frame.stats).length > 0 && (
            <>
              <h4 className="small-title">过程统计</h4>
              <div className="stat-grid">
                {Object.entries(frame.stats).map(([key, value]) => (
                  <div key={key}>
                    <span>{key}</span>
                    <motion.strong
                      key={String(value)}
                      initial={
                        reduced || !effects ? false : { opacity: 0.4, y: 7 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: reduced || !effects ? 0 : 0.25 }}
                    >
                      {value}
                    </motion.strong>
                  </div>
                ))}
              </div>
            </>
          )}
          <details className="result">
            <summary>查看本次计算结果</summary>
            <pre>{JSON.stringify(trace.result, null, 2)}</pre>
          </details>
        </aside>
      </div>
      <section className="insight-strip">
        <div>
          <span className="vertical-accent" />
          <h3>
            {topic.id === "quick"
              ? "把大问题，拆成小问题。"
              : "先看懂变化，再理解规则。"}
          </h3>
          <p>{topic.analogy}</p>
        </div>
        <div className="method-step">
          <b>1</b>
          <section>
            <strong>观察状态</strong>
            <p>点击图中元素，查看它的值与位置。</p>
          </section>
        </div>
        <div className="method-step">
          <b>2</b>
          <section>
            <strong>追踪变化</strong>
            <p>单步前进，说明这一步为什么成立。</p>
          </section>
        </div>
        <div className="method-step">
          <b>3</b>
          <section>
            <strong>检验边界</strong>
            <p>改变输入或场景，观察规则是否仍然成立。</p>
          </section>
        </div>
      </section>
    </>
  );
}
