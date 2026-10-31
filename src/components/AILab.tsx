import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  BrainCircuit,
  Sparkles,
  Share2,
} from "lucide-react";
import { aiLabs, phaseNames } from "../content/ai-labs";
import { defaults, runAILab, fmt } from "../engine/ai-labs";
import type { LabId, LabConfig, LabFrame } from "../engine/ai-labs";
import { Diagram } from "./AnimatedDiagram";
import { navigate } from "../services/routing";
import { topicById } from "../content/catalog";
import { problemById } from "../content/problems";
import { useMotionPreference } from "../services/motion-preference";

function initial(id: LabId) {
  const query = new URLSearchParams(location.hash.split("?")[1] || ""),
    c = defaults(id);
  for (const key of Object.keys(c) as (keyof LabConfig)[]) {
    const v = Number(query.get(key));
    if (query.has(key) && Number.isFinite(v)) c[key] = v;
  }
  if (
    ![0, 1].includes(c.variant) ||
    c.rounds < 1 ||
    c.rounds > 64 ||
    !Number.isInteger(c.rounds) ||
    c.rate <= 0 ||
    c.rate > 2 ||
    (id === "reinforcement-lab" && c.rate > 1) ||
    c.gamma < 0 ||
    c.gamma >= 1 ||
    c.epsilon < 0 ||
    c.epsilon > 1
  )
    return { config: defaults(id), step: 0 };
  const step = Number(query.get("step"));
  return {
    config: c,
    step: Number.isSafeInteger(step) && step >= 0 ? step : 0,
  };
}
function Curve({
  values,
  rl,
  still,
}: {
  values: number[];
  rl: boolean;
  still: boolean;
}) {
  const min = Math.min(0, ...values),
    max = Math.max(0.01, ...values),
    span = max - min || 1;
  const points = values
    .map(
      (v, i) =>
        `${20 + (i * 580) / Math.max(1, values.length - 1)},${95 - ((v - min) / span) * 75}`,
    )
    .join(" ");
  return (
    <div className="ai-curve">
      <div>
        <span>
          {rl ? "已完成回合 · 未折扣回报" : "整批训练损失 · 越低越好"}
        </span>
        <strong>{values.length ? fmt(values.at(-1)!) : "等待首个回合"}</strong>
      </div>
      <svg
        viewBox="0 0 620 118"
        role="img"
        aria-label={rl ? "回合回报曲线" : "训练损失曲线"}
      >
        {[20, 57, 95].map((y) => (
          <line key={y} x1="20" x2="600" y1={y} y2={y} stroke="var(--border)" />
        ))}
        <motion.polyline
          points={points}
          fill="none"
          stroke="var(--mint)"
          strokeWidth="2.5"
          initial={false}
          animate={{ points }}
          transition={{ duration: still ? 0 : 0.45 }}
        />
        {values.length > 0 && (
          <circle
            cx={values.length === 1 ? 20 : 600}
            cy={95 - ((values.at(-1)! - min) / span) * 75}
            r="4"
            fill="var(--mint)"
          />
        )}
        <text x="20" y="113" fill="var(--muted)" fontSize="10">
          {values.length ? "1" : "0"}
        </text>
        <text x="580" y="113" fill="var(--muted)" fontSize="10">
          {values.length}
        </text>
      </svg>
    </div>
  );
}
function TensorView({
  frame,
  tick,
  effects,
  speed,
}: {
  frame: LabFrame;
  tick: number;
  effects: boolean;
  speed: number;
}) {
  const [selected, setSelected] = useState(0),
    [inspect, setInspect] = useState("");
  const index = Math.min(selected, frame.tensors.length - 1),
    t = frame.tensors[index];
  return (
    <section className="ai-tensor" aria-label="张量观察窗">
      <div className="ai-section-head">
        <h3>张量观察窗</h3>
        <select
          aria-label="选择张量"
          value={index}
          onChange={(e) => {
            setSelected(+e.target.value);
            setInspect("");
          }}
        >
          {frame.tensors.map((t, i) => (
            <option key={t.name} value={i}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <p className="muted">
        {t.name} · 点击单元格检查数值，显示值保留 4 位小数，计算使用完整精度。
      </p>
      <div className="ai-matrix-scroll">
        <Diagram
          kind="matrix"
          effects={effects}
          tick={tick}
          milliseconds={speed}
          frame={{
            title: t.name,
            detail: "",
            values: [],
            active: [],
            settled: [],
            stats: {},
            matrix: t.rows.map((r) =>
              r.map((v) => (typeof v === "number" ? fmt(v) : v)),
            ),
            rowLabels: t.labels,
            colLabels: t.columns,
          }}
          onInspect={setInspect}
        />
      </div>
      {inspect && (
        <p className="invariant" role="status">
          {inspect}
        </p>
      )}
    </section>
  );
}
export function AILab({ id }: { id: LabId }) {
  const [start] = useState(() => initial(id)),
    [config, setConfig] = useState(start.config),
    [step, setStep] = useState(start.step),
    [playing, setPlaying] = useState(false),
    [guided, setGuided] = useState(true),
    [speed, setSpeed] = useState(1000),
    [effects, setEffects] = useState(true),
    [group, setGroup] = useState("all"),
    [share, setShare] = useState(""),
    [inspect, setInspect] = useState(""),
    [fit, setFit] = useState(false);
  const reduced = useMotionPreference(),
    still = reduced || !effects,
    content = aiLabs[id],
    rl = id === "reinforcement-lab";
  const trace = useMemo(() => runAILab(id, config), [id, config]),
    position = Math.min(step, trace.frames.length - 1),
    frame = trace.frames[position];
  const groups = [...new Set(frame.updates.map((p) => p.group))],
    selectedGroup = groups.includes(group) ? group : "all";
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
  }, [playing, position, trace, guided, speed]);
  const jump = (n: number) => {
    setStep(n);
    setPlaying(false);
    setInspect("");
    setShare("");
  };
  const change = (key: keyof LabConfig, value: number) => {
    setConfig({ ...config, [key]: value });
    jump(0);
  };
  const roundOptions = rl
    ? [8, 16, 32]
    : id === "neural-training"
      ? [12, 40, 60]
      : [4, 8, 16];
  const rates = rl
    ? [0.1, 0.5, 1]
    : id === "neural-training"
      ? [0.1, 0.8, 2]
      : [0.02, 0.08, 0.3];
  const updated = frame.phase === "update",
    backward = frame.phase === "backward" || frame.phase === "target";
  return (
    <div className={`ai-lab ${rl ? "ai-rl" : ""}`}>
      <button className="text-button" onClick={() => navigate("cases")}>
        <ArrowLeft size={15} /> 返回综合专题
      </button>
      <header className="ai-hero">
        <div>
          <p className="eyebrow">{content.en}</p>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
          <div className="ai-badges">
            <span>进阶综合实验</span>
            <span>
              {trace.parameterCount} 个{rl ? "Q 表项" : "可训练参数"}
            </span>
            <span>真实计算 · 可回放</span>
          </div>
        </div>
        <BrainCircuit size={72} strokeWidth={1} />
      </header>
      <section className="ai-controls" aria-label="AI 实验设置">
        <label>
          数据场景
          <select
            aria-label="AI 数据场景"
            value={config.variant}
            onChange={(e) => change("variant", +e.target.value)}
          >
            <option value="0">
              {rl
                ? "普通移动 −0.04"
                : id === "neural-training"
                  ? "XOR · 非线性挑战"
                  : "序列 A B C → B C D"}
            </option>
            <option value="1">
              {rl
                ? "普通移动 −0.2"
                : id === "neural-training"
                  ? "AND · 对照任务"
                  : "序列 B A C → A C D"}
            </option>
          </select>
        </label>
        <label>
          {rl ? "更新步长 α" : "学习率 η"}
          <select
            aria-label="学习率"
            value={config.rate}
            onChange={(e) => change("rate", +e.target.value)}
          >
            {[...new Set([...rates, config.rate])]
              .sort((a, b) => a - b)
              .map((r) => (
                <option key={r}>{r}</option>
              ))}
          </select>
        </label>
        <label>
          {rl ? "训练回合" : "训练轮数"}
          <select
            aria-label="训练轮数"
            value={config.rounds}
            onChange={(e) => change("rounds", +e.target.value)}
          >
            {[...new Set([...roundOptions, config.rounds])]
              .sort((a, b) => a - b)
              .map((r) => (
                <option key={r}>{r}</option>
              ))}
          </select>
        </label>
        {rl && (
          <>
            <label>
              探索率 ε
              <select
                aria-label="探索率"
                value={config.epsilon}
                onChange={(e) => change("epsilon", +e.target.value)}
              >
                {[...new Set([0, 0.25, 0.8, config.epsilon])].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              折扣 γ
              <select
                aria-label="折扣因子"
                value={config.gamma}
                onChange={(e) => change("gamma", +e.target.value)}
              >
                {[...new Set([0, 0.5, 0.9, config.gamma])].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </>
        )}
        <p>改变设置会从同一初始条件重新训练。拖动进度只回放，不额外训练。</p>
      </section>
      <div className="ai-source">
        <strong>初始数据</strong>
        {trace.source.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
      <div className="ai-workspace">
        <section className="ai-stage">
          <div className="ai-stage-top">
            <span className="eyebrow">
              LIVE LEARNING / {rl ? "EPISODE" : "EPOCH"} {frame.iteration}
            </span>
            <button
              className="text-button"
              aria-pressed={effects}
              onClick={() => setEffects(!effects)}
            >
              <Sparkles size={14} />
              {still ? "静态模式" : "光影流动"}
            </button>
          </div>
          <div className="ai-phases" aria-label="训练阶段">
            {content.steps.map((phase) => (
              <button
                key={phase}
                aria-current={frame.phase === phase ? "step" : undefined}
                onClick={() =>
                  jump(
                    rl
                      ? position - (position % 4) + content.steps.indexOf(phase)
                      : trace.frames.findIndex(
                          (f) =>
                            f.iteration === frame.iteration &&
                            f.phase === phase,
                        ),
                  )
                }
              >
                {phaseNames[phase]}
              </button>
            ))}
          </div>
          <div className="ai-flow-label">
            <span>
              {backward && !rl
                ? "← 梯度沿依赖关系反传"
                : rl
                  ? "策略 → 行动 → 环境 → 价值更新"
                  : "数据向前传递 → 参数在更新步骤改变"}
            </span>
            <button className="text-button" onClick={() => setFit(!fit)}>
              {fit ? "放大图解" : "适应宽度"}
            </button>
          </div>
          <div className="ai-flow-scroll">
            <div className={fit ? "ai-flow fit" : "ai-flow"}>
              <Diagram
                frame={frame.diagram}
                kind="graph"
                tick={position}
                effects={effects}
                milliseconds={speed}
                onInspect={setInspect}
              />
            </div>
          </div>
          {inspect && (
            <p className="invariant" role="status">
              {inspect}
            </p>
          )}
          <div className="ai-transport">
            <button
              className="icon-button"
              aria-label="重新开始"
              onClick={() => jump(0)}
            >
              <RotateCcw size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="上一步"
              disabled={!position}
              onClick={() => jump(position - 1)}
            >
              <ArrowLeft size={18} />
            </button>
            <button
              className="button primary"
              disabled={position === trace.frames.length - 1}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? <Pause size={17} /> : <Play size={17} />}
              {playing ? "暂停" : "播放"}
            </button>
            <button
              className="icon-button"
              aria-label="下一步"
              disabled={position === trace.frames.length - 1}
              onClick={() => jump(position + 1)}
            >
              <ArrowRight size={18} />
            </button>
            <select
              aria-label="播放速度"
              value={speed}
              onChange={(e) => setSpeed(+e.target.value)}
            >
              <option value="1600">慢速</option>
              <option value="1000">标准</option>
              <option value="300">快速</option>
            </select>
            <button
              className="icon-button"
              aria-label="生成实验分享链接"
              onClick={() => {
                const u = new URL(location.href);
                u.hash = `/cases/${id}?${new URLSearchParams({ ...Object.fromEntries(Object.entries(config).map(([k, v]) => [k, String(v)])), step: String(position) })}`;
                setShare(u.href);
              }}
            >
              <Share2 size={17} />
            </button>
          </div>
          <input
            className="ai-timeline"
            aria-label="AI 演示进度"
            type="range"
            min="0"
            max={trace.frames.length - 1}
            value={position}
            onChange={(e) => jump(+e.target.value)}
          />
          <div className="ai-play-options">
            <span>
              步骤 {position + 1} / {trace.frames.length}
            </span>
            <label>
              跳到{rl ? "回合" : "轮次"}
              <select
                aria-label="跳到轮次"
                value={frame.iteration}
                onChange={(e) =>
                  jump(
                    trace.frames.findIndex(
                      (f) => f.iteration === +e.target.value,
                    ),
                  )
                }
              >
                {Array.from({ length: config.rounds }, (_, i) => (
                  <option key={i}>{i + 1}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="ai-guided">
            <input
              type="checkbox"
              checked={guided}
              onChange={(e) => setGuided(e.target.checked)}
            />
            讲解模式：损失、梯度和更新处自动暂停
          </label>
          {share && (
            <label className="ai-share">
              复制此链接可还原设置与步骤
              <input
                aria-label="实验分享链接"
                readOnly
                value={share}
                onFocus={(e) => e.target.select()}
              />
            </label>
          )}
          <Curve values={frame.history} rl={rl} still={!!still} />
        </section>
        <aside className="ai-explanation" aria-label="AI 关键步骤讲解">
          <span className="eyebrow">
            {phaseNames[frame.phase]} /{" "}
            {String(frame.iteration).padStart(2, "0")}
          </span>
          <h2>{frame.title}</h2>
          <code>{frame.formula}</code>
          {[
            ["为什么这样做", frame.why],
            ["这一刻发生了什么", frame.change],
            ["边界与易错点", frame.check],
            ["停下来想一想", frame.question],
          ].map(([title, text]) => (
            <section key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </section>
          ))}
        </aside>
      </div>
      <div className="ai-data-panels">
        <TensorView
          key={`${frame.phase}-${frame.iteration}`}
          frame={frame}
          tick={position}
          effects={effects}
          speed={speed}
        />
        <section className="ai-parameters" aria-label="参数更新账本">
          <div className="ai-section-head">
            <h3>参数更新账本</h3>
            <select
              aria-label="参数组"
              value={selectedGroup}
              onChange={(e) => setGroup(e.target.value)}
            >
              <option value="all">全部参数</option>
              {groups.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>
          <p className="muted">
            {updated
              ? "已执行更新；下轮前向将读取右列新值。"
              : backward
                ? "已计算更新方向；右列是下一步的更新预览。"
                : "尚未反向计算，本轮参数保持不变。"}
            {rl && " 方向列 = −TD 误差。"}
          </p>
          <div className="ai-param-scroll">
            <table>
              <thead>
                <tr>
                  <th>参数</th>
                  <th>更新前</th>
                  <th>{rl ? "−δ" : "梯度"}</th>
                  <th>{updated ? "更新后" : "下一步预览"}</th>
                </tr>
              </thead>
              <tbody>
                {frame.updates
                  .filter(
                    (p) => selectedGroup === "all" || p.group === selectedGroup,
                  )
                  .map((p) => (
                    <tr key={p.name}>
                      <th>{p.name}</th>
                      <td>{fmt(p.before)}</td>
                      <td
                        className={
                          p.gradient > 0
                            ? "ai-positive"
                            : p.gradient < 0
                              ? "ai-negative"
                              : ""
                        }
                      >
                        {fmt(p.gradient)}
                      </td>
                      <td>
                        <motion.span
                          key={`${p.name}-${p.after}`}
                          initial={
                            still
                              ? false
                              : { opacity: 0, y: -5, filter: "blur(3px)" }
                          }
                          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                          transition={{ duration: still ? 0 : 0.4 }}
                        >
                          {fmt(p.after)}
                        </motion.span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!frame.updates.length && (
            <p>先收集环境反馈，再计算要修改的 Q 表项。</p>
          )}
        </section>
      </div>
      {position === trace.frames.length - 1 && (
        <div className="ai-result" role="status">
          <strong>本次实验结果</strong>
          <p>{trace.summary}</p>
        </div>
      )}
      <section className="ai-reading">
        <header>
          <span className="eyebrow">GO DEEPER</span>
          <h2>从看懂一步，到理解整个系统</h2>
        </header>
        <div className="ai-concepts">
          {content.concepts.map((c) => (
            <article key={c.title}>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
            </article>
          ))}
        </div>
        <details>
          <summary>计算成本、模型边界与进阶路线</summary>
          <h3>时间与空间复杂度</h3>
          <p>{content.complexity}</p>
          <h3>本实验的边界</h3>
          <p>{content.boundary}</p>
          <div className="lesson-links">
            {content.lessons.map((t) => (
              <button key={t} onClick={() => navigate("lesson", t)}>
                {topicById[t].name}
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        </details>
      </section>
      <section className="ai-exercises">
        <p className="eyebrow">PRACTICE / 手算 → 推导 → 编码</p>
        <h2>把刚看到的变化算出来</h2>
        <div>
          {content.exercises.map((id, i) => (
            <button key={id} onClick={() => navigate("practice", id)}>
              <span>0{i + 1}</span>
              <h3>{problemById[id]?.title}</h3>
              <p>{problemById[id]?.hint}</p>
              <footer>
                含提示、推导与参考代码 <ArrowRight size={16} />
              </footer>
            </button>
          ))}
        </div>
      </section>
      <p className="ai-sources">
        继续阅读：
        {content.sources.map((s) => (
          <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
            {s.title} ↗
          </a>
        ))}
      </p>
    </div>
  );
}
