import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  Star,
  NotebookPen,
  Share2,
  ChevronDown,
  ChevronRight,
  Layers3,
  Network,
  ChartNoAxesCombined,
  Braces,
  Shapes,
  BookOpen,
  Map,
  PanelLeftClose,
  Menu,
  X,
  CheckCircle2,
  Sun,
  Moon,
  ArrowLeft,
  Copy,
  ExternalLink,
  Check,
  GraduationCap,
  BrainCircuit,
} from "lucide-react";
import { topics, topicById } from "./content/catalog";
import { categories, levels } from "./content/types";
import { readRoute, navigate, makeShare } from "./services/routing";
import { localRepository } from "./services/learning";
import type { LearningData } from "./services/learning";
import { Experiment } from "./components/Experiment";
import type { ExperimentState } from "./components/Experiment";
import { Principles, Complexity, Practice } from "./components/LessonPanels";
import { Catalog } from "./components/Catalog";
import { Learning } from "./components/Learning";
import { Cases } from "./components/Cases";
import { PracticeLibrary } from "./components/PracticeLibrary";
import { problems } from "./content/problems";
const categoryIcons = [
  Layers3,
  ChartNoAxesCombined,
  Network,
  Shapes,
  Braces,
  GraduationCap,
  BrainCircuit,
];
const tabs = [
  ["experiment", "图解实验", ChartNoAxesCombined],
  ["principles", "原理与历史", BookOpen],
  ["complexity", "复杂度分析", ChartNoAxesCombined],
  ["practice", "代码与练习", Braces],
] as const;
export default function App() {
  const [route, setRoute] = useState(readRoute),
    [data, setData] = useState(localRepository.load),
    [query, setQuery] = useState(""),
    [tab, setTab] = useState("experiment"),
    [openGroups, setOpenGroups] = useState<string[]>(() => [
      topicById[readRoute().id]?.category || "sorting",
    ]),
    [menu, setMenu] = useState(false),
    [dialog, setDialog] = useState<"notes" | "share" | null>(null),
    [toast, setToast] = useState(""),
    [theme, setTheme] = useState(() => {
      try {
        return localStorage.getItem("algo-atlas.theme") || "dark";
      } catch {
        return "dark";
      }
    }),
    [share, setShare] = useState("");
  const topic = topicById[route.id] || topicById.quick,
    searchRef = useRef<HTMLInputElement>(null),
    toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    closeRef = useRef<HTMLButtonElement>(null),
    priorFocus = useRef<HTMLElement | null>(null),
    dialogRef = useRef<HTMLDivElement>(null);
  const initial: ExperimentState = {
    input: route.params.get("data") || topic.input,
    target: Math.min(99, Math.max(0, Number(route.params.get("target") ?? 5))),
    step: Math.max(0, Math.min(5000, Number(route.params.get("step")) || 0)),
  };
  const experiment = useRef(initial);
  const onExperiment = useCallback((s: ExperimentState) => {
    experiment.current = s;
  }, []);
  const notify = useCallback((s: string) => {
    setToast(s);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }, []);
  const update = useCallback(
    (next: LearningData) => {
      const saved = { ...next, updatedAt: new Date().toISOString() };
      setData(saved);
      try {
        localRepository.save(saved);
      } catch {
        notify("浏览器存储不可用或已满；本次修改只在内存中，请立即导出备份。");
      }
    },
    [notify],
  );
  useEffect(() => {
    const change = () => {
      const r = readRoute();
      const nextTopic = topicById[r.id] || topicById.quick;
      experiment.current = {
        input: r.params.get("data") || nextTopic.input,
        target: Math.min(99, Math.max(0, Number(r.params.get("target") ?? 5))),
        step: Math.max(0, Math.min(5000, Number(r.params.get("step")) || 0)),
      };
      setRoute(r);
      setTab("experiment");
      setMenu(false);
      setDialog(null);
      if (topicById[r.id])
        setOpenGroups((g) => [...new Set([...g, topicById[r.id].category])]);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("algo-atlas.theme", theme);
    } catch {
      /* The theme still works in memory. */
    }
  }, [theme]);
  useEffect(() => {
    document.title =
      route.view === "lesson"
        ? `${topic.name} · Algo Atlas`
        : "Algo Atlas · 算法图谱";
  }, [route.view, topic.name]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setDialog(null);
        setMenu(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (dialog) {
      priorFocus.current = document.activeElement as HTMLElement;
      closeRef.current?.focus();
      const trap = (e: KeyboardEvent) => {
        if (e.key !== "Tab") return;
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button,input,textarea,a[href],[tabindex="0"]',
        );
        if (!focusable?.length) return;
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      };
      document.addEventListener("keydown", trap);
      return () => {
        document.removeEventListener("keydown", trap);
        priorFocus.current?.focus();
      };
    }
  }, [dialog]);
  const favorite = data.favorites.includes(topic.id),
    complete = data.completed.includes(topic.id);
  const toggleFavorite = () => {
    update({
      ...data,
      favorites: favorite
        ? data.favorites.filter((x) => x !== topic.id)
        : [...data.favorites, topic.id],
    });
    notify(favorite ? "已取消收藏" : "已收藏，可在“我的学习”中找到");
  };
  const markComplete = () => {
    update({
      ...data,
      completed: complete ? data.completed : [...data.completed, topic.id],
    });
    notify("已标记掌握；进度已保存");
  };
  return (
    <div className="app">
      <a
        href="#main"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        跳到主要内容
      </a>
      {menu && (
        <button
          className="nav-backdrop"
          aria-label="关闭导航"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a className="brand" href="#/lesson/quick">
          <svg viewBox="0 0 44 44" aria-hidden="true">
            <path d="M4 36 22 5 40 36H31L22 20 13 36Z" />
            <path d="m17 36 5-9 5 9" />
          </svg>
          <span>
            <strong>Algo Atlas</strong>
            <small>算法图谱</small>
          </span>
        </a>
        <button
          className="close-nav icon-button"
          aria-label="关闭侧栏"
          onClick={() => setMenu(false)}
        >
          <PanelLeftClose size={19} />
        </button>
        <nav aria-label="主导航">
          <button
            className={
              route.view === "catalog" ? "nav-item active" : "nav-item"
            }
            onClick={() => navigate("catalog")}
          >
            <Map size={20} />
            知识图谱<span>{topics.length}</span>
          </button>
          <button
            className={route.view === "cases" ? "nav-item active" : "nav-item"}
            onClick={() => navigate("cases")}
          >
            <Shapes size={20} />
            综合专题<span>6</span>
          </button>
          <button
            className={
              route.view === "practice" ? "nav-item active" : "nav-item"
            }
            onClick={() => navigate("practice")}
          >
            <GraduationCap size={20} />
            练习库<span>{problems.length}</span>
          </button>
          <button
            className={
              route.view === "learning" ? "nav-item active" : "nav-item"
            }
            onClick={() => navigate("learning")}
          >
            <ChartNoAxesCombined size={20} />
            我的学习
            {data.completed.length > 0 && <span>{data.completed.length}</span>}
          </button>
          <div className="nav-divider" />
          <div className="nav-label">
            数据结构与算法 <span>{topics.length} 单元</span>
          </div>
          <div className="topic-navigation">
            {categories.map((category, i) => {
              const Icon = categoryIcons[i],
                open = openGroups.includes(category.id);
              return (
                <div className="nav-group" key={category.id}>
                  <button
                    className={`group-button ${route.view === "lesson" && topic.category === category.id ? "selected" : ""}`}
                    aria-expanded={open}
                    onClick={() =>
                      setOpenGroups((g) =>
                        open
                          ? g.filter((x) => x !== category.id)
                          : [...g, category.id],
                      )
                    }
                  >
                    <Icon size={19} />
                    <span>{category.name}</span>
                    {open ? (
                      <ChevronDown size={15} />
                    ) : (
                      <ChevronRight size={15} />
                    )}
                  </button>
                  {open && (
                    <div className="topic-children">
                      {topics
                        .filter((t) => t.category === category.id)
                        .map((t) => (
                          <button
                            key={t.id}
                            className={
                              route.view === "lesson" && topic.id === t.id
                                ? "selected"
                                : ""
                            }
                            onClick={() => navigate("lesson", t.id)}
                          >
                            <i />
                            {t.name}
                            {data.completed.includes(t.id) && (
                              <Check size={12} />
                            )}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>
        <footer className="sidebar-footer">
          <span className="local-dot" />
          本地学习模式
          <button
            className="icon-button"
            aria-label={theme === "dark" ? "切换浅色主题" : "切换深色主题"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </footer>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="打开导航"
            onClick={() => setMenu(true)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            <button
              aria-label="返回知识图谱"
              onClick={() => navigate("catalog")}
            >
              <ArrowLeft size={17} />
            </button>
            <span>
              {route.view === "lesson"
                ? "算法"
                : route.view === "cases"
                  ? "探索"
                  : route.view === "practice"
                    ? "练习库"
                    : route.view === "learning"
                      ? "个人空间"
                      : "学习"}
            </span>
            <span>/</span>
            <strong>
              {route.view === "lesson"
                ? categories.find((c) => c.id === topic.category)!.name
                : route.view === "cases"
                  ? "综合专题"
                  : route.view === "practice"
                    ? "练习库"
                    : route.view === "learning"
                      ? "我的学习"
                      : "知识图谱"}
            </strong>
          </div>
          <div className="global-search">
            <Search size={18} />
            <input
              ref={searchRef}
              aria-label="全局搜索"
              placeholder="搜索算法、数据结构…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (route.view !== "catalog") navigate("catalog");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") navigate("catalog");
              }}
            />
            <kbd>Ctrl K</kbd>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {route.view === "lesson" ? (
            <>
              <header className="lesson-header">
                <div className="lesson-title-row">
                  <h1>
                    {topic.name}
                    <span>{topic.en}</span>
                  </h1>
                  <div className="header-actions">
                    <button
                      className={`button ${favorite ? "selected" : ""}`}
                      onClick={toggleFavorite}
                      aria-label={favorite ? "取消收藏" : "收藏"}
                      aria-pressed={favorite}
                    >
                      <Star
                        size={18}
                        fill={favorite ? "currentColor" : "none"}
                      />
                      <span>{favorite ? "已收藏" : "收藏"}</span>
                    </button>
                    <button
                      className="button"
                      aria-label="笔记"
                      onClick={() => setDialog("notes")}
                    >
                      <NotebookPen size={18} />
                      <span>笔记</span>
                      {data.notes[topic.id]?.trim() && (
                        <i className="note-dot" />
                      )}
                    </button>
                    <button
                      className="button"
                      aria-label="分享"
                      onClick={() => {
                        const s = experiment.current;
                        setShare(
                          makeShare(topic.id, s.input, s.target, s.step),
                        );
                        setDialog("share");
                      }}
                    >
                      <Share2 size={18} />
                      <span>分享</span>
                    </button>
                  </div>
                </div>
                <div className="lesson-description">
                  <p>{topic.intro}</p>
                  <div className="badges">
                    <span className={`badge difficulty level-${topic.level}`}>
                      难度 <b>{levels[topic.level]}</b>
                    </span>
                    <span className="badge importance">
                      重要性 <b>{topic.importance === 5 ? "核心" : "重要"}</b>
                    </span>
                    <span
                      className="badge popularity"
                      title="编辑评级，不是实时统计"
                    >
                      常用度{" "}
                      <b>
                        {topic.popularity === 5
                          ? "广泛"
                          : topic.popularity === 4
                            ? "常用"
                            : "特定"}
                      </b>
                    </span>
                  </div>
                </div>
              </header>
              <div className="lesson-tabs" role="tablist" aria-label="课程章节">
                {tabs.map(([id, label, Icon]) => (
                  <button
                    role="tab"
                    aria-selected={tab === id}
                    aria-controls="lesson-panel"
                    id={`tab-${id}`}
                    key={id}
                    onClick={() => setTab(id)}
                    className={tab === id ? "active" : ""}
                  >
                    <Icon size={21} />
                    {label}
                  </button>
                ))}
                <button
                  className={`complete-button ${complete ? "selected" : ""}`}
                  title={complete ? "点击取消已掌握" : "标记已掌握"}
                  onClick={() => {
                    if (complete)
                      update({
                        ...data,
                        completed: data.completed.filter((x) => x !== topic.id),
                      });
                    else markComplete();
                  }}
                >
                  <CheckCircle2 size={17} />
                  <span>{complete ? "已掌握" : "标记掌握"}</span>
                </button>
              </div>
              <div
                id="lesson-panel"
                role="tabpanel"
                aria-labelledby={`tab-${tab}`}
                key={topic.id + route.params.toString()}
              >
                {tab === "experiment" ? (
                  <Experiment
                    topic={topic}
                    initial={experiment.current}
                    onState={onExperiment}
                  />
                ) : tab === "principles" ? (
                  <Principles topic={topic} />
                ) : tab === "complexity" ? (
                  <Complexity topic={topic} />
                ) : (
                  <Practice
                    topic={topic}
                    onComplete={markComplete}
                    notify={notify}
                  />
                )}
              </div>
            </>
          ) : route.view === "catalog" ? (
            <Catalog
              query={query}
              setQuery={setQuery}
              category={
                categories.some((c) => c.id === route.id) ? route.id : ""
              }
              favorites={data.favorites}
            />
          ) : route.view === "practice" ? (
            <PracticeLibrary
              key={route.id + "?" + route.params}
              id={route.id}
              topic={route.params.get("topic") || ""}
              data={data}
              update={update}
            />
          ) : route.view === "cases" ? (
            <Cases key={route.id} id={route.id} />
          ) : (
            <Learning data={data} update={update} notify={notify} />
          )}
          <footer className="main-footer">
            <span>Algo Atlas · 理解比记住更重要</span>
            <a
              href="https://github.com/ax2/algo-atlas"
              target="_blank"
              rel="noreferrer"
            >
              MIT 开源 <ExternalLink size={12} />
            </a>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}
      {dialog && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDialog(null);
          }}
        >
          <div
            ref={dialogRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <header>
              <h2 id="dialog-title">
                {dialog === "notes"
                  ? `${topic.name} · 学习笔记`
                  : "分享这一刻的理解"}
              </h2>
              <button
                ref={closeRef}
                className="icon-button"
                aria-label="关闭对话框"
                onClick={() => setDialog(null)}
              >
                <X size={21} />
              </button>
            </header>
            {dialog === "notes" ? (
              <>
                <p>记下自己的解释、反例与未解的问题。自动保存到当前浏览器。</p>
                <textarea
                  aria-label="学习笔记"
                  placeholder="试着用自己的话说明：这一步为什么成立？"
                  maxLength={20000}
                  value={data.notes[topic.id] || ""}
                  onChange={(e) =>
                    update({
                      ...data,
                      notes: { ...data.notes, [topic.id]: e.target.value },
                    })
                  }
                />
                <footer>
                  <span>{(data.notes[topic.id] || "").length} / 20,000 字</span>
                  <button
                    className="button primary"
                    onClick={() => setDialog(null)}
                  >
                    完成
                  </button>
                </footer>
              </>
            ) : (
              <>
                <p>
                  链接包含课程、输入数据、搜索目标与当前步骤，不含收藏或私人笔记。
                </p>
                <input
                  aria-label="分享链接"
                  readOnly
                  value={share}
                  onFocus={(e) => e.target.select()}
                />
                <p className="muted">
                  本机地址只能在当前设备打开；部署到公共网址后，同样的链接可供其他人访问。
                </p>
                <button
                  className="button primary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(share);
                      notify("分享链接已复制");
                    } catch {
                      notify("复制被浏览器阻止，请手动选择上方链接。");
                    }
                  }}
                >
                  <Copy size={16} />
                  复制链接
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
