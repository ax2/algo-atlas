import type { neuralModel, transformerModel } from "./ai-models";
import type { Tensor } from "./ai-labs";

// Numerical snapshots only; never retain an autodiff graph in a playback frame.
export function trainingTensors(
  model: ReturnType<typeof neuralModel> | ReturnType<typeof transformerModel>,
): Record<string, Tensor[]> {
  const loss = [
    { name: "本轮平均损失", ref: { key: "loss" }, rows: [[model.loss.value]] },
  ];
  if ("hidden" in model)
    return {
      input: [
        {
          name: "X 与标签 y · 4×3",
          ref: { key: "input" },
          rows: model.data.map((r, i) => [...r, model.targets[i]]),
          columns: ["x₁", "x₂", "y"],
        },
      ],
      forward: [
        {
          name: "H = tanh(XW₁ + b₁) · 4×3",
          ref: { key: "hidden" },
          rows: model.hidden,
        },
      ],
      prediction: [
        {
          name: "样本预测 · 4×3",
          ref: { key: "prediction" },
          rows: model.predictions.map((p, i) => [
            model.logits[i],
            p,
            model.targets[i],
          ]),
          columns: ["logit", "P(y=1)", "标签"],
        },
      ],
      loss,
    };
  return {
    input: [
      {
        name: "Token ID → 下一个 Token",
        ref: { key: "tokens" },
        rows: model.tokens.map((t, i) => [t, model.targets[i]]),
        columns: ["输入", "训练目标"],
      },
      {
        name: "X = E[token] + PE · 3×4",
        ref: { key: "embedding" },
        rows: model.x,
      },
      {
        name: "固定正弦位置编码 · 3×4",
        ref: { key: "position" },
        rows: model.position,
      },
    ],
    qkv: [
      {
        name: "Q · 3×4",
        ref: { key: "q" },
        rows: model.q,
        parameterGroups: ["WQ"],
      },
      {
        name: "K · 3×4",
        ref: { key: "k" },
        rows: model.k,
        parameterGroups: ["WK"],
      },
      {
        name: "V · 3×4",
        ref: { key: "v" },
        rows: model.v,
        parameterGroups: ["WV"],
      },
    ],
    mask: model.weights.flatMap((rows, h) => [
      {
        name: `头 ${h + 1} · 掩码后分数`,
        ref: { key: `scores-${h}` },
        rows: model.scores[h],
      },
      {
        name: `头 ${h + 1} · 注意力概率`,
        ref: { key: `attention-${h}` },
        rows,
        columns: ["位置 0", "位置 1", "位置 2"],
      },
    ]),
    residual: [
      { name: "双头拼接 · 3×4", ref: { key: "concat" }, rows: model.concat },
      {
        name: "R = X + Concat·WO",
        ref: { key: "residual" },
        rows: model.residual,
      },
      { name: "FFN(LN(R)) · 3×4", ref: { key: "feed" }, rows: model.feed },
      { name: "Z = R + FFN · 3×4", ref: { key: "output" }, rows: model.output },
    ],
    prediction: [
      {
        name: "每个位置的下一符号概率 · 3×4",
        ref: { key: "probabilities" },
        rows: model.probabilities,
        columns: ["A", "B", "C", "D"],
      },
    ],
    loss,
  };
}
