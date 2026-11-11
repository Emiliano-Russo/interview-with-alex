import type { Post } from "./data.js";
import { MIN_POSTS_FOR_AUTHOR_BASELINE, quantile, scorePerformance } from "./performance.js";
import type { Prediction } from "./predict.js";

const EXCERPT_LENGTH = 120;

export type PerformanceBand = "below_typical" | "typical" | "above_typical";
export type ConfidenceLevel = "low" | "medium";

export interface BandThresholds {
  lower: number;
  upper: number;
}

export interface Report {
  draft: string;
  author: string;
  predictedScore: {
    engagement: number;
    relativeToBaseline: number;
  };
  performanceBand: PerformanceBand;
  authorBaseline: {
    engagement: number;
    source: "author" | "global";
    historicalPosts: number;
  };
  similarPosts: {
    id: string;
    author: string;
    similarity: number;
    relativeScore: number;
    excerpt: string;
  }[];
  explanation: string;
  confidence: {
    level: ConfidenceLevel;
    reasons: string[];
  };
}

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH)}…` : flat;
}

// Bands use the interquartile range of historical author-relative scores, so
// "typical" means "within the middle half of how posts usually deviate from
// their author's norm". Derived from historical posts only, never held-out data.
export function bandThresholds(posts: Post[]): BandThresholds {
  const relative = scorePerformance(posts)
    .filter((r) => r.baselineSource === "author")
    .map((r) => r.relativeScore);
  return { lower: quantile(relative, 0.25), upper: quantile(relative, 0.75) };
}

export function classifyBand(relativeToBaseline: number, thresholds: BandThresholds): PerformanceBand {
  if (relativeToBaseline < thresholds.lower) return "below_typical";
  if (relativeToBaseline > thresholds.upper) return "above_typical";
  return "typical";
}

// Capped at "medium": held-out validation did not show the model beating the
// author baseline, so no prediction is reported as high confidence.
export function assessConfidence(prediction: Prediction): Report["confidence"] {
  const reasons: string[] = [];
  if (prediction.baselineSource === "global") {
    reasons.push(
      `Author has fewer than ${MIN_POSTS_FOR_AUTHOR_BASELINE} historical posts, so the global median is used instead of an author baseline.`,
    );
  } else {
    reasons.push("Author baseline is based on the author's own historical posts.");
  }
  if (prediction.neighbors.length === 0) {
    reasons.push("No similar historical posts were found, so there is no content adjustment.");
  }
  reasons.push(
    "Held-out validation on 7 published drafts did not show the content adjustment improving on the author baseline.",
  );
  return { level: prediction.baselineSource === "global" ? "low" : "medium", reasons };
}

function explain(prediction: Prediction, historicalPosts: number): string {
  const baselineEngagement = Math.round(Math.expm1(prediction.baselineLog));
  const predicted = Math.round(prediction.predictedEngagement);
  const baselinePart =
    prediction.baselineSource === "author"
      ? `${prediction.author} has ${historicalPosts} historical posts with a median engagement of ~${baselineEngagement}.`
      : `${prediction.author} has ${historicalPosts} historical posts, so the global median engagement of ~${baselineEngagement} is used as the baseline.`;

  if (prediction.neighbors.length === 0) {
    return `${baselinePart} No similar historical posts were found, so the prediction equals the baseline.`;
  }

  const direction = prediction.contentAdjustment >= 0 ? "above" : "below";
  return (
    `${baselinePart} The ${prediction.neighbors.length} most similar historical posts performed ` +
    `${Math.abs(prediction.contentAdjustment).toFixed(2)} log units ${direction} their authors' typical level ` +
    `(similarity-weighted), so the prediction is adjusted to ~${predicted} total engagement (likes + comments + shares).`
  );
}

export function createReporter(posts: Post[]) {
  const thresholds = bandThresholds(posts);
  const postCountByAuthor = new Map<string, number>();
  for (const post of posts) {
    postCountByAuthor.set(post.author, (postCountByAuthor.get(post.author) ?? 0) + 1);
  }

  return (prediction: Prediction): Report => {
    const historicalPosts = postCountByAuthor.get(prediction.author) ?? 0;
    return {
      draft: prediction.draft,
      author: prediction.author,
      predictedScore: {
        engagement: Math.round(prediction.predictedEngagement),
        relativeToBaseline: round(prediction.contentAdjustment),
      },
      performanceBand: classifyBand(prediction.contentAdjustment, thresholds),
      authorBaseline: {
        engagement: Math.round(Math.expm1(prediction.baselineLog)),
        source: prediction.baselineSource,
        historicalPosts,
      },
      similarPosts: prediction.neighbors.map((n) => ({
        id: n.id,
        author: n.author,
        similarity: round(n.similarity, 3),
        relativeScore: round(n.relativeScore),
        excerpt: excerpt(n.text),
      })),
      explanation: explain(prediction, historicalPosts),
      confidence: assessConfidence(prediction),
    };
  };
}
