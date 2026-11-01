import { useLayoutEffect, useRef, useState, useMemo } from "react";
import { t } from "../i18n/text";
import { useLocale } from "../i18n/react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type NoteCell =
  | string
  | number
  | { value: string | number; changed: boolean; action?: string };
const cellValue = (cell: NoteCell) =>
  typeof cell === "object" ? cell.value : cell;
export type NoteBlock = {
  title: string;
  text?: string;
  columns?: string[];
  rows?: NoteCell[][];
};

function Block({
  block,
  onAction,
}: {
  block: NoteBlock;
  onAction?: (action: string) => void;
}) {
  return (
    <article className="note-block">
      <h5>{block.title}</h5>
      {block.text !== undefined && <p>{block.text}</p>}
      {block.rows && (
        <table className="trace-table">
          <thead>
            <tr>
              {block.columns?.map((c, i) => (
                <th key={i}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    data-changed={
                      (typeof cell === "object" && cell.changed) || undefined
                    }
                  >
                    {typeof cell === "object" && cell.action ? (
                      <button
                        className="note-cell-button"
                        onClick={() => onAction?.(cell.action!)}
                      >
                        {cell.value}
                      </button>
                    ) : (
                      cellValue(cell)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}

// Match Block's DOM exactly; measure real fonts, wrapping, table rows and gaps.
// textContent keeps both algorithm text and user input inert.
function measurementBlock(block: NoteBlock) {
  const article = document.createElement("article");
  article.className = "note-block";
  const heading = document.createElement("h5");
  heading.textContent = block.title;
  article.append(heading);
  if (block.text !== undefined) {
    const paragraph = document.createElement("p");
    paragraph.textContent = block.text;
    article.append(paragraph);
  }
  if (block.rows) {
    const table = document.createElement("table");
    table.className = "trace-table";
    const head = table.createTHead().insertRow();
    block.columns?.forEach((c) => {
      const cell = document.createElement("th");
      cell.textContent = c;
      head.append(cell);
    });
    const body = table.createTBody();
    block.rows.forEach((row) => {
      const tr = body.insertRow();
      row.forEach((c) => {
        const cell = tr.insertCell();
        if (typeof c === "object" && c.action) {
          const button = document.createElement("button");
          button.className = "note-cell-button";
          button.textContent = String(c.value);
          cell.append(button);
        } else cell.textContent = String(cellValue(c));
        if (typeof c === "object" && c.changed) cell.dataset.changed = "true";
      });
    });
    article.append(table);
  }
  return article;
}

function paginate(
  blocks: NoteBlock[],
  limit: number,
  height: (blocks: NoteBlock[]) => number,
): NoteBlock[][] {
  const pages: NoteBlock[][] = [];
  let page: NoteBlock[] = [];
  const flush = () => {
    if (page.length) pages.push(page);
    page = [];
  };
  for (const original of blocks) {
    let block: NoteBlock | undefined = original;
    while (block) {
      if (height([...page, block]) <= limit) {
        page.push(block);
        break;
      }
      const text =
        block.text !== undefined ? Array.from(block.text) : undefined;
      const length = text?.length ?? block.rows?.length ?? 0;
      let low = 0,
        high = length;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        const part = text
          ? { ...block, text: text.slice(0, middle).join("") }
          : { ...block, rows: block.rows?.slice(0, middle) };
        if (height([...page, part]) <= limit) low = middle;
        else high = middle - 1;
      }
      if (!low && page.length) {
        flush();
        continue;
      }
      if (!low && block.rows?.length) {
        // A tall cell must remain readable; turn that row into wrapped text.
        const row = block.rows[0];
        const textBlock = {
          title: block.title,
          text: row
            .map((c, j) => `${block!.columns?.[j] || j}：${cellValue(c)}`)
            .join("；"),
        };
        const rest = block.rows.slice(1);
        const split = paginate([textBlock], limit, height);
        pages.push(...split);
        block = rest.length ? { ...block, rows: rest } : undefined;
        continue;
      }
      // At supported viewport sizes at least one line fits. Keep data reachable
      // even if browser zoom leaves less than one line, without an infinite loop.
      low = Math.max(1, low);
      page.push(
        text
          ? { ...block, text: text.slice(0, low).join("") }
          : { ...block, rows: block.rows?.slice(0, low) },
      );
      flush();
      block =
        text && low < text.length
          ? {
              ...block,
              title: original.title + t("（续）"),
              text: text.slice(low).join(""),
            }
          : block.rows && low < block.rows.length
            ? { ...block, rows: block.rows.slice(low) }
            : undefined;
    }
  }
  flush();
  return pages.length ? pages : [[]];
}

export function AdaptiveNotes({
  blocks: originalBlocks,
  className,
  label,
  onAction,
}: {
  blocks: NoteBlock[];
  className: string;
  label: string;
  onAction?: (action: string) => void;
}) {
  const locale = useLocale();
  const blocks = useMemo(
    () =>
      originalBlocks.map((b) => ({
        ...b,
        title: t(b.title),
        text: b.text === undefined ? undefined : t(b.text),
        columns: b.columns?.map((c) => t(c)),
        rows: b.rows?.map((row) =>
          row.map((c) =>
            typeof c === "string"
              ? t(c)
              : typeof c === "object"
                ? {
                    ...c,
                    value: typeof c.value === "string" ? t(c.value) : c.value,
                  }
                : c,
          ),
        ),
      })),
    [originalBlocks, locale],
  );
  const deck = useRef<HTMLElement>(null),
    measure = useRef<HTMLDivElement>(null),
    pagerProbe = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<NoteBlock[][]>([blocks]),
    [page, setPage] = useState(0);
  useLayoutEffect(() => {
    let alive = true;
    const fit = () => {
      if (!alive || !deck.current || !measure.current) return;
      const height = (parts: NoteBlock[]) => {
        measure.current!.replaceChildren(...parts.map(measurementBlock));
        return measure.current!.getBoundingClientRect().height;
      };
      const available = deck.current.clientHeight - 2;
      if (available <= 0) return;
      // Do not reserve a footer when the entire section can fit on one page.
      const next =
        height(blocks) <= available
          ? [blocks]
          : paginate(
              blocks,
              available - (pagerProbe.current?.offsetHeight || 33),
              height,
            );
      measure.current.replaceChildren();
      setPages((old) =>
        JSON.stringify(old) === JSON.stringify(next) ? old : next,
      );
      setPage((old) => Math.min(old, next.length - 1));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(deck.current!);
    fit();
    void document.fonts.ready.then(fit);
    document.fonts.addEventListener("loadingdone", fit);
    return () => {
      alive = false;
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", fit);
    };
  }, [blocks]);
  const current = Math.min(page, pages.length - 1);
  return (
    <section ref={deck} className={`note-deck ${className}`} aria-label={label}>
      <div className="note-page" aria-live="polite">
        {pages[current].map((block, i) => (
          <Block block={block} key={i} onAction={onAction} />
        ))}
      </div>
      {pages.length > 1 && (
        <div className="experiment-pager" aria-label="讲解">
          <button
            aria-label="讲解上一页"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft size={14} />
          </button>
          <span>
            {current + 1} / {pages.length}
          </span>
          <button
            aria-label="讲解下一页"
            disabled={current === pages.length - 1}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
      <div
        className="note-page note-measure"
        ref={measure}
        aria-hidden="true"
        inert
      />
      <div
        className="experiment-pager pagination-probe"
        ref={pagerProbe}
        aria-hidden="true"
        inert
      >
        <button tabIndex={-1}>
          <ChevronLeft size={14} />
        </button>
        <span>1 / 2</span>
      </div>
    </section>
  );
}
