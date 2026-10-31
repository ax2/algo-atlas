import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Frame, Trace } from "../engine/model";
import type { Topic } from "../content/types";
import { AdaptiveNotes, type NoteBlock } from "./AdaptiveNotes";

// Break long prose/bit strings into complete, reachable pages rather than clipping.
function chunks(text: string, size = 80): string[] {
  const pages: string[] = [];
  let page = "",
    lines = 1,
    count = 0;
  for (const c of Array.from(text)) {
    if (count >= size || (c === "\n" && lines >= 3)) {
      pages.push(page);
      page = "";
      lines = 1;
      count = 0;
    }
    page += c;
    count++;
    if (c === "\n") lines++;
  }
  if (page || !pages.length) pages.push(page);
  return pages;
}
function Pager({
  page,
  count,
  onChange,
  label,
}: {
  page: number;
  count: number;
  onChange: (page: number) => void;
  label: string;
}) {
  if (count <= 1) return null;
  return (
    <div className="experiment-pager" aria-label={label}>
      <button
        aria-label={`${label}上一页`}
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft size={14} />
      </button>
      <span>
        {page + 1} / {count}
      </span>
      <button
        aria-label={`${label}下一页`}
        disabled={page === count - 1}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

export function InlineData({
  label = "",
  items = [],
  lists,
  className = "",
}: {
  label?: string;
  items?: string[];
  lists?: Frame["worklists"];
  className?: string;
}) {
  const [listIndex, setListIndex] = useState(0),
    [page, setPage] = useState(0);
  const list = lists?.[Math.min(listIndex, lists.length - 1)];
  const pages = chunks((list?.items || items).join(" · ") || "空", 38);
  const current = Math.min(page, pages.length - 1);
  return (
    <div className={`inline-data ${className}`}>
      {lists && lists.length > 1 ? (
        <select
          aria-label="工作区内容"
          value={listIndex}
          onChange={(e) => {
            setListIndex(+e.target.value);
            setPage(0);
          }}
        >
          {lists.map((l, i) => (
            <option key={l.name} value={i}>
              {l.name}
            </option>
          ))}
        </select>
      ) : (
        <strong>{list?.name || label}</strong>
      )}
      <span className="inline-data-values">{pages[current]}</span>
      <Pager
        page={current}
        count={pages.length}
        onChange={setPage}
        label={className === "original-input" ? "输入数据" : "工作区"}
      />
    </div>
  );
}

// Measure the unscaled scene and fit both axes. No scroll container and no cropped graph.
export function FitDiagram({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null),
    content = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const fit = () => {
      const box = viewport.current!,
        scene = content.current!;
      const next = Math.min(
        box.clientWidth / scene.offsetWidth,
        box.clientHeight / scene.offsetHeight,
        2.5,
      );
      if (Number.isFinite(next) && next >= 0)
        setScale((old) => (Math.abs(old - next) > 0.001 ? next : old));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(viewport.current!);
    observer.observe(content.current!);
    fit();
    return () => observer.disconnect();
  }, []);
  return (
    <div className="fit-viewport" ref={viewport} aria-label="自适应图解">
      <div
        className="fit-scene"
        ref={content}
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

const detail = (title: string, text: string): NoteBlock[] => [{ title, text }];
const tableBlocks = (
  title: string,
  columns: string[],
  rows: (string | number)[][],
): NoteBlock[] => (rows.length ? [{ title, columns, rows }] : []);
export function ExperimentNotes({
  topic,
  trace,
  frame,
  finished,
  inspect,
}: {
  topic: Topic;
  trace: Trace;
  frame: Frame;
  finished: boolean;
  inspect: string;
}) {
  const [tab, setTab] = useState(
    inspect ? "data" : finished ? "result" : "step",
  );
  const [visit, setVisit] = useState(0);
  const e = frame.explanation;
  const sections: Record<string, NoteBlock[]> = {
    step: [
      ...detail("发生了什么", frame.detail),
      ...(e
        ? [
            ...detail("为什么这样做", e.why),
            ...detail("检查与边界", e.check),
            ...detail("接下来想一想", e.predict),
          ]
        : []),
    ],
    why: e
      ? [
          ...detail("为什么这样做", e.why),
          ...detail("具体改变", e.changes),
          ...detail("检查与边界", e.check),
          ...detail("先想一想", e.predict),
          ...detail("关键不变量", topic.invariant),
        ]
      : detail("关键不变量", topic.invariant),
    data: [
      ...(inspect ? detail("选中元素", inspect) : []),
      ...detail(
        "过程统计",
        Object.entries(frame.stats)
          .map(([k, v]) => `${k}：${v}`)
          .join("；") || "本步骤无额外计数。",
      ),
      ...detail("完整原始输入", (trace.source || []).join(" · ")),
      ...detail("输入说明", topic.inputHint),
      ...detail("实验说明", trace.caption),
      ...(frame.tables || []).flatMap((t) =>
        tableBlocks(t.title, t.columns, t.rows),
      ),
    ],
    result: !finished
      ? detail("尚未结束", "单步前进或拖动进度至末尾，即可核对最终输出。")
      : trace.output
        ? [
            ...detail(trace.output.title, trace.output.summary.join("\n")),
            ...(trace.output.columns
              ? tableBlocks(
                  "结果明细",
                  trace.output.columns,
                  trace.output.rows || [],
                )
              : []),
          ]
        : detail(
            "最终计算结果",
            JSON.stringify(trace.result, (_k, v) =>
              typeof v === "number" && !Number.isFinite(v) ? String(v) : v,
            ) ?? "无返回值",
          ),
  };
  return (
    <>
      <nav className="experiment-note-tabs" aria-label="实验讲解">
        {[
          ["step", "这一步"],
          ["why", "详解"],
          ["data", "数据"],
          ["result", "结果"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={tab === id}
            onClick={() => {
              setTab(id);
              setVisit((v) => v + 1);
            }}
          >
            {label}
            {id === "result" && finished ? " ✓" : ""}
          </button>
        ))}
      </nav>
      <AdaptiveNotes
        key={`${tab}-${visit}`}
        blocks={sections[tab]}
        className={`${tab === "why" ? "step-explanation" : ""} ${tab === "result" ? "final-output" : ""}`}
        label={tab === "result" ? "演示输出" : "步骤说明"}
      />
    </>
  );
}
