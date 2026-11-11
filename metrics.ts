export function meanAbsoluteError(predicted: number[], actual: number[]): number {
  return predicted.reduce((sum, p, i) => sum + Math.abs(p - actual[i]), 0) / predicted.length;
}

export function ranks(values: number[]): number[] {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const result = new Array<number>(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].value === order[i].value) j++;
    const averageRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) result[order[k].index] = averageRank;
    i = j + 1;
  }
  return result;
}

function pearson(a: number[], b: number[]): number {
  const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const ma = mean(a);
  const mb = mean(b);
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < a.length; i++) {
    cov += (a[i] - ma) * (b[i] - mb);
    va += (a[i] - ma) ** 2;
    vb += (b[i] - mb) ** 2;
  }
  return va === 0 || vb === 0 ? Number.NaN : cov / Math.sqrt(va * vb);
}

// NaN when either side is constant, since rank correlation is undefined there.
export function spearman(a: number[], b: number[]): number {
  return pearson(ranks(a), ranks(b));
}

function* permutations<T>(items: T[]): Generator<T[]> {
  if (items.length <= 1) {
    yield items;
    return;
  }
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const perm of permutations(rest)) yield [items[i], ...perm];
  }
}

// One-sided exact p-value: share of all orderings of `actual` whose Spearman
// correlation with `predicted` is at least as high as the observed one.
// Enumerates n! orderings, so only meant for small held-out sets.
export function spearmanPermutationPValue(predicted: number[], actual: number[]): number {
  const observed = spearman(predicted, actual);
  if (Number.isNaN(observed)) return Number.NaN;
  let atLeastAsExtreme = 0;
  let total = 0;
  for (const perm of permutations(actual)) {
    total++;
    if (spearman(predicted, perm) >= observed - 1e-12) atLeastAsExtreme++;
  }
  return atLeastAsExtreme / total;
}
