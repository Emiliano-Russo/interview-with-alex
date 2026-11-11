import { describe, expect, it } from "vitest";
import type { Post } from "./data.js";
import { parseDraft } from "./drafts.js";
import { computeBaselines } from "./performance.js";
import { createPredictor } from "./predict.js";
import { TfIdfIndex, tokenize } from "./similarity.js";

function post(id: string, author: string, text: string, likes: number): Post {
  return { id, author, text, likes, comments: 0, shares: 0 };
}

describe("tokenize", () => {
  it("lowercases, drops URLs and short tokens", () => {
    expect(tokenize("AI agents at Box https://lnkd.in/abc are GREAT")).toEqual([
      "agents",
      "box",
      "are",
      "great",
    ]);
  });
});

describe("TfIdfIndex", () => {
  it("ranks the most similar document first and skips unrelated ones", () => {
    const index = new TfIdfIndex([
      { id: "agents", text: "enterprise agents automate workflows" },
      { id: "food", text: "office lunch chef cooking" },
    ]);
    const matches = index.search("agents for enterprise workflows", 5);
    expect(matches.map((m) => m.id)).toEqual(["agents"]);
  });
});

describe("parseDraft", () => {
  it("reads the author line and the body", () => {
    expect(parseDraft("01.md", "Author: Box\r\n\r\nHello world\n")).toEqual({
      name: "01.md",
      author: "Box",
      text: "Hello world",
    });
  });

  it("rejects drafts without an author line", () => {
    expect(() => parseDraft("x.md", "Hello")).toThrow(/Author/);
  });
});

describe("createPredictor", () => {
  const posts = [
    post("a1", "A", "enterprise agents workflows", 999),
    post("a2", "A", "office lunch chef", 99),
    post("a3", "A", "hiring engineers team", 199),
    post("b1", "B", "enterprise agents platform", 39),
    post("b2", "B", "office party", 9),
    post("b3", "B", "hiring sales team", 19),
    post("solo", "Solo", "enterprise agents everywhere", 5000),
  ];
  const predictor = createPredictor(posts, 2);

  it("adds the similarity-weighted relative score of neighbors to the author baseline", () => {
    const prediction = predictor.predict({ name: "d", author: "B", text: "enterprise agents" });
    const baseline = computeBaselines(posts).forAuthor("B");

    expect(prediction.baselineSource).toBe("author");
    expect(prediction.baselineLog).toBeCloseTo(baseline.value);
    expect(prediction.contentAdjustment).toBeGreaterThan(0);
    expect(prediction.predictedLog).toBeCloseTo(baseline.value + prediction.contentAdjustment);
  });

  it("never uses posts from authors without their own baseline as neighbors", () => {
    const prediction = predictor.predict({ name: "d", author: "B", text: "enterprise agents everywhere" });
    expect(prediction.neighbors.map((n) => n.id)).not.toContain("solo");
  });

  it("falls back to the global baseline and no adjustment for unknown authors and unmatched text", () => {
    const prediction = predictor.predict({ name: "d", author: "New", text: "zzz qqq" });
    expect(prediction.baselineSource).toBe("global");
    expect(prediction.contentAdjustment).toBe(0);
    expect(prediction.neighbors).toEqual([]);
  });
});
