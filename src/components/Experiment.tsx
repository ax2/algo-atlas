import { useEffect, useMemo, useState, useRef } from "react";
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
  SlidersHorizontal,
  Sparkles,
  Maximize,
  Minimize,
} from "lucide-react";
import type { Topic } from "../content/types";
import { runTrace } from "../engine";
import { Diagram } from "./AnimatedDiagram";
import { FitDiagram, ExperimentNotes, InlineData } from "./ExperimentPanels";
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
    [inspection, setInspection] = useState({ step: -1, text: "" }),
    [error, setError] = useState("");
  const [effects, setEffects] = useState(true);
  const [guided, setGuided] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const sync = () =>
      setFullscreen(document.fullscreenElement === stage.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
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
    frame = trace.frames[position],
    inspect = inspection.step === position ? inspection.text : "";
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
      setInspection({ step: -1, text: "" });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const special = ["fibonacci", "coin-change", "gcd", "fast-power", "sieve"];
  const canRandom = topic.mode === "numbers" && !special.includes(topic.id);
  const isSearch = topic.id === "binary-search" || topic.id === "linear-search";
  return (
    <>
      <div className="experiment-grid single-screen" ref={stage}>
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
          <div className="canvas">
            {(error || computed.error) && (
              <div className="form-error" role="alert">
                {error || computed.error}
              </div>
            )}

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
              <button
                className="focus-toggle"
                type="button"
                aria-label={fullscreen ? "退出专注模式" : "专注模式"}
                onClick={async () => {
                  try {
                    if (document.fullscreenElement)
                      await document.exitFullscreen();
                    else await stage.current?.requestFullscreen();
                  } catch {
                    setError(
                      "浏览器暂不支持专注模式；当前实验已自动适应可用空间。",
                    );
                  }
                }}
              >
                {fullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
                <span>{fullscreen ? "退出" : "专注"}</span>
              </button>
            </div>
            <div className="canvas-context">
              {(topic.category === "structures" ||
                topic.category === "strings") && (
                <InlineData
                  label={topic.id === "huffman" ? "原文" : "输入"}
                  items={
                    topic.id === "huffman"
                      ? [computed.error ? topic.input : input]
                      : trace.source || []
                  }
                  className="original-input"
                />
              )}
              {frame.inputState && (
                <div className="processing-row">
                  <span>
                    当前 <b>{frame.inputState.current ?? "—"}</b>
                  </span>
                  <span>
                    下一个 <b>{frame.inputState.pending[0] ?? "无"}</b>
                  </span>
                </div>
              )}
            </div>
            <FitDiagram>
              <Diagram
                frame={frame}
                kind={trace.kind}
                onInspect={(text) => setInspection({ step: position, text })}
                tick={position}
                milliseconds={playing ? speed : 850}
                effects={effects}
              />
            </FitDiagram>
            <div className="worklist-panel" aria-label="算法工作区">
              {frame.worklists?.length ? (
                <InlineData key={position} lists={frame.worklists} />
              ) : null}
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
            <div className="inspect" role={inspect ? "status" : undefined}>
              <Info size={14} />
              {inspect
                ? Array.from(inspect).slice(0, 34).join("") +
                  (Array.from(inspect).length > 34 ? "… · 详见数据" : "")
                : "点击图中元素查看详情。"}
            </div>
          </div>
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
          <div className="experiment-footer">
            <label className="guided-toggle">
              <input
                type="checkbox"
                checked={guided}
                onChange={(e) => setGuided(e.target.checked)}
              />
              讲解模式：关键节点自动暂停
            </label>
            <select
              aria-label="关键节点导航"
              value={frame.checkpoint ? position : ""}
              onChange={(e) => {
                setPlaying(false);
                setStep(+e.target.value);
              }}
            >
              <option value="" disabled>
                跳到关键节点
              </option>
              {trace.frames.map((f, i) =>
                f.checkpoint ? (
                  <option key={i} value={i}>
                    {i} · {f.title}
                  </option>
                ) : null,
              )}
            </select>
          </div>
        </section>
        <aside className="inspector">
          <div className="current-step">
            <div className="section-label">
              {frame.checkpoint ? "关键节点" : "当前步骤"}
              <span>
                {position} / {trace.frames.length - 1}
              </span>
            </div>
            <motion.h4
              key={position}
              initial={reduced || !effects ? false : { opacity: 0.35, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {frame.title}
            </motion.h4>
          </div>
          <ExperimentNotes
            key={`${position}-${inspect}`}
            topic={topic}
            trace={trace}
            frame={frame}
            finished={position === trace.frames.length - 1}
            inspect={inspect}
          />
        </aside>
      </div>
    </>
  );
}
