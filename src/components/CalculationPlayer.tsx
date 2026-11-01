import { motion } from "motion/react";
import { useState, useEffect } from "react";
import { AdaptiveNotes } from "./AdaptiveNotes";
import { Play, Pause, SkipBack, ChevronLeft, ChevronRight } from "lucide-react";
import { fmt } from "../engine/ai-labs";
import type { CalculationStep } from "../engine/ai-calculation-steps";

export function CalculationPlayer({
  steps,
  index,
  playing,
  onJump,
  onPlay,
  still,
  stageNames,
}: {
  steps: CalculationStep[];
  index: number;
  playing: boolean;
  onJump: (index: number) => void;
  onPlay: () => void;
  still: boolean;
  stageNames?: Record<string, string>;
}) {
  const [showNote, setShowNote] = useState(false);
  useEffect(() => setShowNote(false), [index, steps]);
  const step = steps[index],
    show = (v: number | string) => (typeof v === "number" ? fmt(v) : v);
  return (
    <section
      className="calculation-player"
      aria-label="计算过程逐步演示"
      data-operation={step.operation}
    >
      <div className="micro-controls">
        <button aria-label="计算重新开始" onClick={() => onJump(0)}>
          <SkipBack size={13} />
        </button>
        <button
          aria-label="计算上一步"
          disabled={!index}
          onClick={() => onJump(index - 1)}
        >
          <ChevronLeft size={14} />
        </button>
        <button
          aria-label={playing ? "暂停计算演示" : "播放计算演示"}
          onClick={onPlay}
          disabled={index === steps.length - 1}
        >
          {playing ? <Pause size={13} /> : <Play size={13} />}
          {playing ? "暂停" : "播放"}
        </button>
        <button
          aria-label="计算下一步"
          disabled={index === steps.length - 1}
          onClick={() => onJump(index + 1)}
        >
          <ChevronRight size={14} />
        </button>
        {step.stage && (
          <select
            className="micro-stage"
            aria-label="反传层级"
            value={step.stage}
            onChange={(e) =>
              onJump(steps.findIndex((s) => s.stage === e.target.value))
            }
          >
            {[...new Set(steps.map((s) => s.stage).filter(Boolean))].map(
              (stage) => (
                <option key={stage} value={stage}>
                  {stage === "update"
                    ? "参数更新"
                    : stageNames?.[stage!] || stage}
                </option>
              ),
            )}
          </select>
        )}
        <span title={step.title}>
          {!step.stage && `${step.title} · `}
          {index + 1}/{steps.length}
        </span>
      </div>
      {step.rule && (
        <button
          className="micro-rule"
          aria-label={showNote ? "返回本步公式" : "查看本步详细说明"}
          onClick={() => {
            onJump(index);
            setShowNote(!showNote);
          }}
          title={step.note}
        >
          <b>{step.title}</b> · {step.rule} ⓘ
        </button>
      )}
      {showNote ? (
        <AdaptiveNotes
          className="micro-explanation"
          label="本步详细说明"
          blocks={[
            { title: step.title, text: step.note },
            { title: "链式法则", text: step.rule },
          ]}
        />
      ) : (
        <>
          <div className="micro-formula" aria-label="本步公式" role="status">
            {step.parts.map((part, i) =>
              typeof part === "string" ? (
                <span key={i}>{part}</span>
              ) : (
                <span
                  key={i}
                  data-cell-ref={part.cell}
                  data-slot={step.cells.findIndex((c) => c.id === part.cell)}
                  title={step.cells.find((c) => c.id === part.cell)?.label}
                >
                  {show(step.cells.find((c) => c.id === part.cell)!.value)}
                </span>
              ),
            )}
          </div>
          <div
            className="micro-cells"
            aria-label="本步参与的张量单元格"
            style={{
              gridTemplateColumns: `repeat(${step.cells.length},minmax(0,1fr))`,
            }}
          >
            {step.cells.map((c, i) => (
              <motion.div
                className="micro-cell"
                key={`${index}-${c.id}`}
                data-cell-id={c.id}
                data-slot={i}
                data-output={step.result === c.id || undefined}
                title={`${c.role === "temporary" ? "中间量" : c.role === "parameter" ? "参数" : "张量"} ${c.label} = ${c.value}`}
                initial={still ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <span>
                  {c.caption && (
                    <>
                      <b>{c.caption}</b>
                      <br />
                    </>
                  )}
                  {c.label}
                </span>
                <strong>{show(c.value)}</strong>
              </motion.div>
            ))}
          </div>
        </>
      )}
      <input
        type="range"
        className="micro-timeline"
        min="0"
        max={steps.length - 1}
        value={index}
        onChange={(e) => onJump(+e.target.value)}
        aria-label="计算步骤进度"
      />
      {!showNote && (
        <p className="micro-note">
          {step.note ||
            "同色数值对应同一单元格；依次读取、计算并写出中间结果。"}
        </p>
      )}
    </section>
  );
}
