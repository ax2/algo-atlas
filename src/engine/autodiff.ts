// Small reverse-mode autodiff engine: the labs use the same derivatives they display.
export class Scalar {
  grad = 0;
  constructor(
    public value: number,
    public readonly parents: [Scalar, number][] = [],
    public readonly operation = "input",
  ) {}
  add(b: Scalar | number) {
    const v = scalar(b);
    return new Scalar(
      this.value + v.value,
      [
        [this, 1],
        [v, 1],
      ],
      "add",
    );
  }
  mul(b: Scalar | number) {
    const v = scalar(b);
    return new Scalar(
      this.value * v.value,
      [
        [this, v.value],
        [v, this.value],
      ],
      "mul",
    );
  }
  pow(p: number) {
    return new Scalar(
      this.value ** p,
      [[this, p * this.value ** (p - 1)]],
      `pow:${p}`,
    );
  }
  exp() {
    const v = Math.exp(this.value);
    return new Scalar(v, [[this, v]], "exp");
  }
  log() {
    return new Scalar(Math.log(this.value), [[this, 1 / this.value]], "log");
  }
  tanh() {
    const v = Math.tanh(this.value);
    return new Scalar(v, [[this, 1 - v * v]], "tanh");
  }
  relu() {
    return new Scalar(
      Math.max(0, this.value),
      [[this, this.value > 0 ? 1 : 0]],
      "relu",
    );
  }
  sigmoid() {
    const value = 1 / (1 + Math.exp(-this.value));
    return new Scalar(value, [[this, value * (1 - value)]], "sigmoid");
  }
  sin() {
    return new Scalar(
      Math.sin(this.value),
      [[this, Math.cos(this.value)]],
      "sin",
    );
  }
  cos() {
    return new Scalar(
      Math.cos(this.value),
      [[this, -Math.sin(this.value)]],
      "cos",
    );
  }
  backward(
    observe?: (
      parent: Scalar,
      upstream: number,
      local: number,
      source: Scalar,
    ) => void,
  ) {
    const seen = new Set<Scalar>(),
      order: Scalar[] = [];
    const visit = (v: Scalar) => {
      if (seen.has(v)) return;
      seen.add(v);
      v.parents.forEach(([p]) => visit(p));
      order.push(v);
    };
    visit(this);
    order.forEach((v) => (v.grad = 0));
    this.grad = 1;
    for (const v of order.reverse())
      for (const [p, local] of v.parents) {
        p.grad += local * v.grad;
        observe?.(p, v.grad, local, v);
      }
  }
}
export const scalar = (v: Scalar | number) =>
  v instanceof Scalar ? v : new Scalar(v);
export const sum = (a: Scalar[]) => a.reduce((s, v) => s.add(v), new Scalar(0));
export const dot = (a: Scalar[], b: Scalar[]) =>
  sum(a.map((v, i) => v.mul(b[i])));
export function softmax(a: Scalar[]) {
  const max = Math.max(...a.map((v) => v.value)),
    exps = a.map((v) => v.add(-max).exp());
  const inverse = sum(exps).pow(-1);
  return exps.map((v) => v.mul(inverse));
}
export type Parameter = { name: string; group: string; node: Scalar };
export function parameterStore(overrides: Record<string, number> = {}) {
  const params: Parameter[] = [];
  const matrix = (name: string, rows: number, cols: number, bias = false) =>
    Array.from({ length: rows }, (_, i) =>
      Array.from({ length: cols }, (_, j) => {
        const key = `${name}[${i},${j}]`,
          n = params.length;
        const node = new Scalar(
          overrides[key] ?? (bias ? 0 : Math.sin(n * 2.17 + 1) * 0.45),
        );
        params.push({ name: key, group: name, node });
        return node;
      }),
    );
  return { params, matrix };
}
export const values = (a: Scalar[][]) => a.map((r) => r.map((v) => v.value));
export const linear = (x: Scalar[][], w: Scalar[][], b?: Scalar[]) =>
  x.map((row) =>
    w[0].map((_, j) => sum(row.map((v, i) => v.mul(w[i][j]))).add(b?.[j] ?? 0)),
  );
