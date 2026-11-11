import type { Post } from "./data.js";
import type { Draft } from "./drafts.js";
import { type BaselineSource, computeBaselines, scorePerformance } from "./performance.js";
import { TfIdfIndex } from "./similarity.js";

export const DEFAULT_NEIGHBORS = 5;

export interface Neighbor {
  id: string;
  author: string;
  similarity: number;
  relativeScore: number;
  text: string;
}

export interface Prediction {
  draft: string;
  author: string;
  baselineLog: number;
  baselineSource: BaselineSource;
  contentAdjustment: number;
  predictedLog: number;
  predictedEngagement: number;
  neighbors: Neighbor[];
}

export interface Predictor {
  predict(draft: Draft): Prediction;
}

export function createPredictor(posts: Post[], k = DEFAULT_NEIGHBORS): Predictor {
  const baselines = computeBaselines(posts);
  const postById = new Map(posts.map((p) => [p.id, p]));
  // Posts scored against the global baseline carry audience size in their
  // relative score, so they say nothing about how the content itself did.
  const performanceById = new Map(
    scorePerformance(posts)
      .filter((r) => r.baselineSource === "author")
      .map((r) => [r.id, r]),
  );
  const index = new TfIdfIndex(posts.filter((p) => performanceById.has(p.id)));

  return {
    predict(draft) {
      const baseline = baselines.forAuthor(draft.author);

      const neighbors: Neighbor[] = index.search(draft.text, k).map(({ id, similarity }) => {
        const post = postById.get(id)!;
        return {
          id,
          author: post.author,
          similarity,
          relativeScore: performanceById.get(id)!.relativeScore,
          text: post.text,
        };
      });

      const totalSimilarity = neighbors.reduce((sum, n) => sum + n.similarity, 0);
      const contentAdjustment =
        totalSimilarity === 0
          ? 0
          : neighbors.reduce((sum, n) => sum + n.similarity * n.relativeScore, 0) / totalSimilarity;

      const predictedLog = baseline.value + contentAdjustment;
      return {
        draft: draft.name,
        author: draft.author,
        baselineLog: baseline.value,
        baselineSource: baseline.source,
        contentAdjustment,
        predictedLog,
        predictedEngagement: Math.expm1(predictedLog),
        neighbors,
      };
    },
  };
}
