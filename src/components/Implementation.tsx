import { useState } from "react";
import { Copy, Code2, Terminal } from "lucide-react";
import type { Topic } from "../content/types";
import { implementations } from "../content/implementations";
export function Implementation({
  topic,
  notify,
}: {
  topic: Topic;
  notify: (text: string) => void;
}) {
  const [language, setLanguage] = useState<"javascript" | "python">(
    "javascript",
  );
  const implementation = implementations[topic.id];
  const example = implementation.examples[0];
  const call =
    language === "javascript"
      ? `console.log(solve(...${JSON.stringify(example.args)}));`
      : `import json\nprint(solve(*json.loads(${JSON.stringify(JSON.stringify(example.args))})))`;
  const code = implementation[language] + "\n\n" + call;
  return (
    <div className="implementation-grid">
      <article className="article implementation-overview">
        <p className="eyebrow">READ → TRACE → IMPLEMENT</p>
        <h2>先抓住核心，再落到代码</h2>
        <p>{implementation.scope}</p>
        <h3>简洁伪代码</h3>
        <pre className="pseudocode">{implementation.pseudocode}</pre>
        <h3>输入与预期输出</h3>
        <p className="muted">
          输入按顺序对应 solve 的参数。下标从 0 开始；具体范围以本实现约定为准。
        </p>
        <div className="implementation-examples">
          {implementation.examples.map((e, i) => (
            <div key={i}>
              <span>样例 {i + 1} · 参数</span>
              <pre>{JSON.stringify(e.args, null, 2)}</pre>
              <span>返回值</span>
              <pre>{JSON.stringify(e.answer, null, 2)}</pre>
            </div>
          ))}
        </div>
        <p className="muted">
          这里展示独立的核心实现，覆盖范围已在上方标明。递归示例适合小规模学习；JS
          数值默认要求安全整数或有限浮点数。实现变体与动画可能不同，请结合复杂度说明比较。
        </p>
      </article>
      <article className="implementation-source" aria-label="多语言实现">
        <div className="implementation-toolbar">
          <span>
            <Code2 size={18} /> 核心实现
          </span>
          <label>
            语言{" "}
            <select
              aria-label="实现语言"
              value={language}
              onChange={(e) => setLanguage(e.target.value as typeof language)}
            >
              <option value="javascript">JavaScript · ES2022</option>
              <option value="python">Python 3</option>
            </select>
          </label>
          <button
            className="button compact"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code);
                notify("实现与调用样例已复制");
              } catch {
                notify("复制不可用，请在代码区手动选择。");
              }
            }}
          >
            <Copy size={14} />
            复制实现
          </button>
        </div>
        <pre
          className="implementation-code"
          tabIndex={0}
          aria-label={`${language} 实现代码`}
        >
          <code>{code}</code>
        </pre>
        <p className="code-caption">
          <Terminal size={15} /> 包含调用样例，可保存为{" "}
          {language === "javascript"
            ? "lesson.mjs 并用 Node.js 运行"
            : "lesson.py 并用 Python 3 运行"}
          。页面不执行用户代码。
        </p>
      </article>
    </div>
  );
}
