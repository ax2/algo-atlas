import { useRef, useState } from "react";
import {
  Download,
  Upload,
  Star,
  NotebookPen,
  CheckCircle2,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import type { LearningData } from "../services/learning";
import {
  exportLearning,
  mergeLearning,
  validateLearning,
} from "../services/learning";
import { topics, topicById } from "../content/catalog";
import { navigate } from "../services/routing";
export function Learning({
  data,
  update,
  notify,
}: {
  data: LearningData;
  update: (x: LearningData) => void;
  notify: (s: string) => void;
}) {
  const [tab, setTab] = useState("favorites"),
    file = useRef<HTMLInputElement>(null);
  const selected =
    tab === "favorites"
      ? data.favorites
      : tab === "completed"
        ? data.completed
        : Object.keys(data.notes).filter((id) => data.notes[id].trim());
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>
            我的学习<span>Your own trail</span>
          </h1>
          <p>收藏值得重访的思路，把理解留在自己的笔记里。</p>
        </div>
        <div className="header-actions">
          <button className="button" onClick={() => exportLearning(data)}>
            <Download size={16} /> 导出备份
          </button>
          <button className="button" onClick={() => file.current?.click()}>
            <Upload size={16} /> 导入备份
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                if (f.size > 2 * 1024 * 1024)
                  throw new Error("备份文件不得超过 2 MB。");
                const incoming = validateLearning(JSON.parse(await f.text()));
                update(mergeLearning(data, incoming));
                notify("已合并备份；不同内容的笔记保留为两段。");
              } catch (err) {
                notify((err as Error).message);
              } finally {
                e.target.value = "";
              }
            }}
          />
        </div>
      </header>
      <div className="progress-banner">
        <div
          className="progress-ring"
          style={
            {
              "--progress": `${(data.completed.length / topics.length) * 100}%`,
            } as React.CSSProperties
          }
        >
          <strong>
            {Math.round((data.completed.length / topics.length) * 100)}
            <small>%</small>
          </strong>
        </div>
        <div>
          <h2>每理解一个原理，就点亮一块地图。</h2>
          <p>
            已掌握 {data.completed.length} / {topics.length} 个单元 ·{" "}
            {data.favorites.length} 项收藏 ·{" "}
            {Object.values(data.notes).filter((x) => x.trim()).length} 篇笔记
          </p>
          <button
            className="text-button"
            onClick={() =>
              navigate(
                "lesson",
                topics.find((t) => !data.completed.includes(t.id))?.id ||
                  "quick",
              )
            }
          >
            继续探索 <ArrowUpRight size={15} />
          </button>
        </div>
      </div>
      <div className="category-tabs">
        {[
          ["favorites", "我的收藏", Star],
          ["notes", "学习笔记", NotebookPen],
          ["completed", "已掌握", CheckCircle2],
        ].map(([id, name, Icon]) => {
          const I = Icon as typeof Star;
          return (
            <button
              key={id as string}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id as string)}
            >
              <I size={17} />
              {name as string}
            </button>
          );
        })}
      </div>
      <div className="learning-list">
        {selected.map((id) => (
          <button key={id} onClick={() => navigate("lesson", id)}>
            <div>
              <h3>
                {topicById[id].name}
                <span>{topicById[id].en}</span>
              </h3>
              <p>{tab === "notes" ? data.notes[id] : topicById[id].intro}</p>
            </div>
            <ArrowUpRight size={18} />
          </button>
        ))}
      </div>
      {!selected.length && (
        <div className="empty-state">
          <NotebookPen size={32} />
          <h3>这里等着你的第一个发现</h3>
          <p>打开任意课程，收藏、写笔记，或标记已掌握。</p>
          <button
            className="button primary"
            onClick={() => navigate("catalog")}
          >
            探索知识图谱
          </button>
        </div>
      )}
      <div className="local-notice">
        <ShieldCheck size={20} />
        <div>
          <strong>学习数据保存在当前浏览器</strong>
          <p>
            清除网站数据或更换设备会影响本地记录，请定期导出。分享链接不会携带笔记。在线账号与同步服务已预留接口，目前未启用。
          </p>
        </div>
      </div>
    </>
  );
}
