import type { HeadWeights } from './trained-classifier';

/** Class 0 is "no supported meaning"; 1–26 are the taxonomy meanings (27 is the fallback, never trained). */
export const HEAD_CLASSES = Array.from({ length: 27 }, (_, i) => i);

export interface TrainOptions {
  epochs?: number;
  lr?: number;
  l2?: number;
  /** Per-example weight, e.g. to count operator corrections more than built-in examples. */
  sampleWeights?: number[];
  onProgress?: (epoch: number, epochs: number) => void;
}

// Embeddings are unit-length with small components; scaling lets the softmax sharpen.
const SCALE = 10;

/** Multinomial logistic regression with Adam, trained full-batch on sentence embeddings. */
export function trainHead(X: ArrayLike<number>[], labels: number[], options: TrainOptions = {}): HeadWeights {
  const { epochs = 300, lr = 0.05, l2 = 1e-3, sampleWeights, onProgress } = options;
  const classes = HEAD_CLASSES;
  const C = classes.length;
  const D = X[0].length;
  const N = X.length;
  const y = labels.map((l) => classes.indexOf(l));

  const weighted = new Float64Array(C);
  y.forEach((c, n) => (weighted[c] += sampleWeights?.[n] ?? 1));
  const total = weighted.reduce((a, b) => a + b, 0);
  const present = weighted.filter((w) => w > 0).length;
  const w = y.map((c, n) => ((sampleWeights?.[n] ?? 1) * total) / (present * weighted[c]));
  const wSum = w.reduce((a, b) => a + b, 0);

  const W = new Float64Array(C * D);
  const b = new Float64Array(C);
  const mW = new Float64Array(C * D);
  const vW = new Float64Array(C * D);
  const mb = new Float64Array(C);
  const vb = new Float64Array(C);
  const gW = new Float64Array(C * D);
  const gb = new Float64Array(C);
  const p = new Float64Array(C);
  const [beta1, beta2, eps] = [0.9, 0.999, 1e-8];

  for (let epoch = 1; epoch <= epochs; epoch++) {
    gW.fill(0);
    gb.fill(0);
    for (let n = 0; n < N; n++) {
      const x = X[n];
      let max = -Infinity;
      for (let c = 0; c < C; c++) {
        let s = b[c];
        const off = c * D;
        for (let i = 0; i < D; i++) s += W[off + i] * x[i] * SCALE;
        p[c] = s;
        if (s > max) max = s;
      }
      let sum = 0;
      for (let c = 0; c < C; c++) sum += p[c] = Math.exp(p[c] - max);
      for (let c = 0; c < C; c++) {
        const g = (w[n] * (p[c] / sum - (c === y[n] ? 1 : 0))) / wSum;
        if (g === 0) continue;
        gb[c] += g;
        const off = c * D;
        for (let i = 0; i < D; i++) gW[off + i] += g * x[i] * SCALE;
      }
    }
    const c1 = 1 - beta1 ** epoch;
    const c2 = 1 - beta2 ** epoch;
    for (let k = 0; k < C * D; k++) {
      const g = gW[k] + l2 * W[k];
      mW[k] = beta1 * mW[k] + (1 - beta1) * g;
      vW[k] = beta2 * vW[k] + (1 - beta2) * g * g;
      W[k] -= (lr * (mW[k] / c1)) / (Math.sqrt(vW[k] / c2) + eps);
    }
    for (let c = 0; c < C; c++) {
      mb[c] = beta1 * mb[c] + (1 - beta1) * gb[c];
      vb[c] = beta2 * vb[c] + (1 - beta2) * gb[c] * gb[c];
      b[c] -= (lr * (mb[c] / c1)) / (Math.sqrt(vb[c] / c2) + eps);
    }
    if (epoch % 10 === 0 || epoch === epochs) onProgress?.(epoch, epochs);
  }

  const round = (v: number) => Math.round(v * 1e5) / 1e5;
  return {
    classes,
    W: classes.map((_, c) => Array.from(W.subarray(c * D, (c + 1) * D), (v) => round(v * SCALE))),
    b: Array.from(b, round),
  };
}

/** Built-in training set, shipped as int8-quantised embeddings so phones can retrain without re-embedding it. */
export interface BaseTrainingSet {
  dims: number;
  labels: number[];
  /** Per-row dequantisation scale. */
  scales: number[];
}

export function quantize(vectors: number[][]): { data: Int8Array; scales: number[] } {
  const dims = vectors[0].length;
  const data = new Int8Array(vectors.length * dims);
  const scales = vectors.map((v, n) => {
    const scale = Math.max(...v.map(Math.abs)) / 127 || 1;
    v.forEach((x, i) => (data[n * dims + i] = Math.round(x / scale)));
    return scale;
  });
  return { data, scales };
}

export function dequantize(data: Int8Array, set: BaseTrainingSet): Float32Array[] {
  return set.scales.map((scale, n) =>
    Float32Array.from(data.subarray(n * set.dims, (n + 1) * set.dims), (q) => q * scale),
  );
}
