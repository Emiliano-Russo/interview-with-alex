import type { Post } from "./data.js";

// Authors with fewer posts than this fall back to the global baseline,
// since a median over one or two posts is mostly noise.
export const MIN_POSTS_FOR_AUTHOR_BASELINE = 3;

export type BaselineSource = "author" | "global";

export interface PerformanceResult {
  id: string;
  author: string;
  engagement: number;
  logEngagement: number;
  baseline: number;
  baselineSource: BaselineSource;
  relativeScore: number;
}

export function totalEngagement(post: Pick<Post, "likes" | "comments" | "shares">): number {
  return post.likes + post.comments + post.shares;
}

export function median(values: number[]): number {
  if (values.length === 0) throw new Error("median of empty array");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function quantile(values: number[], q: number): number {
  if (values.length === 0) throw new Error("quantile of empty array");
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export interface Baseline {
  value: number;
  source: BaselineSource;
}

export interface Baselines {
  global: number;
  forAuthor(author: string): Baseline;
}

export function computeBaselines(
  posts: Post[],
  minPosts = MIN_POSTS_FOR_AUTHOR_BASELINE,
): Baselines {
  const logs = posts.map((p) => Math.log1p(totalEngagement(p)));
  const global = median(logs);

  const logsByAuthor = new Map<string, number[]>();
  posts.forEach((post, i) => {
    const authorLogs = logsByAuthor.get(post.author) ?? [];
    authorLogs.push(logs[i]);
    logsByAuthor.set(post.author, authorLogs);
  });

  return {
    global,
    forAuthor(author) {
      const authorLogs = logsByAuthor.get(author) ?? [];
      return authorLogs.length >= minPosts
        ? { value: median(authorLogs), source: "author" }
        : { value: global, source: "global" };
    },
  };
}

export function scorePerformance(
  posts: Post[],
  minPosts = MIN_POSTS_FOR_AUTHOR_BASELINE,
): PerformanceResult[] {
  const baselines = computeBaselines(posts, minPosts);

  return posts.map((post) => {
    const logEngagement = Math.log1p(totalEngagement(post));
    const baseline = baselines.forAuthor(post.author);
    return {
      id: post.id,
      author: post.author,
      engagement: totalEngagement(post),
      logEngagement,
      baseline: baseline.value,
      baselineSource: baseline.source,
      relativeScore: logEngagement - baseline.value,
    };
  });
}
