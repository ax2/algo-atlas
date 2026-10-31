import { useId } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMotionPreference } from "../services/motion-preference";
import type { Frame, Trace, Edge, Node } from "../engine/model";
const travel = [0.65, 0, 0.25, 1] as const;
const land = [0.16, 1, 0.3, 1] as const;
type MotionOptions = {
  duration: number;
  still: boolean;
  tick: number;
  glow: string;
};

function EnergyEdge({
  edge,
  a,
  b,
  options,
}: {
  edge: Edge;
  a: Node;
  b: Node;
  options: MotionOptions;
}) {
  const { duration, still, tick, glow } = options,
    dx = b.x - a.x,
    dy = b.y - a.y,
    len = Math.hypot(dx, dy) || 1;
  const startRadius = a.kind ? 9 : Math.min(len / 3, 25),
    endRadius = b.kind ? 9 : Math.min(len / 3, 29);
  const x1 = a.x + (dx / len) * startRadius,
    y1 = a.y + (dy / len) * startRadius,
    x2 = b.x - (dx / len) * endRadius,
    y2 = b.y - (dy / len) * endRadius;
  const d = `M ${x1} ${y1} L ${x2} ${y2}`,
    transition = { duration, ease: travel };
  return (
    <motion.g
      className={`energy-edge ${edge.active ? "energized" : ""}`}
      data-edge={`${edge.from}-${edge.to}`}
      initial={still ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: duration * 0.75 } }}
    >
      <motion.path
        className="edge-aura"
        d={d}
        fill="none"
        filter={`url(#${glow})`}
        initial={still ? false : { pathLength: 0, opacity: 0 }}
        animate={{
          d,
          pathLength: 1,
          opacity: edge.active ? 0.7 : 0.16,
          stroke: edge.active ? "var(--mint)" : "var(--blue)",
        }}
        exit={{ pathLength: 0, opacity: 0 }}
        transition={transition}
        strokeWidth={edge.active ? 7 : 4}
      />
      <motion.path
        className="edge-core"
        d={d}
        fill="none"
        strokeLinecap="round"
        initial={still ? false : { pathLength: 0, opacity: 0.2 }}
        animate={{
          d,
          pathLength: 1,
          opacity: 1,
          stroke: edge.active ? "var(--mint)" : "var(--border)",
        }}
        exit={{
          pathLength: 0,
          opacity: 0,
          transition: { duration: duration * 0.7, ease: travel },
        }}
        transition={transition}
        strokeWidth={edge.active ? 2.7 : 1.8}
      />
      {edge.directed && (
        <motion.path
          d="M -6 -4 L 1 0 L -6 4"
          fill="none"
          stroke={edge.active ? "var(--mint)" : "var(--muted)"}
          strokeWidth="1.7"
          initial={still ? false : { opacity: 0 }}
          animate={{
            x: x2,
            y: y2,
            rotate: (Math.atan2(dy, dx) * 180) / Math.PI,
            opacity: 1,
          }}
          exit={{ opacity: 0 }}
          transition={{
            ...transition,
            opacity: { delay: duration * 0.65, duration: duration * 0.3 },
          }}
        />
      )}
      {!still && (
        <motion.circle
          key={`${edge.from}-${edge.to}-${edge.active ? tick : "born"}`}
          className="edge-particle"
          r={edge.active ? 3.6 : 2.1}
          fill={edge.active ? "#effff9" : "var(--blue)"}
          filter={`url(#${glow})`}
          initial={{ cx: x1, cy: y1, opacity: 0 }}
          animate={{ cx: [x1, x2], cy: [y1, y2], opacity: [0, 1, 1, 0] }}
          transition={{
            duration: duration * 1.05,
            ease: travel,
            opacity: { times: [0, 0.12, 0.82, 1], duration: duration * 1.05 },
          }}
        />
      )}
      {edge.label && (
        <motion.text
          className="edge-weight"
          initial={still ? false : { opacity: 0, y: 5 }}
          animate={{
            x: (a.x + b.x) / 2 + 9,
            y: (a.y + b.y) / 2 - 9,
            opacity: 1,
          }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: duration * 0.7, ease: land }}
        >
          {edge.label}
        </motion.text>
      )}
    </motion.g>
  );
}

function GraphScene({
  frame,
  options,
  onInspect,
}: {
  frame: Frame;
  options: MotionOptions;
  onInspect?: (s: string) => void;
}) {
  const nodes = frame.nodes!,
    map = new Map(nodes.map((n) => [n.id, n]));
  const maxY = Math.max(340, ...nodes.map((n) => n.y + 45)),
    { duration, still, tick, glow } = options;
  return (
    <motion.svg
      className="graph-svg motion-graph"
      viewBox={`0 0 680 ${maxY}`}
      animate={{ viewBox: `0 0 680 ${maxY}` }}
      transition={{ duration, ease: travel }}
      role="img"
      aria-label={frame.title + "：" + frame.detail}
    >
      <defs>
        <filter id={glow} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id={`${glow}-halo`}>
          <stop offset="0" stopColor="var(--mint)" stopOpacity=".2" />
          <stop offset="1" stopColor="var(--mint)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <AnimatePresence initial={!still}>
        {frame.edges?.map((e) => {
          const a = map.get(e.from),
            b = map.get(e.to);
          return a && b ? (
            <EnergyEdge
              key={`${e.from}-${e.to}`}
              edge={e}
              a={a}
              b={b}
              options={options}
            />
          ) : null;
        })}
      </AnimatePresence>
      <AnimatePresence initial={!still}>
        {nodes.map((n) => {
          const active = !!n.color,
            w = n.kind ? 18 : Math.max(46, n.label.length * 8.6),
            color =
              n.color === "orange"
                ? "var(--orange)"
                : n.color === "mint"
                  ? "var(--mint)"
                  : "var(--border)";
          return (
            <motion.g
              key={n.id}
              className={`node motion-node ${n.color || ""}`}
              data-node={n.id}
              initial={
                still ? false : { x: n.x, y: n.y + 20, opacity: 0, scale: 0.65 }
              }
              animate={{ x: n.x, y: n.y, opacity: 1, scale: 1 }}
              exit={{
                opacity: 0,
                scale: 0.6,
                y: n.y - 15,
                transition: { duration: duration * 0.55 },
              }}
              transition={{
                duration,
                ease: travel,
                opacity: { duration: duration * 0.6 },
              }}
              role="button"
              tabIndex={0}
              aria-label={`节点 ${n.label}`}
              onClick={() => onInspect?.(`节点 ${n.label} ${n.subtitle || ""}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onInspect?.(`节点 ${n.label}`);
                }
              }}
            >
              {active && !still && !n.kind && (
                <>
                  <circle r="55" fill={`url(#${glow}-halo)`} />
                  <motion.rect
                    className="node-ripple"
                    key={`${tick}-ripple`}
                    x={-w / 2 - 3}
                    y="-26"
                    width={w + 6}
                    height="52"
                    rx="17"
                    fill="none"
                    stroke={color}
                    strokeWidth="1.5"
                    initial={{ opacity: 0.75, scale: 0.95 }}
                    animate={{ opacity: 0, scale: 1.55 }}
                    transition={{ duration: duration * 1.2, ease: land }}
                  />
                </>
              )}
              <motion.rect
                className="node-shell"
                x={-w / 2}
                y={n.kind ? -9 : -23}
                width={w}
                height={n.kind ? 18 : 46}
                rx={n.kind === "point" ? 9 : n.kind === "centroid" ? 2 : 14}
                animate={{
                  stroke: color,
                  fill: active
                    ? n.color === "orange"
                      ? "#ffac6218"
                      : "#5de0bd12"
                    : "var(--surface-raised)",
                }}
                transition={{ duration: duration * 0.7 }}
              />
              <motion.path
                className="node-glint"
                d={`M ${-w / 2 + 12} -21 H ${w / 2 - 12}`}
                fill="none"
                stroke={active ? color : "var(--blue)"}
                strokeWidth="1.5"
                animate={{ opacity: n.kind ? 0 : active ? 0.85 : 0.15 }}
                transition={{ duration }}
              />
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.text
                  key={n.label}
                  x="0"
                  y={n.kind === "point" ? 26 : n.kind === "centroid" ? -15 : 5}
                  initial={
                    still ? false : { opacity: 0, y: 13, filter: "blur(3px)" }
                  }
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{
                    opacity: 0,
                    y: -6,
                    filter: still ? "blur(0px)" : "blur(3px)",
                  }}
                  transition={{ duration: duration * 0.55, ease: land }}
                >
                  {n.label}
                </motion.text>
              </AnimatePresence>
              {n.subtitle && !n.kind && (
                <text className="node-subtitle" x="0" y="38">
                  {n.subtitle}
                </text>
              )}
            </motion.g>
          );
        })}
      </AnimatePresence>
    </motion.svg>
  );
}

function BarsScene({
  frame,
  options,
  onInspect,
}: {
  frame: Frame;
  options: MotionOptions;
  onInspect?: (s: string) => void;
}) {
  const max = Math.max(1, ...frame.values),
    width = 680 / frame.values.length,
    { duration, still, tick, glow } = options,
    counts = new Map<number, number>();
  return (
    <svg
      className="bars-svg motion-bars"
      viewBox="0 0 680 300"
      role="img"
      aria-label={frame.title + "：" + frame.values.join(", ")}
    >
      <defs>
        <linearGradient id={`${glow}-bar`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".01" />
          <stop offset=".55" stopColor="#ffffff" stopOpacity=".16" />
          <stop offset="1" stopColor="#ffffff" stopOpacity=".03" />
        </linearGradient>
        <filter id={glow} x="-100%" y="-50%" width="300%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <line x1="10" y1="264" x2="670" y2="264" stroke="var(--border)" />
      <AnimatePresence initial={!still}>
        {frame.values.map((v, i) => {
          const occurrence = counts.get(v) || 0;
          counts.set(v, occurrence + 1);
          const key = `${v}-${occurrence}`,
            h = 16 + (v / max) * 195,
            x = i * width + width * 0.16,
            w = width * 0.68,
            active = frame.active.includes(i),
            pivot = frame.pivot === i,
            color = pivot
              ? "var(--orange)"
              : active
                ? "var(--purple)"
                : "var(--mint)";
          return (
            <motion.g
              key={key}
              className="moving-bar"
              data-value={v}
              initial={still ? false : { x, opacity: 0 }}
              animate={{ x, opacity: 1 }}
              exit={{
                opacity: 0,
                y: 25,
                transition: { duration: duration * 0.4 },
              }}
              transition={{ duration, ease: travel }}
              role="button"
              tabIndex={0}
              aria-label={`下标 ${i}，值 ${v}`}
              onClick={() => onInspect?.(`a[${i}] = ${v}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onInspect?.(`a[${i}] = ${v}`);
                }
              }}
            >
              {(active || pivot) && !still && (
                <motion.rect
                  className="bar-glow"
                  x="-2"
                  width={w + 4}
                  rx="5"
                  filter={`url(#${glow})`}
                  animate={{
                    y: 264 - h,
                    height: h,
                    fill: color,
                    opacity: [0.08, 0.38, 0.14],
                  }}
                  transition={{ duration, ease: land }}
                />
              )}
              <motion.rect
                className="bar-body"
                x="0"
                rx="3"
                initial={still ? false : { y: 264, height: 0 }}
                animate={{
                  width: w,
                  y: 264 - h,
                  height: h,
                  fill: color,
                  opacity: frame.settled.includes(i) ? 1 : 0.85,
                }}
                transition={{ duration, ease: travel }}
              />
              <motion.rect
                x="0"
                rx="3"
                fill={`url(#${glow}-bar)`}
                initial={still ? false : { y: 264, height: 0 }}
                animate={{ width: w, y: 264 - h, height: h }}
                transition={{ duration, ease: travel }}
              />
              <motion.line
                stroke={color}
                strokeWidth="2"
                animate={{ x1: 0, x2: w, y1: 264 - h, y2: 264 - h }}
                transition={{ duration, ease: travel }}
              />
              {(active || pivot) && !still && (
                <motion.line
                  key={`scan-${tick}`}
                  className="bar-light-scan"
                  stroke="#f2fffa"
                  strokeWidth="2"
                  initial={{ x1: 0, x2: w, y1: 264, y2: 264, opacity: 0 }}
                  animate={{ y1: 264 - h, y2: 264 - h, opacity: [0, 0.8, 0] }}
                  transition={{ duration: duration * 0.85, ease: travel }}
                />
              )}
              <motion.text
                className="bar-value"
                animate={{ x: w / 2, y: 253 - h }}
                transition={{ duration, ease: travel }}
              >
                {v}
              </motion.text>
            </motion.g>
          );
        })}
      </AnimatePresence>
      {frame.values.map((_, i) => (
        <text key={i} className="bar-index" x={i * width + width / 2} y="288">
          {i}
        </text>
      ))}
    </svg>
  );
}

function MatrixScene({
  frame,
  kind,
  options,
  onInspect,
}: {
  frame: Frame;
  kind: Trace["kind"];
  options: MotionOptions;
  onInspect?: (s: string) => void;
}) {
  const { duration, still, tick } = options;
  return (
    <div className={`matrix-scroll ${kind === "board" ? "board" : ""}`}>
      <table className="matrix motion-matrix" aria-label="当前算法状态表">
        <thead>
          <tr>
            <th aria-label="行标题" />
            {(
              frame.colLabels || frame.matrix![0]?.map((_, i) => String(i))
            ).map((v, i) => (
              <th key={i}>{v}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {frame.matrix!.map((row, r) => (
            <tr key={r}>
              <th>{frame.rowLabels?.[r] ?? r}</th>
              {row.map((v, c) => {
                const hot = frame.cells?.some(([a, b]) => a === r && b === c);
                return (
                  <motion.td
                    key={c}
                    className={hot ? "hot" : ""}
                    animate={{
                      backgroundColor: hot
                        ? "#b29bff24"
                        : "var(--surface-raised)",
                      borderColor: hot ? "var(--purple)" : "var(--border)",
                    }}
                    transition={{ duration: duration * 0.65 }}
                  >
                    <button
                      onClick={() => onInspect?.(`单元格 [${r},${c}] = ${v}`)}
                      aria-label={`单元格 ${r},${c}：${v}`}
                    >
                      {hot && !still && (
                        <motion.span
                          key={`pulse-${tick}`}
                          className="matrix-ripple"
                          initial={{ scale: 0.65, opacity: 0.8 }}
                          animate={{ scale: 1.4, opacity: 0 }}
                          transition={{ duration: duration * 1.05, ease: land }}
                        />
                      )}
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          className="matrix-value"
                          key={String(v)}
                          initial={
                            still
                              ? false
                              : {
                                  y: 14,
                                  scale: 0.8,
                                  opacity: 0,
                                  filter: "blur(4px)",
                                }
                          }
                          animate={{
                            y: 0,
                            scale: 1,
                            opacity: 1,
                            filter: "blur(0px)",
                          }}
                          exit={{
                            y: -10,
                            scale: 1.15,
                            opacity: 0,
                            filter: still ? "blur(0px)" : "blur(3px)",
                          }}
                          transition={{ duration: duration * 0.7, ease: land }}
                        >
                          {v}
                        </motion.span>
                      </AnimatePresence>
                    </button>
                  </motion.td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Diagram({
  frame,
  kind,
  onInspect,
  tick = 0,
  milliseconds = 850,
  effects = true,
}: {
  frame: Frame;
  kind: Trace["kind"];
  onInspect?: (s: string) => void;
  tick?: number;
  milliseconds?: number;
  effects?: boolean;
}) {
  const reduced = useMotionPreference(),
    uid = useId().replace(/:/g, "");
  const still = !!reduced || !effects,
    options: MotionOptions = {
      duration: still ? 0 : Math.min(0.75, (milliseconds / 1000) * 0.85),
      still,
      tick,
      glow: `light-${uid}`,
    };
  if (frame.matrix)
    return (
      <MatrixScene
        frame={frame}
        kind={kind}
        options={options}
        onInspect={onInspect}
      />
    );
  if (frame.nodes)
    return <GraphScene frame={frame} options={options} onInspect={onInspect} />;
  if (kind === "bars")
    return <BarsScene frame={frame} options={options} onInspect={onInspect} />;
  const counts = new Map<number, number>();
  return (
    <motion.div
      className="cells motion-cells"
      aria-label="当前序列"
      layout={!still}
    >
      <AnimatePresence initial={!still} mode="popLayout">
        {frame.values.length === 0 ? (
          <motion.span
            key="empty"
            className="empty-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            ∅　结构为空
          </motion.span>
        ) : (
          frame.values.map((v, i) => {
            const order = counts.get(v) || 0;
            counts.set(v, order + 1);
            const hot = frame.active.includes(i),
              pivot = frame.pivot === i;
            return (
              <motion.button
                layout={!still}
                key={`${v}-${order}`}
                className={`cell ${pivot ? "pivot" : hot ? "hot" : frame.settled.includes(i) ? "settled" : ""}`}
                initial={
                  still
                    ? false
                    : { opacity: 0, y: 22, scale: 0.7, rotateX: -30 }
                }
                animate={{
                  opacity: frame.settled.includes(i) ? 0.4 : 1,
                  y: 0,
                  scale: 1,
                  rotateX: 0,
                  boxShadow:
                    hot && !still ? "0 0 20px #b29bff24" : "0 0 0px #b29bff00",
                }}
                exit={{
                  opacity: 0,
                  y: -25,
                  scale: 0.65,
                  filter: still ? "blur(0px)" : "blur(5px)",
                }}
                transition={{
                  duration: options.duration,
                  ease: travel,
                  layout: { duration: options.duration, ease: travel },
                }}
                onClick={() => onInspect?.(`位置 ${i}，值 ${v}`)}
              >
                {(hot || pivot) && !still && (
                  <motion.i
                    key={tick}
                    className="cell-shimmer"
                    initial={{ x: "-110%" }}
                    animate={{ x: "160%" }}
                    transition={{ duration: options.duration, ease: travel }}
                  />
                )}
                <span>{frame.labels?.[i] ?? v}</span>
                <small>{i}</small>
              </motion.button>
            );
          })
        )}
      </AnimatePresence>
    </motion.div>
  );
}
