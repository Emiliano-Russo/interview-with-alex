import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadPosts } from "./data.js";
import { loadDraft } from "./drafts.js";
import { createPredictor } from "./predict.js";
import { createReporter } from "./report.js";

const DRAFTS_DIR = "data/drafts";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const paths =
    args.length > 0
      ? args
      : (await readdir(DRAFTS_DIR)).filter((f) => f.endsWith(".md")).sort().map((f) => join(DRAFTS_DIR, f));

  const posts = await loadPosts();
  const predictor = createPredictor(posts);
  const report = createReporter(posts);

  const reports = [];
  for (const path of paths) {
    reports.push(report(predictor.predict(await loadDraft(path))));
  }

  console.log(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
}

main().catch((error: unknown) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
