const URL_PATTERN = /https?:\/\/\S+/g;
const MIN_TOKEN_LENGTH = 3;

type Vector = Map<string, number>;

export interface Document {
  id: string;
  text: string;
}

export interface Match {
  id: string;
  similarity: number;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(URL_PATTERN, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= MIN_TOKEN_LENGTH);
}

function termFrequencies(tokens: string[]): Vector {
  const counts: Vector = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

function cosine(a: Vector, b: Vector): number {
  let dot = 0;
  for (const [term, weight] of a) dot += weight * (b.get(term) ?? 0);
  const norm = (v: Vector) => Math.sqrt([...v.values()].reduce((sum, w) => sum + w * w, 0));
  const denominator = norm(a) * norm(b);
  return denominator === 0 ? 0 : dot / denominator;
}

export class TfIdfIndex {
  private readonly idf = new Map<string, number>();
  private readonly vectors: { id: string; vector: Vector }[];

  constructor(documents: Document[]) {
    const tokenized = documents.map((d) => ({ id: d.id, tf: termFrequencies(tokenize(d.text)) }));

    const documentFrequency = new Map<string, number>();
    for (const { tf } of tokenized) {
      for (const term of tf.keys()) {
        documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
      }
    }
    const n = documents.length;
    for (const [term, df] of documentFrequency) {
      this.idf.set(term, Math.log((1 + n) / (1 + df)) + 1);
    }

    this.vectors = tokenized.map(({ id, tf }) => ({ id, vector: this.weigh(tf) }));
  }

  private weigh(tf: Vector): Vector {
    const weighted: Vector = new Map();
    for (const [term, count] of tf) {
      const idf = this.idf.get(term);
      if (idf !== undefined) weighted.set(term, count * idf);
    }
    return weighted;
  }

  search(text: string, k: number): Match[] {
    const query = this.weigh(termFrequencies(tokenize(text)));
    return this.vectors
      .map(({ id, vector }) => ({ id, similarity: cosine(query, vector) }))
      .filter((match) => match.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
  }
}
