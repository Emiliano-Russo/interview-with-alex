import { readFile } from "node:fs/promises";
import { z } from "zod";

export const PostSchema = z.object({
  id: z.string(),
  author: z.string(),
  text: z.string(),
  likes: z.number().int().nonnegative(),
  comments: z.number().int().nonnegative(),
  shares: z.number().int().nonnegative(),
});

const DatasetSchema = z.object({
  posts: z.array(PostSchema),
});

export type Post = z.infer<typeof PostSchema>;

export const OutcomeSchema = z.object({
  draft: z.string(),
  author: z.string(),
  likes: z.number().int().nonnegative(),
  comments: z.number().int().nonnegative(),
  shares: z.number().int().nonnegative(),
});

export type Outcome = z.infer<typeof OutcomeSchema>;

export async function loadOutcomes(path = "data/known_outcomes.json"): Promise<Outcome[]> {
  const raw = JSON.parse(await readFile(path, "utf8"));
  return z.object({ outcomes: z.array(OutcomeSchema) }).parse(raw).outcomes;
}

export async function loadPosts(path = "data/posts.json"): Promise<Post[]> {
  const raw = JSON.parse(await readFile(path, "utf8"));
  return DatasetSchema.parse(raw).posts;
}
