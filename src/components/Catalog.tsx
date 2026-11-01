import { useState } from "react";
import { ArrowUpRight, Star, Search, ArrowRight } from "lucide-react";
import { topics } from "../content/catalog";
import { categories, levels } from "../content/types";
import { navigate } from "../services/routing";
import { t as translate } from "../i18n/text";
export function Catalog({
  query,
  setQuery,
  category,
  favorites,
}: {
  query: string;
  setQuery: (s: string) => void;
  category: string;
  favorites: string[];
}) {
  const [level, setLevel] = useState("all"),
    [sort, setSort] = useState("importance"),
    [onlyFav, setOnlyFav] = useState(false);
  const filtered = topics
    .filter(
      (t) =>
        (!category || t.category === category) &&
        (level === "all" || t.level === +level) &&
        (!onlyFav || favorites.includes(t.id)) &&
        `${t.name} ${t.en} ${t.id} ${translate(t.intro)} ${translate(t.use)} ${t.intro} ${t.use}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === "level"
        ? a.level - b.level
        : sort === "popularity"
          ? b.popularity - a.popularity
          : b.importance - a.importance,
    );
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>
            知识图谱<span>Explore the atlas</span>
          </h1>
          <p>从一条直觉出发，连接整个计算世界。</p>
        </div>
        <span className="big-count">
          {topics.length}
          <small> 个学习单元</small>
        </span>
      </header>
      <div className="learning-path">
        <strong>第一次来？从这里开始</strong>
        {["array", "stack", "binary-search", "quick", "bfs", "knapsack"].map(
          (id, i) => (
            <button key={id} onClick={() => navigate("lesson", id)}>
              <span>{i + 1}</span>
              {topics.find((t) => t.id === id)!.name}
              <ArrowRight size={14} />
            </button>
          ),
        )}
      </div>
      <div className="category-tabs">
        <button
          className={!category ? "active" : ""}
          onClick={() => navigate("catalog")}
        >
          全部主题
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={category === c.id ? "active" : ""}
            onClick={() => navigate("catalog", c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="catalog-toolbar">
        <div className="search-field">
          <Search size={18} />
          <input
            aria-label="目录搜索"
            placeholder="搜索名称、英文名、用途…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label="难度筛选"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        >
          <option value="all">所有难度</option>
          {levels.map((s, i) => (
            <option key={s} value={i}>
              {s}
            </option>
          ))}
        </select>
        <select
          aria-label="排序方式"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="importance">重要程度优先</option>
          <option value="popularity">常用程度优先</option>
          <option value="level">从易到难</option>
        </select>
        <button
          className={`button ${onlyFav ? "selected" : ""}`}
          onClick={() => setOnlyFav(!onlyFav)}
        >
          <Star size={16} />
          只看收藏
        </button>
      </div>
      <div className="catalog-meta">
        <span>找到 {filtered.length} 个单元</span>
        <span>难度 / 重要性 / 常用度为编辑评级，并非实时使用统计</span>
      </div>
      <div className="catalog-list">
        {filtered.map((t) => (
          <button
            className="topic-row"
            key={t.id}
            onClick={() => navigate("lesson", t.id)}
          >
            <div className={`topic-glyph ${t.category}`}>
              <span>
                {t.category === "graphs"
                  ? "◇"
                  : t.category === "structures"
                    ? "▤"
                    : t.category === "strings"
                      ? "Aa"
                      : t.category === "math"
                        ? "ƒ"
                        : t.category === "patterns"
                          ? "↗"
                          : "↕"}
              </span>
            </div>
            <div className="topic-row-main">
              <h3>
                {t.name}
                {favorites.includes(t.id) && (
                  <Star size={13} fill="currentColor" />
                )}
                <small>{t.en}</small>
              </h3>
              <p>{t.intro}</p>
            </div>
            <span className={`difficulty level-${t.level}`}>
              {levels[t.level]}
            </span>
            <div className="rating">
              <span>重要性</span>
              <b>
                {"●".repeat(t.importance)}
                <em>{"○".repeat(5 - t.importance)}</em>
              </b>
            </div>
            <div className="rating">
              <span>常用度</span>
              <b>
                {"●".repeat(t.popularity)}
                <em>{"○".repeat(5 - t.popularity)}</em>
              </b>
            </div>
            <ArrowUpRight size={19} />
          </button>
        ))}
      </div>
      {!filtered.length && (
        <div className="empty-state">
          <Search size={32} />
          <h3>没有找到匹配单元</h3>
          <p>尝试更短的关键词，或取消难度和收藏筛选。</p>
          <button
            className="button"
            onClick={() => {
              setQuery("");
              setLevel("all");
              setOnlyFav(false);
              navigate("catalog");
            }}
          >
            重置筛选
          </button>
        </div>
      )}
    </>
  );
}
