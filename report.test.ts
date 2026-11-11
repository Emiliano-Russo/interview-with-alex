import { describe, expect, it } from "vitest";
import type { Post } from "./data.js";
import { createPredictor, type Prediction } from "./predict.js";
import { assessConfidence, classifyBand, createReporter } from "./report.js";

function post(id: string, author: string, text: string, likes: number): Post {
  return { id, author, text, likes, comments: 0, shares: 0 };
}

const basePrediction: Prediction = {
  draft: "d.md",
  author: "A",
  baselineLog: 5,
  baselineSource: "author",
  contentAdjustment: 0,
  predictedLog: 5,
  predictedEngagement: Math.expm1(5),
  neighbors: [],
};

describe("classifyBand", () => {
  const thresholds = { lower: -0.5, upper: 0.5 };

  it("classifies relative to the historical interquartile range", () => {
    expect(classifyBand(-0.6, thresholds)).toBe("below_typical");
    expect(classifyBand(0, thresholds)).toBe("typical");
    expect(classifyBand(0.6, thresholds)).toBe("above_typical");
  });
});

describe("assessConfidence", () => {
  it("is low when the global baseline is used", () => {
    expect(assessConfidence({ ...basePrediction, baselineSource: "global" }).level).toBe("low");
  });

  it("is at most medium even with an author baseline", () => {
    expect(assessConfidence(basePrediction).level).toBe("medium");
  });
});

describe("createReporter", () => {
  const posts = [
    post("a1", "A", "enterprise agents workflows", 999),
    post("a2", "A", "office lunch chef", 99),
    post("a3", "A", "hiring engineers team", 199),
    post("b1", "B", "enterprise agents platform", 39),
    post("b2", "B", "office party", 9),
    post("b3", "B", "hiring sales team", 19),
  ];

  it("produces a JSON-serializable report with every required field", () => {
    const prediction = createPredictor(posts, 2).predict({ name: "d.md", author: "B", text: "enterprise agents" });
    const report = createReporter(posts)(prediction);

    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
    expect(report).toMatchObject({
      draft: "d.md",
      author: "B",
      authorBaseline: { source: "author", historicalPosts: 3 },
      confidence: { level: "medium" },
    });
    expect(report.predictedScore.engagement).toBe(Math.round(prediction.predictedEngagement));
    expect(report.similarPosts.length).toBeGreaterThan(0);
    expect(report.explanation).toContain("B has 3 historical posts");
  });
});
