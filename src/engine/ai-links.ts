import {
  actions,
  type LabFrame,
  type LabId,
  type Tensor,
  type Update,
} from "./ai-labs";
import type { DiagramSelection } from "./model";

export const selectionKey = (s: DiagramSelection) =>
  s.kind === "node"
    ? `node:${s.id}`
    : `edge:${[s.from, s.to].sort().join(":")}`;
export type LinkedData = {
  title: string;
  note: string;
  tensors: Tensor[];
  parameters: string[];
};
const column = (t: Tensor, c: number, name: string): Tensor => ({
  ...t,
  ref: t.ref ? { ...t.ref, cols: [t.ref.cols?.[c] ?? c] } : undefined,
  name,
  rows: t.rows.map((r) => [r[c]]),
  columns: [t.columns?.[c] ?? name],
  beforeRows: t.beforeRows?.map((r) => [r[c]]),
  changed: t.changed?.filter(([, j]) => j === c).map(([r]) => [r, 0]),
});
function parametersTensor(updates: Update[], frame: LabFrame): Tensor {
  const ready = ["backward", "target", "update"].includes(frame.phase),
    updated = frame.phase === "update";
  return {
    name: "关联权重与梯度 · 更新前后",
    labels: updates.map((p) => p.name),
    parameters: updates.map((p) => p.name),
    columns: ["更新前", "∇θ", updated ? "更新后" : "预览"],
    rows: updates.map((p) => [
      p.before,
      ready ? p.gradient : "待计算",
      p.after,
    ]),
    beforeRows: updates.map((p) => [
      p.before,
      ready ? p.gradient : "待计算",
      p.before,
    ]),
    changed: updated
      ? updates.flatMap((p, i) =>
          p.before !== p.after ? [[i, 2] as [number, number]] : [],
        )
      : [],
    note: updated
      ? "梯度取更新前；亮格为实际新值"
      : ready
        ? "梯度已算出，参数尚未写入"
        : "前向不改权重；梯度待反向计算",
  };
}
export function linkedData(
  id: LabId,
  frame: LabFrame,
  selection: DiagramSelection,
): LinkedData {
  const nodeLabel = (key: string) =>
    frame.diagram.nodes?.find((n) => n.id === key)?.label || key;
  const directed =
    selection.kind === "edge"
      ? frame.diagram.edges?.find(
          (e) =>
            [e.from, e.to].sort().join(":") ===
            [selection.from, selection.to].sort().join(":"),
        )
      : undefined;
  const title =
    selection.kind === "node"
      ? nodeLabel(selection.id)
      : `${nodeLabel(directed?.from || selection.from)} → ${nodeLabel(directed?.to || selection.to)}`;
  if (id === "reinforcement-lab") {
    const state = Number(
        selection.kind === "node" ? selection.id : selection.from,
      ),
      table = frame.tensors[0],
      tr = frame.transition!;
    const row = table.rows[state];
    if (!row)
      return { title, note: "该状态不在当前环境", tensors: [], parameters: [] };
    const ready = ["target", "update"].includes(frame.phase),
      written = frame.phase === "update";
    const before = table.beforeRows?.[state] || row;
    const active = ready && state === tr.state;
    const names = actions.map((a) => `Q[${state},${a}]`);
    return {
      title:
        selection.kind === "node"
          ? `状态 s${state}`
          : `状态 s${state} · ${title}`,
      note:
        ready && !active
          ? `本步更新 Q[${tr.state},${actions[tr.action]}]；所选 s${state} 未更新`
          : "Q 为表格价值；−TD 是更新方向",
      parameters: names,
      tensors: [
        {
          ...table,
          ref: { key: "q-table", rows: [state] },
          name: `s${state} · Q 值`,
          rows: [row],
          labels: [`s${state}`],
          beforeRows: [before],
          changed: table.changed
            ?.filter(([r]) => r === state)
            .map(([, c]) => [0, c]),
          focus: active ? [0, tr.action] : undefined,
        },
        {
          name: `s${state} · Q 更新对照`,
          columns: ["更新前", "−TD", written ? "更新后" : "预览"],
          labels: actions,
          parameters: names,
          rows: row.map((v, a) => [
            before[a],
            active && a === tr.action ? tr.old - tr.target : "未更新",
            active && a === tr.action ? tr.updated : v,
          ]),
          beforeRows: row.map((_, a) => [
            before[a],
            active && a === tr.action ? tr.old - tr.target : "未更新",
            before[a],
          ]),
          changed:
            written && active && tr.old !== tr.updated ? [[tr.action, 2]] : [],
          focus: active ? [tr.action, 2] : undefined,
          note: written
            ? "亮格为实际写入；点击对照旧值"
            : ready
              ? "目标已计算；新值仍是更新预览"
              : "环境反馈后再计算 TD 方向",
        },
      ],
    };
  }
  const data = frame.data || {},
    tensors: Tensor[] = [];
  let related: Update[] = [],
    note = "权重梯度取自当前步骤";
  const stage = (phase: string, cols?: number[], names?: string[]) => {
    const source = data[phase];
    if (!source) {
      tensors.push({
        name: `${phase} · 待计算`,
        rows: [["尚未到达此计算阶段"]],
        note: "不会提前显示后续步骤的结果",
      });
      return;
    }
    if (cols)
      cols.forEach((c, i) =>
        tensors.push(column(source[0], c, names?.[i] || source[0].name)),
      );
    else tensors.push(...source);
  };
  if (id === "neural-training") {
    const ids =
      selection.kind === "node"
        ? [selection.id]
        : [selection.from, selection.to];
    const x = ids.find((s) => /^x\d$/.test(s)),
      h = ids.find((s) => /^h\d$/.test(s));
    const pick = (test: (p: Update) => boolean) => {
      related = frame.updates.filter(test);
    };
    if (selection.kind === "edge" && x && h) {
      pick((p) => p.name === `W1[${x[1]},${h[1]}]`);
      stage("input", [+x[1]], [`输入 ${nodeLabel(x)} · 四个样本`]);
      stage("forward", [+h[1]], [`激活 ${nodeLabel(h)} · 四个样本`]);
    } else if (selection.kind === "edge" && h && ids.includes("z")) {
      pick((p) => p.name === `W2[${h[1]},0]`);
      stage("forward", [+h[1]], [`激活 ${nodeLabel(h)} · 四个样本`]);
      stage("prediction", [0], ["logit · 四个样本"]);
    } else if (selection.kind === "node" && x) {
      pick((p) => p.name.startsWith(`W1[${x[1]},`));
      stage("input", [+x[1]], [`输入 ${nodeLabel(x)} · 四个样本`]);
      note = "输入无可训练参数；关联其出边权重";
    } else if (selection.kind === "node" && h) {
      pick(
        (p) =>
          p.name === `W2[${h[1]},0]` ||
          (p.group === "W1" && p.name.endsWith(`,${h[1]}]`)) ||
          p.name === `b1[0,${h[1]}]`,
      );
      stage("forward", [+h[1]], [`激活 ${nodeLabel(h)} · 四个样本`]);
      note = "关联隐藏神经元的入边、偏置与出边";
    } else {
      if (ids.includes("loss")) {
        stage("loss");
        stage("prediction", [1, 2], ["预测概率", "真实标签"]);
        note = "损失无独立权重；参数梯度在权重处查看";
      } else {
        stage(
          "prediction",
          selection.kind === "node" && selection.id === "p"
            ? [1]
            : ids.includes("p")
              ? [0, 1]
              : [0],
          selection.kind === "node" && selection.id === "p"
            ? ["预测概率"]
            : ["logit", "预测概率"],
        );
        note = "激活算子无独立可训练权重";
      }
      if (selection.kind === "node" && selection.id === "z")
        pick((p) => ["W2", "b2"].includes(p.group));
    }
  } else {
    const n =
      selection.kind === "node"
        ? +selection.id
        : Math.max(+selection.from, +selection.to);
    const phases = [
      "input",
      "input",
      "qkv",
      "mask",
      "residual",
      "prediction",
      "loss",
      "update",
    ];
    const groups = [
      [],
      ["E"],
      ["WQ", "WK", "WV"],
      ["WQ", "WK", "WV"],
      ["WO", "F1", "f1bias", "F2", "f2bias"],
      ["U", "outbias"],
      [],
      [...new Set(frame.updates.map((p) => p.group))],
    ];
    related = frame.updates.filter((p) => groups[n]?.includes(p.group));
    if (n === 7) tensors.push(...frame.tensors);
    else stage(phases[n] || "input");
    if (n === 0 && tensors.length > 1) tensors.splice(1);
    if (n === 1 && tensors.length > 1) tensors.shift();
    note =
      n === 3
        ? "注意力概率是激活；关联 Q/K/V 投影权重"
        : n === 0
          ? "Token 为离散输入，不对其求梯度"
          : n === 6
            ? "损失无独立权重；梯度回传到各参数"
            : selection.kind === "edge"
              ? "连线传递张量；列出目标算子的相关参数"
              : "显示算子张量与相关参数";
  }
  if (related.length) {
    const table = parametersTensor(related, frame);
    if (selection.kind === "edge") tensors.unshift(table);
    else tensors.push(table);
  }
  return {
    title,
    note,
    tensors: tensors.length ? tensors : [{ name: "关联说明", rows: [[note]] }],
    parameters: related.map((p) => p.name),
  };
}
