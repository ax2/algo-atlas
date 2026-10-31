import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { LabFrame, Tensor } from "../engine/ai-labs";
import { fmt } from "../engine/ai-labs";

// Keep numerical cells readable: page rows/columns at their real pixel size.
// Original row/column indices remain stable when the viewport or tensor changes.
export function TensorView({
  frame,
  still,
  tensors,
  onParameter,
  onTensorChange,
  context,
}: {
  frame: LabFrame;
  still: boolean;
  tensors?: Tensor[];
  context?: string;
  onParameter?: (name: string) => void;
  onTensorChange?: (index: number) => void;
}) {
  const [selectedName, setSelectedName] = useState<string>(),
    [row, setRow] = useState(0),
    [col, setCol] = useState(0),
    [size, setSize] = useState({ rows: 1, cols: 4 }),
    [inspect, setInspect] = useState("");
  const box = useRef<HTMLDivElement>(null),
    head = useRef<HTMLTableSectionElement>(null);
  const available = tensors || frame.tensors;
  const index = Math.max(
    0,
    available.findIndex((t) => t.name === selectedName),
  );
  const tensor = available[index];
  const previousTensor = useRef<string>(undefined);
  useLayoutEffect(() => {
    setInspect("");
    if (tensor.focus || previousTensor.current !== tensor.name)
      setRow(tensor.focus?.[0] ?? 0);
    if (tensor.focus || previousTensor.current !== tensor.name)
      setCol(
        tensor.focus?.[1] !== undefined
          ? Math.max(0, tensor.focus[1] - size.cols + 1)
          : 0,
      );
    previousTensor.current = tensor.name;
  }, [tensor, frame, size.cols]);
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
        Math.floor(
          (box.current!.clientWidth -
            (head.current?.querySelector("th")?.getBoundingClientRect().width ||
              36)) /
            64,
        ),
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
        value={index}
        onChange={(e) => {
          setSelectedName(available[+e.target.value].name);
          onTensorChange?.(+e.target.value);
          setRow(0);
          setCol(0);
          setInspect("");
        }}
      >
        {available.map((t, i) => (
          <option key={t.name} value={i}>
            {t.name}
          </option>
        ))}
      </select>
      <div className="tensor-window" ref={box}>
        <table
          className="tensor-table"
          data-parameters={!!tensor.parameters}
          aria-label={tensor.name}
        >
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
                  <td
                    key={j}
                    data-changed={
                      tensor.changed?.some(
                        ([a, b]) => a === r + i && b === j,
                      ) || undefined
                    }
                    data-active={
                      (tensor.focus?.[0] === r + i &&
                        tensor.focus?.[1] === j) ||
                      undefined
                    }
                  >
                    <motion.button
                      key={`${r + i}-${j}-${String(values[j])}`}
                      title={`原值 ${tensor.beforeRows?.[r + i]?.[j] ?? values[j]}；当前值 ${values[j]}`}
                      aria-description={
                        tensor.beforeRows
                          ? `更新前 ${tensor.beforeRows[r + i][j]}`
                          : undefined
                      }
                      initial={still ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      aria-label={`单元格 [${r + i},${j}] = ${values[j]}`}
                      onClick={() => {
                        const before = tensor.beforeRows?.[r + i]?.[j],
                          value = values[j];
                        const show = (v: number | string) =>
                          typeof v === "number" ? fmt(v) : v;
                        setInspect(
                          before !== undefined && before !== value
                            ? `单元格 [${r + i},${j}] ${show(before)} → ${show(value)}`
                            : `单元格 [${r + i},${j}] = ${value}`,
                        );
                        if (tensor.parameters?.[r + i])
                          onParameter?.(tensor.parameters[r + i]);
                      }}
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
        {inspect ||
          tensor.note ||
          context ||
          "点击数值检查完整精度 · 显示保留 4 位小数"}
      </p>
    </section>
  );
}
