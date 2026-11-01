import { Scalar } from "./autodiff";
import { neuralModel, transformerModel } from "./ai-models";
import { actions, type LabConfig, type LabFrame, type LabId } from "./ai-labs";
import {
  calculateValue,
  parameterDiagram,
  type ValueSelection,
} from "./ai-calculation";

export type StepCell = {
  id: string;
  label: string;
  value: number | string;
  role: "tensor" | "parameter" | "temporary";
  nodes: string[];
  sample?: number;
  caption?: string;
};
export type CalculationStep = {
  title: string;
  note: string;
  operation: string;
  cells: StepCell[];
  parts: (string | { cell: string })[];
  result: string;
  nodes: string[];
  edges: [string, string][];
  direction: "forward" | "backward";
  nodeValues?: Record<string, string>;
  edgeLabel?: string;
  rule?: string;
  stage?: string;
  field?: "before" | "gradient" | "rate" | "after";
};
const unique = <T>(xs: T[]) => [...new Set(xs)];

// The micro trace reads the same Scalar graph as training. Named tensor boundaries are
// inputs to the selected operation; unnamed arithmetic is expanded, never rounded/reparsed.
export function calculationSteps(
  id: LabId,
  frame: LabFrame,
  config: LabConfig,
  selection: ValueSelection,
  history: readonly LabFrame[] = [],
): CalculationStep[] {
  const detail = calculateValue(id, frame, config, selection, history),
    steps: CalculationStep[] = [];
  const binding = selection.parameter
    ? parameterDiagram(id, selection.parameter)
    : detail.update
      ? parameterDiagram(id, detail.update.name)
      : detail;
  let diagramModel: ReturnType<typeof neuralModel> | undefined,
    activeSample = detail.sample ?? 1;
  const targetNodes = binding.nodes.slice(-1);
  const cell = (
    label: string,
    value: number | string,
    nodes = targetNodes,
    role: StepCell["role"] = "temporary",
  ): StepCell => ({ id: label, label, value, nodes, role });
  const emit = (
    title: string,
    operation: string,
    inputs: StepCell[],
    out: StepCell,
    parts: CalculationStep["parts"],
    note = "",
    direction: CalculationStep["direction"] = "forward",
    field?: CalculationStep["field"],
    edges?: [string, string][],
  ) => {
    const cells = [...new Map([...inputs, out].map((c) => [c.id, c])).values()],
      nodes = unique(cells.flatMap((c) => c.nodes));
    const graphEdges =
      frame.diagram.edges
        ?.filter((e) => nodes.includes(e.from) && nodes.includes(e.to))
        .map((e) => [e.from, e.to] as [string, string]) || [];
    if (
      id === "reinforcement-lab" &&
      frame.transition &&
      frame.transition.state !== frame.transition.next &&
      nodes.includes(String(frame.transition.state)) &&
      nodes.includes(String(frame.transition.next))
    )
      graphEdges.push([
        String(frame.transition.state),
        String(frame.transition.next),
      ]);
    const sample = cells.find((c) => c.sample !== undefined)?.sample;
    if (sample !== undefined) activeSample = sample;
    let nodeValues: Record<string, string> | undefined = diagramModel
      ? {
          x0: String(diagramModel.data[activeSample][0]),
          x1: String(diagramModel.data[activeSample][1]),
        }
      : undefined;
    if (diagramModel && nodeValues) {
      const values = nodeValues;
      if (frame.data?.forward)
        diagramModel.hidden[activeSample].forEach((v, i) => {
          values[`h${i}`] = v.toFixed(4);
        });
      if (frame.data?.prediction)
        Object.assign(nodeValues, {
          z: diagramModel.logits[activeSample].toFixed(4),
          p: diagramModel.predictions[activeSample].toFixed(4),
        });
    }
    const qCell =
      id === "reinforcement-lab"
        ? cells.findLast(
            (c) => c.label.startsWith("Q[") && typeof c.value === "number",
          )
        : undefined;
    if (qCell && frame.transition)
      nodeValues = {
        [String(frame.transition.state)]:
          `${actions[frame.transition.action]} Q=${Number(qCell.value).toFixed(4)}`,
      };
    const value =
      typeof out.value === "number" ? out.value.toFixed(4) : out.value;
    // Intermediate arithmetic is explicitly labelled, so it is not mistaken for
    // the neuron's completed activation or the operator's full tensor.
    if (
      id !== "reinforcement-lab" &&
      !selection.parameter &&
      out.nodes.length === 1
    )
      nodeValues = {
        ...nodeValues,
        [out.nodes[0]]:
          id === "transformer-lab" || out.role !== "tensor"
            ? `本步 ${value}`
            : /^(input|prediction)\[\d+,2\]$/.test(out.label)
              ? `标签 ${value}`
              : value,
      };
    const edgeLabel =
      selection.parameter && field
        ? `${field === "gradient" ? (operation === "add" ? "∇" : "δ∇") : field === "rate" ? "η∇" : "θ"} ${value}`
        : undefined;
    if (edgeLabel && !binding.edges.length && id !== "reinforcement-lab")
      nodeValues = { ...nodeValues, [binding.nodes.at(-1)!]: edgeLabel };
    steps.push({
      title,
      operation,
      cells,
      parts,
      result: out.id,
      nodes,
      edges: edges || graphEdges,
      direction,
      field,
      note,
      nodeValues,
      edgeLabel,
    });
    return out;
  };
  const ref = (c: StepCell) => ({ cell: c.id });
  const read = (c: StepCell, note: string) =>
    emit("读取单元格", "read", [], c, [ref(c)], note);
  let serial = 0;
  const binary = (
    op: string,
    a: StepCell,
    b: StepCell,
    value: number,
    out = cell(`t${++serial}`, value),
    direction: CalculationStep["direction"] = "forward",
    field?: CalculationStep["field"],
  ) =>
    emit(
      op === "mul" ? "相乘" : op === "sub" ? "相减" : "累加",
      op,
      [a, b],
      out,
      [
        ref(a),
        op === "mul" ? " × " : op === "sub" ? " − " : " + ",
        ref(b),
        " = ",
        ref(out),
      ],
      "",
      direction,
      field,
    );
  const finishUpdate = (gradient: StepCell) => {
    const p = detail.update!;
    const old = cell(`${p.name}·旧`, p.before, binding.nodes, "parameter"),
      rate = cell("学习率 η", config.rate, [], "parameter");
    read(old, "原参数保持不变，先算出完整梯度。 最后一步才回放写入。 ");
    steps.at(-1)!.field = "before";
    steps.at(-1)!.edgeLabel = `θ ${p.before.toFixed(4)}`;
    const delta = binary(
      "mul",
      rate,
      gradient,
      config.rate * p.gradient,
      undefined,
      "forward",
      "rate",
    );
    const next = cell(
      `${p.name}·${frame.phase === "update" ? "新" : "预览"}`,
      p.after,
      binding.nodes,
      "parameter",
    );
    emit(
      frame.phase === "update" ? "参数写入回放" : "参数更新预览",
      "update",
      [old, rate, gradient],
      next,
      [ref(old), " − ", ref(rate), " × ", ref(gradient), " = ", ref(next)],
      `变化量由上一步算出；此处只回放快照，不会再次训练。${frame.phase === "update" ? "" : "训练时间轴尚未执行写入。"}`,
      "forward",
      "after",
      binding.edges,
    );
    if (frame.phase === "update" && id === "neural-training")
      steps.at(-1)!.nodeValues = undefined;
    return delta;
  };
  if (id === "reinforcement-lab") {
    const tr = frame.transition!,
      active = !!detail.update;
    if (!active) {
      const last =
        selection.key === "q-table"
          ? history.findLast(
              (f) =>
                f.phase === "update" &&
                f.transition?.state === selection.row &&
                f.transition.action === selection.col,
            )
          : undefined;
      if (last)
        return calculationSteps(id, last, config, {
          ...selection,
          parameter: `Q[${selection.row},${actions[selection.col]}]`,
          field: "after",
        }).map((s) => ({
          ...s,
          title: `历史 · ${s.title}`,
          note: `第 ${last.iteration} 回合的历史写入；当前步未写入此项。 ${s.note}`,
        }));
      read(
        cell(detail.title, detail.value ?? "待计算", detail.nodes, "tensor"),
        "该项本步未计算更新；未访问的 Q 从 0 初始化。",
      );
      return steps;
    }
    const reward = cell("奖励 r", tr.reward, [String(tr.next)], "tensor"),
      discount = cell("折扣 γ", config.gamma, [], "parameter"),
      maxQ = cell(
        `max Q[s${tr.next},:]`,
        tr.done ? 0 : tr.bootstrap,
        [String(tr.next)],
        "tensor",
      );
    read(
      maxQ,
      tr.done
        ? "下一状态终止，未来项置零，不再自举。"
        : "读取下一状态四个动作中最大的 Q。",
    );
    const future = binary(
      "mul",
      discount,
      maxQ,
      config.gamma * (tr.done ? 0 : tr.bootstrap),
    );
    const target = binary(
      "add",
      reward,
      future,
      tr.target,
      cell("TD 目标", tr.target, [String(tr.state), String(tr.next)]),
    );
    const old = cell(
      `Q[${tr.state},${actions[tr.action]}]·旧`,
      tr.old,
      [String(tr.state)],
      "parameter",
    );
    const gradient = binary(
      "sub",
      old,
      target,
      tr.old - tr.target,
      cell("方向 −TD", tr.old - tr.target, [String(tr.state)]),
      "backward",
      "gradient",
    );
    finishUpdate(gradient);
    return steps;
  }
  const after =
    selection.key === "loss-comparison"
      ? selection.col === 1
      : frame.phase === "update";
  const model = (id === "neural-training" ? neuralModel : transformerModel)(
    config.variant,
    Object.fromEntries(
      frame.updates.map((p) => [
        p.name,
        selection.parameter ? p.before : after ? p.after : p.before,
      ]),
    ),
  );
  if ("hidden" in model) diagramModel = model;
  const names = new Map<Scalar, StepCell>(),
    keys = new Map<Scalar, string>();
  model.params.forEach((p) =>
    names.set(
      p.node,
      cell(
        p.name,
        p.node.value,
        parameterDiagram(id, p.name).nodes,
        "parameter",
      ),
    ),
  );
  const owners = (key: string, col: number) =>
    id === "neural-training"
      ? key === "input"
        ? [col < 2 ? `x${col}` : "loss"]
        : key === "hidden"
          ? [`h${col}`]
          : key === "prediction"
            ? [["z", "p", "loss"][col]]
            : ["loss"]
      : [
          key === "tokens"
            ? "0"
            : ["embedding", "position", "LN(X)"].includes(key)
              ? "1"
              : ["q", "k", "v"].includes(key)
                ? "2"
                : /^(scores|attention)-/.test(key)
                  ? "3"
                  : [
                        "concat",
                        "residual",
                        "feed",
                        "output",
                        "FFHidden",
                        "LN(R)",
                        "LN(Z)",
                      ].includes(key)
                    ? "4"
                    : ["probabilities", "logits"].includes(key)
                      ? "5"
                      : "6",
        ];
  Object.entries(model.inspect).forEach(([key, rows]) =>
    rows.forEach((row, r) =>
      row.forEach((v, c) => {
        names.set(
          v,
          cell(
            `${key}[${r},${c}]`,
            Number.isFinite(v.value) ? v.value : "−∞",
            owners(key, c),
            "tensor",
          ),
        );
        if (
          id === "neural-training" &&
          ["input", "hidden", "prediction"].includes(key)
        )
          names.get(v)!.sample = r;
        keys.set(v, key);
      }),
    ),
  );
  const named = (v: Scalar): StepCell => {
    if (!names.has(v)) {
      names.set(
        v,
        cell(
          v.operation === "input" ? `常数 ${v.value}` : `t${++serial}`,
          Number.isFinite(v.value) ? v.value : "−∞",
          v.operation === "input" ? [] : targetNodes,
        ),
      );
      if (v.operation === "input") names.get(v)!.label = "常数";
    }
    return names.get(v)!;
  };
  // Give each internal scalar its enclosing tensor/operator and sample, stopping
  // at named boundaries. This keeps loss, activation and projection gradients
  // on their actual layers instead of painting the selected weight throughout.
  const assigned = new Set<Scalar>();
  for (const rows of Object.values(model.inspect))
    for (const row of rows)
      for (const root of row) {
        const owner = named(root);
        const assign = (v: Scalar) => {
          if (v !== root && keys.has(v)) return;
          if (assigned.has(v) || v.operation === "input") return;
          assigned.add(v);
          if (v !== root) {
            const c = named(v);
            c.nodes = owner.nodes;
            c.sample = owner.sample;
          }
          v.parents.forEach(([parent]) => assign(parent));
        };
        assign(root);
      }
  if (selection.parameter) {
    const p = detail.update;
    if (!p || !["backward", "update"].includes(frame.phase)) {
      read(
        cell(
          selection.parameter,
          p?.before ?? "待计算",
          binding.nodes,
          "parameter",
        ),
        "尚未反向传播，不提前计算梯度或参数新值。",
      );
      return steps;
    }
    const parameter = model.params.find((p) => p.name === selection.parameter)!;
    const depends = new Map<Scalar, boolean>();
    const reaches = (v: Scalar): boolean => {
      if (!depends.has(v))
        depends.set(
          v,
          v === parameter.node || v.parents.some(([parent]) => reaches(parent)),
        );
      return depends.get(v)!;
    };
    reaches(model.loss);
    const gradientCells = new Map<Scalar, StepCell>();
    const lossCell = named(model.loss);
    const seed = cell("∂L/∂L", 1, lossCell.nodes, "tensor");
    gradientCells.set(model.loss, seed);
    emit(
      "从损失开始",
      "seed",
      [],
      seed,
      ["∂L/∂L = ", ref(seed)],
      "损失对自身的导数是 1；其余梯度从 0 开始。沿所有通向所选参数的路径按逆拓扑顺序回传。",
      "backward",
    );
    steps.at(-1)!.stage = lossCell.nodes.at(-1);
    steps.at(-1)!.rule = "g(L) = 1";
    let gradient = cell(`∂L/∂${p.name}`, 0, binding.nodes, "tensor");
    // Keep the actual dependency, including residual skips and fused loss→logit.
    // Routing via intervening display nodes would imply derivatives that did not
    // occur. The renderer adds a transient direct edge when the overview omits it.
    const path = (from: string[], to: string[]): [string, string][] =>
      from.at(-1) && to.at(-1) && from.at(-1) !== to.at(-1)
        ? [[from.at(-1)!, to.at(-1)!]]
        : [];
    model.loss.backward((parent, upstream, local, source) => {
      if (!reaches(parent)) return;
      const n = steps.length,
        sourceCell = named(source),
        parentCell = named(parent);
      const up = {
          ...cell(
            `∂L/∂${sourceCell.label}`,
            upstream,
            sourceCell.nodes,
            "tensor",
          ),
          sample: sourceCell.sample,
        },
        derivative = cell(
          `∂${sourceCell.label}/∂${parentCell.label}`,
          local,
          parentCell.nodes,
          "tensor",
        );
      derivative.sample = parentCell.sample ?? sourceCell.sample;
      up.caption = "上游梯度";
      derivative.caption = "局部导数";
      const other =
        source.operation === "mul"
          ? source.parents[source.parents[0][0] === parent ? 1 : 0]?.[0]
          : undefined;
      const argument = named(parent),
        sourceValue = { ...sourceCell, id: `value:${sourceCell.id}` };
      let operands: StepCell[] = [],
        parts: CalculationStep["parts"] = [ref(derivative)];
      let rule = "∂(u+v)/∂u = 1";
      if (source.operation === "mul" && other) {
        operands = [named(other)];
        parts = [ref(operands[0]), " = ", ref(derivative)];
        rule = "∂(u×v)/∂u = v";
      } else if (source.operation === "sigmoid") {
        operands = [sourceValue];
        parts = [
          ref(sourceValue),
          " × (1 − ",
          ref(sourceValue),
          ") = ",
          ref(derivative),
        ];
        rule = "σ′(u) = σ(u)(1 − σ(u))";
      } else if (source.operation === "tanh") {
        operands = [sourceValue];
        parts = ["1 − ", ref(sourceValue), "² = ", ref(derivative)];
        rule = "tanh′(u) = 1 − tanh²(u)";
      } else if (source.operation === "relu") {
        operands = [argument];
        parts = [ref(argument), " > 0 ? 1 : 0 = ", ref(derivative)];
        rule = "ReLU′(u) = 1[u>0]";
      } else if (source.operation === "log") {
        operands = [argument];
        parts = ["1 / ", ref(argument), " = ", ref(derivative)];
        rule = "log′(u) = 1/u";
      } else if (source.operation === "exp") {
        operands = [sourceValue];
        parts = [ref(sourceValue), " = ", ref(derivative)];
        rule = "exp′(u) = exp(u)";
      } else if (source.operation.startsWith("pow:")) {
        const exponent = Number(source.operation.slice(4));
        operands = [argument];
        parts = [
          `${exponent} × (`,
          ref(argument),
          `)^(${exponent - 1}) = `,
          ref(derivative),
        ];
        rule = `∂u^${exponent}/∂u = ${exponent}u^(${exponent - 1})`;
      }
      const edges =
        parent === parameter.node
          ? binding.edges
          : path(sourceCell.nodes, parentCell.nodes);
      const decorate = () => {
        const step = steps.at(-1)!;
        step.edges = edges;
        step.nodes = unique([...step.nodes, ...edges.flat()]);
        step.stage = sourceCell.nodes.at(-1);
        step.edgeLabel = `${step.operation === "derivative" ? "∂v/∂u" : step.operation === "add" ? "∇" : "δ∇"} ${Number(step.cells.find((c) => c.id === step.result)!.value).toFixed(4)}`;
      };
      emit(
        "求局部导数",
        "derivative",
        operands,
        derivative,
        parts,
        `${sourceCell.label} 对 ${parentCell.label} 求导：只看当前运算，其他输入暂时视作常量。`,
        "backward",
      );
      decorate();
      steps.at(-1)!.rule = rule;
      const contribution = binary(
        "mul",
        up,
        derivative,
        upstream * local,
        cell(
          `δg(${parentCell.label})·${n}`,
          upstream * local,
          parentCell.nodes,
          "tensor",
        ),
        "backward",
        parent === parameter.node ? "gradient" : undefined,
      );
      steps.at(-1)!.note =
        "上游梯度 × 局部导数；局部导数若来自乘法，就是另一个操作数。按实际反向遍历顺序回放。";
      decorate();
      steps.at(-1)!.rule = "δg(u) = g(v) × ∂v/∂u";
      contribution.caption = "本路贡献";
      const previous =
        gradientCells.get(parent) ||
        cell(`g(${parentCell.label})·旧`, 0, parentCell.nodes, "tensor");
      const oldGradient = { ...previous, caption: "已有累积" };
      const accumulated = binary(
        "add",
        oldGradient,
        contribution,
        parent.grad,
        cell(
          `g(${parentCell.label})·${n}`,
          parent.grad,
          parentCell.nodes,
          "tensor",
        ),
        "backward",
        parent === parameter.node ? "gradient" : undefined,
      );
      decorate();
      steps.at(-1)!.rule = "g(u) ← g(u) + δg(u)";
      accumulated.caption = "累计梯度";
      steps.at(-1)!.note =
        "共享节点可能收到多条路径的贡献，必须累加，不能覆盖；全部下游贡献到齐后再向更早一层传播。";
      gradientCells.set(parent, accumulated);
      if (parent === parameter.node) gradient = accumulated;
    });
    const updateStart = steps.length;
    finishUpdate(gradient);
    steps.slice(updateStart).forEach((s) => {
      s.stage = "update";
    });
    return steps;
  }
  const available = [
    ...Object.values(frame.data || {}).flat(),
    ...frame.tensors,
  ].find((t) => t.ref?.key === selection.key);
  if (!available) {
    read(
      cell("待计算", "待计算", detail.nodes),
      "当前阶段未产生该张量。推进训练阶段后再演示。",
    );
    return steps;
  }
  if (selection.key === "gradient-norm") {
    const group = String(available.rows[selection.row][0]);
    if (selection.col === 0) {
      read(
        cell("参数组", group, binding.nodes),
        "这是组名，选择右侧数值演示范数计算。",
      );
      return steps;
    }
    let total = cell("平方和·初始", 0, binding.nodes);
    for (const p of frame.updates.filter((p) => p.group === group)) {
      const g = cell(
        `∇${p.name}`,
        p.gradient,
        parameterDiagram(id, p.name).nodes,
        "tensor",
      );
      const square = binary("mul", g, g, p.gradient ** 2);
      total = binary(
        "add",
        total,
        square,
        Number(total.value) + p.gradient ** 2,
      );
    }
    const out = cell(
      `||∇${group}||₂`,
      Math.sqrt(Number(total.value)),
      binding.nodes,
      "tensor",
    );
    emit(
      "平方根",
      "sqrt",
      [total],
      out,
      ["√(", ref(total), ") = ", ref(out)],
      "组内每个梯度平方求和，再开方。",
    );
    return steps;
  }
  const key = selection.key === "loss-comparison" ? "loss" : selection.key;
  const root =
    model.inspect[key]?.[
      selection.key === "loss-comparison" ? 0 : selection.row
    ]?.[selection.key === "loss-comparison" ? 0 : selection.col];
  if (!root) {
    read(
      cell(detail.title, detail.value ?? "待计算", detail.nodes, "tensor"),
      "读取当前阶段的已计算值。",
    );
    return steps;
  }
  const seen = new Set<Scalar>(),
    expand = new Set(["FFHidden", "logits"]);
  const visit = (v: Scalar) => {
    if (seen.has(v)) return;
    seen.add(v);
    const out = named(v),
      boundary =
        v !== root &&
        names.has(v) &&
        !!keys.get(v) &&
        !expand.has(keys.get(v)!);
    if (!v.parents.length || boundary) {
      if (v !== root && out.role === "temporary" && v.operation === "input")
        return;
      read(
        out,
        v.operation === "mask"
          ? "未来位置被因果掩码屏蔽；分数为 −∞，概率为 0。"
          : out.role === "parameter"
            ? "读取本阶段权重，不修改参数。"
            : "读取已计算张量；下标保持原始坐标。临时量用 t 标记。",
      );
      return;
    }
    v.parents.forEach(([p]) => visit(p));
    const inputs = v.parents.map(([p]) => named(p));
    let parts: CalculationStep["parts"];
    if (v.operation === "add" || v.operation === "mul")
      parts = [
        ref(inputs[0]),
        v.operation === "add" ? " + " : " × ",
        ref(inputs[1]),
        " = ",
        ref(out),
      ];
    else if (v.operation.startsWith("pow:"))
      parts = [
        "(",
        ref(inputs[0]),
        ")^" + v.operation.slice(4) + " = ",
        ref(out),
      ];
    else parts = [v.operation + "(", ref(inputs[0]), ") = ", ref(out)];
    const title =
      (
        {
          add: "累加",
          mul: "相乘",
          tanh: "tanh 激活",
          sigmoid: "sigmoid 激活",
          relu: "ReLU 激活",
          exp: "指数",
          log: "对数",
          sin: "正弦位置编码",
          cos: "余弦位置编码",
        } as Record<string, string>
      )[v.operation] || "幂运算";
    emit(
      title,
      v.operation,
      inputs,
      out,
      parts,
      v === root
        ? "结果对应选中的原始单元格。显示值经过舍入，计算保留完整精度。"
        : "逐个计算参与当前输出的中间量；未参与的单元格不高亮。",
    );
  };
  visit(root);
  return steps;
}
