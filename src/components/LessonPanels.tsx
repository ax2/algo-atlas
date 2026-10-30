import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  TriangleAlert,
  Code2,
  Copy,
} from "lucide-react";
import type { Topic } from "../content/types";
import { engineSource } from "../engine";
export function Principles({ topic }: { topic: Topic }) {
  return (
    <div className="reading-grid">
      <article className="article">
        <h2>从一个直觉开始</h2>
        <p className="lead">{topic.analogy}</p>
        <p>{topic.intro}</p>
        <h2>它为什么有效？</h2>
        <blockquote>{topic.invariant}</blockquote>
        <p>
          每次操作都必须维护这条规则。你可以在图解实验里暂停，检查操作前后是否都满足它；如果不满足，就需要像旋转、回退或重新分区这样的修复步骤。
        </p>
        <h2>发展背景</h2>
        <p>{topic.history}</p>
        <p className="muted">
          历史采用简述口径；具体归属和完整发展脉络请继续阅读来源。基础方法未强行指定单一发明者。
        </p>
        <h2>用在什么地方？</h2>
        <div className="use-list">
          {topic.use.split("、").map((u, i) => (
            <div key={u}>
              <span>0{i + 1}</span>
              <strong>{u}</strong>
            </div>
          ))}
        </div>
        <h2>再深入一步</h2>
        <p>{topic.analysis}</p>
        <div className="warning">
          <TriangleAlert size={20} />
          <div>
            <strong>最容易踩的坑</strong>
            <p>{topic.caveat}</p>
          </div>
        </div>
      </article>
      <aside className="reading-aside">
        <BookOpen size={24} />
        <h3>带着问题阅读</h3>
        <ol>
          <li>状态里存的究竟是什么？</li>
          <li>为什么这一步不会丢失答案？</li>
          <li>什么输入会让它变慢？</li>
          <li>拿掉前提后会发生什么？</li>
        </ol>
        <a
          href={topic.source}
          target="_blank"
          rel="noreferrer"
          className="source-link"
        >
          教材与延伸资料 <ArrowUpRight size={16} />
        </a>
        <p>教学文本独立编写。来源是进一步学习入口，不是复制的课文。</p>
      </aside>
    </div>
  );
}
const curves = [
  { name: "O(1)", color: "#5de0bd", f: (_n: number) => 1 },
  { name: "O(log n)", color: "#8cbcff", f: (n: number) => Math.log2(n) },
  { name: "O(n)", color: "#b29bff", f: (n: number) => n },
  { name: "O(n log n)", color: "#ffcc80", f: (n: number) => n * Math.log2(n) },
  { name: "O(n²)", color: "#fa8a9c", f: (n: number) => n * n },
];
export function Complexity({ topic }: { topic: Topic }) {
  const [n, setN] = useState(32);
  return (
    <div className="complexity">
      <div className="cost-grid">
        {[
          ["最好情况", topic.best],
          ["平均 / 期望", topic.average],
          ["最坏情况", topic.worst],
          ["辅助 / 存储空间", topic.space],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="reading-grid">
        <article className="article">
          <h2>把复杂度拆开看</h2>
          <p>{topic.analysis}</p>
          <div className="warning">
            <TriangleAlert size={20} />
            <p>{topic.caveat}</p>
          </div>
          <h2>当输入变大，会发生什么？</h2>
          <p>
            下图比较理想化增长函数。纵轴为 log₁₀(操作量 +
            1)，并非线性尺度；数值是增长模型，不是本机跑分。
          </p>
          <label className="scale-control">
            输入规模 n = <b>{n}</b>
            <input
              aria-label="复杂度输入规模"
              type="range"
              min="2"
              max="256"
              value={n}
              onChange={(e) => setN(+e.target.value)}
            />
          </label>
          <svg
            className="growth-chart"
            viewBox="0 0 640 250"
            role="img"
            aria-label="常见复杂度增长曲线，对数纵轴"
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <g key={i}>
                <line x1="45" y1={220 - i * 38} x2="620" y2={220 - i * 38} />
                <text x="5" y={224 - i * 38}>
                  10^{i}
                </text>
              </g>
            ))}
            {curves.map((c) => (
              <path
                key={c.name}
                stroke={c.color}
                d={Array.from({ length: 64 }, (_, i) => {
                  const x = 2 + (i * 254) / 63;
                  return `${i ? "L" : "M"}${45 + ((x - 2) / 254) * 575},${220 - Math.log10(c.f(x) + 1) * 38}`;
                }).join(" ")}
              />
            ))}
            <line
              className="cursor-line"
              x1={45 + ((n - 2) / 254) * 575}
              x2={45 + ((n - 2) / 254) * 575}
              y1="15"
              y2="220"
            />
            <text x="560" y="245">
              n → 256
            </text>
          </svg>
          <div className="curve-values">
            {curves.map((c) => (
              <div key={c.name}>
                <span style={{ color: c.color }}>{c.name}</span>
                <b>{Math.round(c.f(n)).toLocaleString()}</b>
              </div>
            ))}
          </div>
        </article>
        <aside className="reading-aside">
          <h3>不止一个 Big-O</h3>
          <dl>
            <dt>O / Ω / Θ</dt>
            <dd>
              分别是渐近上界、下界、紧确界。Big-O
              本身不表示“最坏情况”，它可以修饰不同情况的成本函数。
            </dd>
            <dt>平均与期望</dt>
            <dd>
              平均通常要求输入分布假设；期望还可能来自算法自身随机性。没有假设，不能直接给“平均很快”的结论。
            </dd>
            <dt>摊还分析</dt>
            <dd>
              对一串操作的总成本取平均，和随机概率无关。动态数组一次扩容慢，整串追加仍可以线性。
            </dd>
            <dt>空间与回放</dt>
            <dd>
              课程标注算法本身的空间。教学播放器为了回退保存所有帧，实际内存会额外增长。
            </dd>
            <dt>参数与计算模型</dt>
            <dd>
              图使用 V/E，字符串使用 n/m，背包使用容量
              W。大整数运算、I/O、比较成本不能无条件当作常数。
            </dd>
          </dl>
        </aside>
      </div>
    </div>
  );
}
export function Practice({
  topic,
  onComplete,
  notify,
}: {
  topic: Topic;
  onComplete: () => void;
  notify: (s: string) => void;
}) {
  const [choice, setChoice] = useState<number | null>(null),
    [showCode, setShowCode] = useState(false);
  const options = [
    topic.invariant,
    "只要示例输入运行正确，就能保证所有输入都正确。",
    "省略输入前提不会影响算法的正确性与复杂度。",
  ];
  const rotation = topic.id.length % 3;
  const choices = options.map((_, i) => options[(i + rotation) % 3]);
  const correct = choices.indexOf(topic.invariant);
  return (
    <div className="reading-grid">
      <article className="article">
        <div className="practice-title">
          <Lightbulb size={26} />
          <div>
            <h2>先预测，再运行</h2>
            <p>哪条描述是「{topic.name}」需要维护的关键规则？</p>
          </div>
        </div>
        <div className="answer-options">
          {choices.map((text, i) => (
            <button
              key={i}
              className={
                choice === i ? (i === correct ? "correct" : "incorrect") : ""
              }
              onClick={() => setChoice(i)}
            >
              <b>{String.fromCharCode(65 + i)}</b>
              {text}
            </button>
          ))}
        </div>
        {choice !== null && (
          <div
            className={
              choice === correct
                ? "answer-feedback correct"
                : "answer-feedback incorrect"
            }
            role="status"
          >
            {choice === correct
              ? `回答正确。${topic.analysis}`
              : `再想一下：${topic.caveat} 请回到实验检查真正需要维持的规则。`}
          </div>
        )}
        <h2>动手实验任务</h2>
        <ol className="task-list">
          <li>先写下对下一步状态的预测，再点击“单步”。</li>
          <li>找到至少一帧，解释它如何维护“{topic.invariant}”。</li>
          <li>根据“{topic.caveat}”构造边界输入，或者切换另一个场景。</li>
          <li>把实验中使用的输入、观察与复杂度前提写入笔记。</li>
        </ol>
        <button className="button primary" onClick={onComplete}>
          <CheckCircle2 size={17} /> 标记本课已掌握
        </button>
        <h2>查看真实实验实现</h2>
        <p>
          这里展示运行当前实验的 TypeScript
          引擎源文件；同类课程共享辅助代码，通过 id
          选择对应分支。它是教学轨迹生成器，包含帧记录，并非可直接用于生产的算法库。
        </p>
        <button className="button" onClick={() => setShowCode(!showCode)}>
          <Code2 size={17} />
          {showCode ? "收起源码" : "展开引擎源码"}
        </button>
        {showCode && (
          <div className="code-panel">
            <button
              className="button compact"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(engineSource(topic.id));
                  notify("引擎源码已复制");
                } catch {
                  notify("浏览器不允许复制，请在代码区手动选择。");
                }
              }}
            >
              <Copy size={14} />
              复制
            </button>
            <pre>
              <code>{engineSource(topic.id)}</code>
            </pre>
          </div>
        )}
      </article>
      <aside className="reading-aside">
        <h3>从会看，到会写</h3>
        <p>建议用你熟悉的语言重写核心计算，再用这里的输入与结果做对照。</p>
        <h4>验证至少覆盖</h4>
        <ul>
          <li>最小合法输入</li>
          <li>重复值与已排序输入</li>
          <li>不存在的目标 / 不可达状态</li>
          <li>题目明确禁止的输入</li>
        </ul>
        <a
          className="source-link"
          href="https://github.com/ax2/algo-atlas/tree/main/src/engine"
          target="_blank"
          rel="noreferrer"
        >
          在 GitHub 阅读源码 <ArrowUpRight size={15} />
        </a>
      </aside>
    </div>
  );
}
