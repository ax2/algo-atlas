import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { LabFrame } from "../engine/ai-labs";
import { fmt } from "../engine/ai-labs";

// Keep numerical cells readable: page rows/columns at their real pixel size.
// Original row/column indices remain stable when the viewport or tensor changes.
export function TensorView({
  frame,
  still,
}: {
  frame: LabFrame;
  still: boolean;
}) {
  const [selected, setSelected] = useState(0),
    [row, setRow] = useState(0),
    [col, setCol] = useState(0),
    [size, setSize] = useState({ rows: 1, cols: 4 }),
    [inspect, setInspect] = useState("");
  const box = useRef<HTMLDivElement>(null),
    head = useRef<HTMLTableSectionElement>(null);
  const tensor = frame.tensors[Math.min(selected, frame.tensors.length - 1)];
  useLayoutEffect(() => {
    const measure = () => {
      const rows = Math.max(
        1,
        Math.floor(
          (box.current!.clientHeight - (head.current?.offsetHeight || 28) - 2) /
            28,
        ),
      );
      const cols = Math.max(
        1,
        Math.floor((box.current!.clientWidth - 36) / 64),
      );
      setSize((old) =>
        old.rows === rows && old.cols === cols ? old : { rows, cols },
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(box.current!);
    if (head.current) observer.observe(head.current);
    measure();
    return () => observer.disconnect();
  }, [tensor]);
  const ncols = Math.max(...tensor.rows.map((r) => r.length)),
    r = Math.min(row, Math.max(0, tensor.rows.length - size.rows)),
    c = Math.min(col, Math.max(0, ncols - size.cols)),
    columns = Array.from(
      { length: Math.min(size.cols, ncols - c) },
      (_, i) => c + i,
    );
  return (
    <section className="ai-tensor" aria-label="张量观察窗">
      <select
        aria-label="选择张量"
        value={selected}
        onChange={(e) => {
          setSelected(+e.target.value);
          setRow(0);
          setCol(0);
          setInspect("");
        }}
      >
        {frame.tensors.map((t, i) => (
          <option key={t.name} value={i}>
            {t.name}
          </option>
        ))}
      </select>
      <div className="tensor-window" ref={box}>
        <table className="tensor-table" aria-label={tensor.name}>
          <thead ref={head}>
            <tr>
              <th scope="col">行</th>
              {columns.map((j) => (
                <th key={j} scope="col">
                  {tensor.columns?.[j] ?? j}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tensor.rows.slice(r, r + size.rows).map((values, i) => (
              <tr key={r + i}>
                <th scope="row">{tensor.labels?.[r + i] ?? r + i}</th>
                {columns.map((j) => (
                  <td key={j}>
                    <motion.button
                      initial={still ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      aria-label={`单元格 [${r + i},${j}] = ${values[j]}`}
                      onClick={() =>
                        setInspect(`单元格 [${r + i},${j}] = ${values[j]}`)
                      }
                    >
                      {typeof values[j] === "number"
                        ? fmt(values[j])
                        : values[j]}
                    </motion.button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tensor-navigation">
        <span>
          {r + 1}–{Math.min(tensor.rows.length, r + size.rows)} /{" "}
          {tensor.rows.length} 行
        </span>
        <button
          aria-label="张量上一页"
          disabled={!r}
          onClick={() => setRow(Math.max(0, r - size.rows))}
        >
          ↑
        </button>
        <button
          aria-label="张量下一页"
          disabled={r + size.rows >= tensor.rows.length}
          onClick={() => setRow(r + size.rows)}
        >
          ↓
        </button>
        {ncols > size.cols && (
          <>
            <span>
              列 {c}–{Math.min(ncols - 1, c + size.cols - 1)}
            </span>
            <button
              aria-label="张量前一列"
              disabled={!c}
              onClick={() => setCol(c - 1)}
            >
              ←
            </button>
            <button
              aria-label="张量后一列"
              disabled={c + size.cols >= ncols}
              onClick={() => setCol(c + 1)}
            >
              →
            </button>
          </>
        )}
      </div>
      <p className="tensor-inspect" role="status">
        {inspect || "点击数值检查完整精度 · 显示保留 4 位小数"}
      </p>
    </section>
  );
}
