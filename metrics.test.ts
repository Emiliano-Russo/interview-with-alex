import { describe, expect, it } from "vitest";
import { meanAbsoluteError, ranks, spearman, spearmanPermutationPValue } from "./metrics.js";

describe("ranks", () => {
  it("averages ranks for ties", () => {
    expect(ranks([10, 30, 20, 20])).toEqual([1, 4, 2.5, 2.5]);
  });
});

describe("spearman", () => {
  it("is 1 for monotonic agreement and -1 for reversal", () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 35, 100])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
  });

  it("is NaN for a constant predictor", () => {
    expect(spearman([5, 5, 5], [1, 2, 3])).toBeNaN();
  });
});

describe("spearmanPermutationPValue", () => {
  it("gives 1/n! for a perfect ranking", () => {
    expect(spearmanPermutationPValue([1, 2, 3, 4], [1, 2, 3, 4])).toBeCloseTo(1 / 24);
  });
});

describe("meanAbsoluteError", () => {
  it("averages absolute differences", () => {
    expect(meanAbsoluteError([1, 4], [2, 2])).toBe(1.5);
  });
});
