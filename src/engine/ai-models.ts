import {
  Scalar,
  sum,
  softmax,
  parameterStore,
  linear,
  values,
} from "./autodiff";
export function neuralModel(
  variant = 0,
  overrides: Record<string, number> = {},
) {
  const store = parameterStore(overrides),
    W1 = store.matrix("W1", 2, 3),
    b1 = store.matrix("b1", 1, 3, true)[0],
    W2 = store.matrix("W2", 3, 1),
    b2 = store.matrix("b2", 1, 1, true)[0];
  const data = [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
    targets = variant ? [0, 0, 0, 1] : [0, 1, 1, 0];
  const hidden = linear(
    data.map((r) => r.map((v) => new Scalar(v))),
    W1,
    b1,
  ).map((r) => r.map((v) => v.tanh()));
  const logits = linear(hidden, W2, b2).map((r) => r[0]);
  // Stable binary cross entropy from logits: log(1 + exp(z)) - y*z.
  const losses = logits.map((z, i) => {
    const m = Math.max(0, z.value);
    return z
      .add(-m)
      .exp()
      .add(Math.exp(-m))
      .log()
      .add(m)
      .add(z.mul(-targets[i]));
  });
  return {
    ...store,
    loss: sum(losses).mul(1 / 4),
    data,
    targets,
    hidden: values(hidden),
    predictions: logits.map((z) => 1 / (1 + Math.exp(-z.value))),
    logits: logits.map((z) => z.value),
  };
}

export function transformerModel(
  variant = 0,
  overrides: Record<string, number> = {},
  tokensOverride?: number[],
) {
  const store = parameterStore(overrides),
    E = store.matrix("E", 4, 4),
    Wq = store.matrix("WQ", 4, 4),
    Wk = store.matrix("WK", 4, 4),
    Wv = store.matrix("WV", 4, 4),
    Wo = store.matrix("WO", 4, 4),
    W1 = store.matrix("F1", 4, 6),
    b1 = store.matrix("f1bias", 1, 6, true)[0],
    W2 = store.matrix("F2", 6, 4),
    b2 = store.matrix("f2bias", 1, 4, true)[0],
    U = store.matrix("U", 4, 4),
    bias = store.matrix("outbias", 1, 4, true)[0];
  // Pre-norm, fixed scale=1/bias=0 LayerNorm. All listed matrices and biases train.
  const norm = (x: Scalar[][]) =>
    x.map((row) => {
      const mean = sum(row).mul(1 / row.length),
        centered = row.map((v) => v.add(mean.mul(-1))),
        inv = sum(centered.map((v) => v.pow(2)))
          .mul(1 / row.length)
          .add(1e-5)
          .pow(-0.5);
      return centered.map((v) => v.mul(inv));
    });
  const tokens = tokensOverride ?? (variant ? [1, 0, 2] : [0, 1, 2]),
    targets = variant ? [0, 2, 3] : [1, 2, 3];
  const position = tokens.map((_, i) => [
    Math.sin(i),
    Math.cos(i),
    Math.sin(i / 100),
    Math.cos(i / 100),
  ]);
  const x = tokens.map((t, i) => E[t].map((v, j) => v.add(position[i][j]))),
    n = norm(x),
    q = linear(n, Wq),
    k = linear(n, Wk),
    v = linear(n, Wv);
  const weights: Scalar[][][] = [],
    scores: (number | string)[][][] = [];
  const heads = [0, 1].map((h) => {
    const rows: Scalar[][] = [],
      raw: (number | string)[][] = [];
    const out = tokens.map((_, i) => {
      const logits = tokens
        .slice(0, i + 1)
        .map((_, j) =>
          sum([0, 1].map((d) => q[i][h * 2 + d].mul(k[j][h * 2 + d]))).mul(
            1 / Math.sqrt(2),
          ),
        );
      const a = softmax(logits);
      rows.push([...a, ...tokens.slice(i + 1).map(() => new Scalar(0))]);
      raw.push([
        ...logits.map((l) => l.value),
        ...tokens.slice(i + 1).map(() => "−∞"),
      ]);
      return [0, 1].map((d) => sum(a.map((w, j) => w.mul(v[j][h * 2 + d]))));
    });
    weights.push(rows);
    scores.push(raw);
    return out;
  });
  const concat = tokens.map((_, i) => [...heads[0][i], ...heads[1][i]]),
    projected = linear(concat, Wo),
    residual = x.map((r, i) => r.map((v, j) => v.add(projected[i][j]))),
    normalizedResidual = norm(residual),
    feedHidden = linear(normalizedResidual, W1, b1).map((r) =>
      r.map((v) => v.relu()),
    ),
    feed = linear(feedHidden, W2, b2),
    output = residual.map((r, i) => r.map((v, j) => v.add(feed[i][j]))),
    normalizedOutput = norm(output),
    logits = linear(normalizedOutput, U, bias),
    probs = logits.map(softmax);
  // Stable log-sum-exp CE avoids taking log of an underflowed probability.
  const losses = logits.map((r, i) => {
    const m = Math.max(...r.map((v) => v.value));
    return sum(r.map((v) => v.add(-m).exp()))
      .log()
      .add(m)
      .add(r[targets[i]].mul(-1));
  });
  return {
    ...store,
    loss: sum(losses).mul(1 / tokens.length),
    tokens,
    targets,
    position,
    x: values(x),
    normalizedInput: values(n),
    normalizedResidual: values(normalizedResidual),
    feedHidden: values(feedHidden),
    normalizedOutput: values(normalizedOutput),
    logits: values(logits),
    q: values(q),
    k: values(k),
    v: values(v),
    scores,
    weights: weights.map(values),
    concat: values(concat),
    residual: values(residual),
    feed: values(feed),
    output: values(output),
    probabilities: values(probs),
  };
}
