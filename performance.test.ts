import { describe, expect, it } from "vitest";
import type { Post } from "./data.js";
import { median, scorePerformance } from "./performance.js";

function post(id: string, author: string, likes: number, comments = 0, shares = 0): Post {
  return { id, author, text: "", likes, comments, shares };
}

describe("median", () => {
  it("handles odd and even lengths", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("scorePerformance", () => {
  it("scores a post relative to its author's median, not across authors", () => {
    const posts = [
      post("big-1", "Big", 999),
      post("big-2", "Big", 1999),
      post("big-3", "Big", 3999),
      post("small-1", "Small", 9),
      post("small-2", "Small", 19),
      post("small-3", "Small", 39),
    ];
    const byId = new Map(scorePerformance(posts).map((r) => [r.id, r]));

    expect(byId.get("big-2")!.relativeScore).toBeCloseTo(0);
    expect(byId.get("small-2")!.relativeScore).toBeCloseTo(0);
    expect(byId.get("small-3")!.relativeScore).toBeCloseTo(byId.get("big-3")!.relativeScore, 1);
  });

  it("falls back to the global baseline for authors with too few posts", () => {
    const posts = [
      post("a1", "A", 10),
      post("a2", "A", 20),
      post("a3", "A", 30),
      post("solo", "Solo", 500),
    ];
    const solo = scorePerformance(posts).find((r) => r.id === "solo")!;

    expect(solo.baselineSource).toBe("global");
    expect(solo.relativeScore).toBeGreaterThan(0);
  });

  it("sums likes, comments and shares into engagement", () => {
    const [result] = scorePerformance([post("x", "X", 5, 3, 2)], 1);
    expect(result.engagement).toBe(10);
    expect(result.logEngagement).toBeCloseTo(Math.log1p(10));
  });
});
