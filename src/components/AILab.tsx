import { useEffect, useMemo, useState, useRef } from "react";
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
  Maximize,
  Minimize,
} from "lucide-react";
import { aiLabs, phaseNames } from "../content/ai-labs";
import { defaults, runAILab, fmt } from "../engine/ai-labs";
import type { LabId, LabConfig } from "../engine/ai-labs";
import { AdaptiveNotes } from "./AdaptiveNotes";
import { FitDiagram, InlineData } from "./ExperimentPanels";
import { TensorView } from "./AITensor";
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
          {values.length && rl ? "1" : "0"}
        </text>
        <text x="580" y="113" fill="var(--muted)" fontSize="10">
          {rl ? values.length : Math.max(0, values.length - 1)}
        </text>
      </svg>
    </div>
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
    [panel, setPanel] = useState("讲解"),
    [parameter, setParameter] = useState(""),
    [fullscreen, setFullscreen] = useState(false),
    [compact, setCompact] = useState(
      () => matchMedia("(max-width: 760px)").matches,
    );
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sync = () =>
      setFullscreen(document.fullscreenElement === stage.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => {
    const query = matchMedia("(max-width: 760px)");
    const sync = () => setCompact(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
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
    if (panel === "分享") setPanel("讲解");
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
  const focus =
    frame.updates.find((p) => p.name === parameter) ||
    [...frame.updates].sort(
      (a, b) => Math.abs(b.gradient) - Math.abs(a.gradient),
    )[0];
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
      <button
        className="button compact case-enter"
        onClick={() =>
          stage.current?.scrollIntoView({ block: "start", behavior: "smooth" })
        }
      >
        进入图解实验 ↓
      </button>
      <section id="section-experiment" className="case-experiment">
        <div
          className="ai-workspace single-screen"
          data-panel={panel}
          ref={stage}
        >
          <section className="ai-stage" aria-label="AI 图解实验">
            <div className="ai-stage-top">
              <span className="eyebrow">
                {rl ? "EPISODE" : "EPOCH"} {frame.iteration} / {config.rounds}
              </span>
              <button
                className="text-button"
                aria-pressed={effects}
                onClick={() => setEffects(!effects)}
              >
                <Sparkles size={14} />
                {still ? "静态模式" : "光影流动"}
              </button>
              <button
                className="text-button"
                aria-label={fullscreen ? "退出专注模式" : "进入专注模式"}
                onClick={async () => {
                  if (document.fullscreenElement)
                    await document.exitFullscreen();
                  else if (stage.current?.requestFullscreen)
                    await stage.current.requestFullscreen();
                  else stage.current?.scrollIntoView({ block: "start" });
                }}
              >
                {fullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
              </button>
            </div>
            <div className="ai-phase-row">
              <select
                aria-label="训练阶段"
                value={frame.phase}
                onChange={(e) =>
                  jump(
                    rl
                      ? position -
                          (position % 4) +
                          content.steps.indexOf(e.target.value)
                      : trace.frames.findIndex(
                          (f) =>
                            f.iteration === frame.iteration &&
                            f.phase === e.target.value,
                        ),
                  )
                }
              >
                {content.steps.map((phase) => (
                  <option key={phase} value={phase}>
                    {phaseNames[phase]}
                  </option>
                ))}
              </select>
              <span>
                {backward && !rl
                  ? "← 梯度反传"
                  : rl
                    ? "行动 → 反馈 → Q 更新"
                    : "数据前传 → 参数更新"}
              </span>
            </div>
            <div className="ai-diagram-area">
              <InlineData
                className="ai-source"
                label="初始数据"
                items={trace.source}
              />
              <FitDiagram>
                {panel === "趋势" ? (
                  <Curve values={frame.history} rl={rl} still={!!still} />
                ) : (
                  <Diagram
                    key={compact ? "compact" : "wide"}
                    frame={
                      compact
                        ? {
                            ...frame.diagram,
                            nodes: frame.diagram.nodes?.map((n) => ({
                              ...n,
                              x: n.x * 0.7,
                              y: n.y * 0.7,
                            })),
                          }
                        : frame.diagram
                    }
                    kind="graph"
                    fitContent
                    tick={position}
                    effects={effects}
                    milliseconds={speed}
                    onInspect={(value) => {
                      setInspect(value);
                      setPanel("讲解");
                    }}
                  />
                )}
              </FitDiagram>
            </div>
            <div
              className={`ai-update-focus ${updated ? "is-updated" : ""}`}
              aria-label="当前参数更新"
            >
              {focus ? (
                <>
                  <div>
                    <strong>
                      {updated ? "已更新" : backward ? "更新预览" : "本轮参数"}
                    </strong>
                    <select
                      aria-label="观察参数"
                      value={focus.name}
                      onChange={(e) => setParameter(e.target.value)}
                    >
                      {frame.updates.map((p) => (
                        <option key={p.name}>{p.name}</option>
                      ))}
                    </select>
                    <span>{rl ? "方向 = −TD" : "η × 梯度"}</span>
                  </div>
                  {backward || updated ? (
                    <div className="ai-update-equation">
                      <span>{fmt(focus.before)}</span>
                      <span>−</span>
                      <span>
                        {config.rate} × ({fmt(focus.gradient)})
                      </span>
                      <span>=</span>
                      <motion.strong
                        key={`${focus.name}-${focus.after}`}
                        initial={still ? false : { opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        {fmt(focus.after)}
                      </motion.strong>
                    </div>
                  ) : (
                    <div className="ai-update-equation">
                      <strong>θ = {fmt(focus.before)}</strong>
                      <small>前向保持不变 · 反向后计算更新</small>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <strong>等待环境反馈</strong>
                  <span>先选择行动，再用奖励和下一状态计算 Q 的更新方向。</span>
                </>
              )}
            </div>
            <div className="ai-bottom-controls">
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
                    setPanel("分享");
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
                关键步骤自动暂停
              </label>
            </div>
          </section>
          <aside className="ai-inspector" aria-label="AI 实验观察面板">
            <div className="ai-current-step">
              <span>
                {phaseNames[frame.phase]} / {frame.iteration}
              </span>
              <h2>{frame.title}</h2>
            </div>
            <div className="experiment-note-tabs" aria-label="实验面板">
              {["讲解", "张量", "参数", "趋势", "设置"].map((name) => (
                <button
                  key={name}
                  aria-pressed={panel === name}
                  onClick={() => setPanel(name)}
                >
                  {name}
                </button>
              ))}
            </div>
            {panel === "讲解" && (
              <AdaptiveNotes
                key={`notes-${position}`}
                className="ai-explanation"
                label="AI 关键步骤讲解"
                blocks={[
                  ...(inspect ? [{ title: "图中检查", text: inspect }] : []),
                  {
                    title: compact ? frame.title : "计算公式",
                    text: frame.formula,
                  },
                  { title: "为什么这样做", text: frame.why },
                  { title: "这一刻发生了什么", text: frame.change },
                  { title: "边界与易错点", text: frame.check },
                  { title: "停下来想一想", text: frame.question },
                  ...(position === trace.frames.length - 1
                    ? [{ title: "本次实验结果", text: trace.summary }]
                    : []),
                ]}
              />
            )}
            {panel === "张量" && (
              <TensorView
                key={`${frame.phase}-${frame.iteration}`}
                frame={frame}
                still={!!still}
              />
            )}
            {panel === "参数" && (
              <section className="ai-parameters" aria-label="参数更新账本">
                <select
                  aria-label="参数组"
                  value={selectedGroup}
                  onChange={(e) => setGroup(e.target.value)}
                >
                  <option value="all">
                    全部参数 · {frame.updates.length} 项
                  </option>
                  {groups.map((g) => (
                    <option key={g} value={g}>
                      {g} · {frame.updates.filter((p) => p.group === g).length}{" "}
                      项
                    </option>
                  ))}
                </select>
                <AdaptiveNotes
                  key={`${position}-${selectedGroup}`}
                  className="ai-ledger"
                  label="参数账本分页"
                  blocks={[
                    {
                      title: updated
                        ? "已执行更新"
                        : backward
                          ? "下一步更新预览"
                          : "参数保持不变",
                      text: updated
                        ? "下轮前向读取新值。显示保留 4 位小数，计算使用完整精度。"
                        : backward
                          ? "方向已计算；下一步才写入参数。"
                          : "尚未反向计算。",
                    },
                    ...(frame.updates.length
                      ? [
                          {
                            title: rl ? "方向 = −TD 误差" : "θ′ = θ − η∇θ",
                            columns: [
                              "参数",
                              "更新前",
                              rl ? "−δ" : "梯度",
                              updated ? "更新后" : "预览",
                            ],
                            rows: frame.updates
                              .filter(
                                (p) =>
                                  selectedGroup === "all" ||
                                  p.group === selectedGroup,
                              )
                              .map((p) => [
                                p.name,
                                fmt(p.before),
                                backward || updated
                                  ? fmt(p.gradient)
                                  : "待计算",
                                fmt(p.after),
                              ]),
                          },
                        ]
                      : [
                          {
                            title: "收集环境反馈",
                            text: "行动和奖励确定后，才知道要修改哪一个 Q 表项。",
                          },
                        ]),
                  ]}
                />
              </section>
            )}
            {panel === "趋势" && (
              <section className="ai-trends" aria-label="训练趋势">
                <AdaptiveNotes
                  className="ai-result"
                  label="实验结果"
                  blocks={[
                    {
                      title:
                        position === trace.frames.length - 1
                          ? "本次实验结果"
                          : "观察收敛",
                      text:
                        position === trace.frames.length - 1
                          ? trace.summary
                          : rl
                            ? "回报逐回合记录。探索可能让单回合表现变差，不能用一条轨迹判断策略已最优。"
                            : "记录完整批次的损失。学习率太大可能使损失上升；比较多轮趋势与实际预测。",
                    },
                    {
                      title: "历史数值",
                      columns: [
                        rl ? "完成回合" : "更新轮数",
                        rl ? "回报" : "损失",
                      ],
                      rows: frame.history.map((v, i) => [
                        i + (rl ? 1 : 0),
                        fmt(v),
                      ]),
                    },
                  ]}
                />
              </section>
            )}
            {panel === "设置" && (
              <div className="ai-settings-panel">
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
                          {[...new Set([0, 0.25, 0.8, config.epsilon])].map(
                            (v) => (
                              <option key={v}>{v}</option>
                            ),
                          )}
                        </select>
                      </label>
                      <label>
                        折扣 γ
                        <select
                          aria-label="折扣因子"
                          value={config.gamma}
                          onChange={(e) => change("gamma", +e.target.value)}
                        >
                          {[...new Set([0, 0.5, 0.9, config.gamma])].map(
                            (v) => (
                              <option key={v}>{v}</option>
                            ),
                          )}
                        </select>
                      </label>
                    </>
                  )}
                  <p>
                    改变设置会从同一初始条件重新训练。拖动进度只回放，不额外训练。
                  </p>
                </section>
              </div>
            )}
            {panel === "分享" && (
              <div className="ai-settings-panel">
                {" "}
                {share && (
                  <label className="ai-share">
                    复制链接还原设置与步骤
                    <input
                      aria-label="实验分享链接"
                      readOnly
                      value={share}
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                )}
                <p className="muted">
                  链接包含实验设置和当前步骤。打开后可从同一状态继续观察。
                </p>
              </div>
            )}
          </aside>
        </div>
      </section>
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
