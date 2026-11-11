import "dotenv/config";
import { join } from "node:path";
import { loadOutcomes, loadPosts } from "./data.js";
import { loadDraft } from "./drafts.js";
import { meanAbsoluteError, spearman, spearmanPermutationPValue } from "./metrics.js";
import { computeBaselines, totalEngagement } from "./performance.js";
import { createPredictor } from "./predict.js";

const DRAFTS_DIR = "data/drafts";

const format = (value: number, digits = 2) => (Number.isNaN(value) ? "n/a" : value.toFixed(digits));

async function main(): Promise<void> {
  const posts = await loadPosts();
  const outcomes = await loadOutcomes();
  const baselines = computeBaselines(posts);
  const predictor = createPredictor(posts);

  const rows = await Promise.all(
    outcomes.map(async (outcome) => {
      const draft = await loadDraft(join(DRAFTS_DIR, outcome.draft));
      if (draft.author !== outcome.author) {
        throw new Error(`${outcome.draft}: draft author "${draft.author}" != outcome author "${outcome.author}"`);
      }
      const prediction = predictor.predict(draft);
      return {
        draft: outcome.draft,
        author: outcome.author,
        actual: Math.log1p(totalEngagement(outcome)),
        global: baselines.global,
        authorBaseline: baselines.forAuthor(outcome.author).value,
        baselineSource: prediction.baselineSource,
        model: prediction.predictedLog,
      };
    }),
  );

  console.log(`Held-out drafts: ${rows.length}\n`);
  console.table(
    rows.map((r) => ({
      draft: r.draft,
      author: r.author,
      baseline: r.baselineSource,
      actual: Math.round(Math.expm1(r.actual)),
      global: Math.round(Math.expm1(r.global)),
      authorBaseline: Math.round(Math.expm1(r.authorBaseline)),
      model: Math.round(Math.expm1(r.model)),
    })),
  );

  const actual = rows.map((r) => r.actual);
  const predictors = {
    "Global median": rows.map((r) => r.global),
    "Author baseline": rows.map((r) => r.authorBaseline),
    "Model (author + similar posts)": rows.map((r) => r.model),
  };

  console.log("\nMetrics (log1p engagement; lower MAE and higher Spearman are better):");
  console.table(
    Object.fromEntries(
      Object.entries(predictors).map(([name, predicted]) => {
        const mae = meanAbsoluteError(predicted, actual);
        return [
          name,
          {
            "MAE (log)": format(mae),
            "Typical error (x)": format(Math.exp(mae)),
            Spearman: format(spearman(predicted, actual)),
            "p (one-sided)": format(spearmanPermutationPValue(predicted, actual), 3),
          },
        ];
      }),
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
