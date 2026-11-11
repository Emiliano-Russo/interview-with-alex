# LinkedIn Post Evaluator

Predicts how a LinkedIn draft will perform, using only the historical posts in
`data/posts.json`, and explains every prediction with comparable past posts.

The dataset has engagement counts (likes, comments, shares) but no follower,
impression or publish-date data. The whole design follows from that limitation:
raw engagement mostly measures audience size, so predictions are anchored on
each author's own typical engagement.

## Setup

Requires Node.js 20 or later.

```bash
npm install
```

No environment variables or API keys are needed. Everything runs locally.

## Usage

| Command | What it does |
|---|---|
| `npm run predict -- data/drafts/03.md` | Evaluates one draft and prints a JSON report |
| `npm run predict` | Evaluates every draft in `data/drafts/` and prints a JSON array |
| `npm run validate` | Scores the model and two baselines against the 7 known outcomes |
| `npm run inspect` | Prints engagement distributions overall and by author |
| `npm run typecheck` | Runs the TypeScript compiler without emitting files |
| `npm test` | Runs the unit tests (Vitest) |

`npm run dev` is an alias for `npm run predict`. Use `npm run -s predict ...`
to suppress npm's own header lines when piping the JSON to another tool.

Drafts are Markdown files whose first line is `Author: <name>`, followed by the
post body.

### Example output

```json
{
  "draft": "03.md",
  "author": "Annabel Gray",
  "predictedScore": { "engagement": 435, "relativeToBaseline": 0.28 },
  "performanceBand": "typical",
  "authorBaseline": { "engagement": 328, "source": "global", "historicalPosts": 0 },
  "similarPosts": [
    { "id": "p030", "author": "James Cadwallader", "similarity": 0.337, "relativeScore": -0.51, "excerpt": "Sessions from Zero Click by Profound Sydney…" }
  ],
  "explanation": "Annabel Gray has 0 historical posts, so the global median engagement of ~328 is used as the baseline. ...",
  "confidence": { "level": "low", "reasons": ["..."] }
}
```

| Field | Meaning |
|---|---|
| `predictedScore.engagement` | Predicted total engagement (likes + comments + shares) |
| `predictedScore.relativeToBaseline` | Content adjustment in log units; +1 is about 2.7× the baseline |
| `performanceBand` | `below_typical`, `typical` or `above_typical` compared with the author's norm (see below) |
| `authorBaseline` | The author's median engagement, or the global median when the author has fewer than 3 posts |
| `similarPosts` | The 5 most similar historical posts that drove the adjustment |
| `confidence` | `low` or `medium`, with the reasons spelled out |

## Architecture

```
data.ts         Loads and validates posts.json and known_outcomes.json (zod)
drafts.ts       Parses draft Markdown files ("Author:" line + body)
performance.ts  Engagement, log transform, author/global baselines, relative scores
similarity.ts   In-memory TF-IDF index with cosine similarity
predict.ts      Combines author baseline with similar posts' relative scores
report.ts       Turns a prediction into the JSON report (band, explanation, confidence)
metrics.ts      MAE, Spearman rank correlation, exact permutation test
cli.ts          `npm run predict` entry point
eval.ts         `npm run validate` entry point (held-out evaluation)
inspect.ts      `npm run inspect` entry point (dataset exploration)
*.test.ts       Unit tests
```

### How a prediction is made

1. **Engagement** is `likes + comments + shares`, transformed with `log(1 + x)`
   because the distribution is heavily right-skewed (median 328, max 5,524).
2. **Author baseline:** the median log engagement of the author's historical
   posts. Authors with fewer than 3 posts fall back to the global median.
3. **Relative score** of each historical post: its log engagement minus its
   author's baseline. It answers "how did this post do compared with what this
   author usually gets?", independent of audience size.
4. **Similar posts:** TF-IDF cosine similarity retrieves the 5 historical posts
   closest to the draft. Only posts whose author has a real baseline are used,
   because relative scores against the global median still reflect audience size.
5. **Prediction:** author baseline + similarity-weighted mean of the similar
   posts' relative scores.

### Presentation layer (`report.ts`)

- **Performance band:** the content adjustment is compared with the 25th and
  75th percentiles of historical relative scores. Within that range is
  `typical`; below or above it is `below_typical` or `above_typical`.
  Thresholds come from historical posts only.
- **Confidence:** `low` when the global baseline is used, otherwise `medium`.
  It is never `high`, because validation did not demonstrate predictive value
  beyond the author baseline.

## Technical decisions

- **Log scale and medians instead of raw means.** A single viral post would
  otherwise dominate both baselines and errors.
- **Author-relative scoring.** Without follower or impression counts, comparing
  raw engagement across authors mostly ranks audience size, not content.
- **TF-IDF instead of embeddings or a vector database.** With 57 posts, a ~60-line
  in-memory index is enough, needs no API calls or keys, is deterministic, and
  every similarity score can be inspected.
- **No fitted or hand-picked feature weights.** Likes, comments and shares are
  summed equally, and the only weighting is by similarity. Any learned weight
  would need more data than we have to justify it.
- **Observed performance kept separate from content features.** The baseline
  layer (`performance.ts`) never looks at text; text only enters through
  retrieval.
- **Held-out evaluation set.** The 7 known outcomes were not used during
  development, and the algorithm was not tuned after seeing the results.

## Validation results

`npm run validate` scores three predictors on the 7 published drafts:

| Predictor | MAE (log) | Typical error | Spearman | p (one-sided) |
|---|---|---|---|---|
| Global median | 0.95 | 2.59× | n/a (constant) | n/a |
| Author baseline | 0.80 | 2.21× | 0.30 | 0.265 |
| Model (author + similar posts) | 0.82 | 2.27× | 0.04 | 0.482 |

"Typical error" is `exp(MAE)`: predictions are off by roughly this factor.
The p-value is an exact permutation test over all 5,040 orderings of the 7
outcomes.

**Interpretation:**

- The author baseline is modestly better than a constant guess, but its rank
  correlation is not statistically significant with 7 drafts.
- The similar-post content adjustment does **not** improve on the author
  baseline. It made 4 of the 7 predictions worse, and its ranking is close to
  random.
- The largest miss is draft 10 (James Cadwallader): 1,253 actual against an
  author baseline of 92, about 13× his norm. The model moved in the right
  direction (207) but nothing in the data predicts a jump that size.
- The honest claim is that the author's typical engagement is the most
  defensible estimate, with roughly a 2× typical error. Similar posts are best
  presented as an explanation aid, not as a source of accuracy.

## Known limitations

- **Small data.** 57 historical posts and 7 held-out outcomes; none of the
  differences above are statistically significant.
- **No audience data.** No followers, impressions or dates, so audience growth,
  timing and reach cannot be modelled.
- **Unknown authors.** 3 of the 7 evaluated drafts (Box, Annabel Gray, brendan
  short) have fewer than 3 historical posts and fall back to the global median.
- **Uneven author coverage.** Aaron Levie has 16 of the 57 posts and writes
  broadly about AI, so he dominates similar-post results for other authors.
- **Bag-of-words similarity.** TF-IDF matches shared vocabulary ("agents",
  "enterprise"), not meaning, tone or format. Typical similarities are only
  0.13–0.35.
- **Equal engagement weights.** A share counts the same as a like, so likes
  drive most of the score.
- **Fixed parameters.** The 3-post cutoff and the 5 similar posts are reasoned
  defaults, not tuned. Tuning should use leave-one-out on historical posts,
  never the held-out drafts.
- **Unused dependency.** `openai` was installed during setup but is not used;
  no API calls are made.
