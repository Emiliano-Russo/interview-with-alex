import { loadPosts, type Post } from "./data.js";
import { quantile } from "./performance.js";

function summarize(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return {
    n: values.length,
    min: sorted[0],
    p25: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1],
    mean: Number(mean.toFixed(1)),
  };
}

const engagement = (p: Post) => p.likes + p.comments + p.shares;

async function main(): Promise<void> {
  const posts = await loadPosts();

  console.log(`Posts: ${posts.length}\n`);

  console.log("Overall distribution:");
  console.table({
    likes: summarize(posts.map((p) => p.likes)),
    comments: summarize(posts.map((p) => p.comments)),
    shares: summarize(posts.map((p) => p.shares)),
    total: summarize(posts.map(engagement)),
    textLength: summarize(posts.map((p) => p.text.length)),
  });

  const byAuthor = new Map<string, Post[]>();
  for (const post of posts) {
    byAuthor.set(post.author, [...(byAuthor.get(post.author) ?? []), post]);
  }

  console.log("\nTotal engagement by author:");
  console.table(
    Object.fromEntries(
      [...byAuthor.entries()]
        .map(([author, items]) => [author, summarize(items.map(engagement))] as const)
        .sort((a, b) => b[1].median - a[1].median),
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
