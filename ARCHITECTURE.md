# Architecture

slopguard is a small, dependency-free TypeScript library with two thin
front-ends (a CLI and a composite GitHub Action). Total runtime dependency
count: zero. That is a feature — this tool runs inside other people's CI with
a token nearby, so the supply-chain surface is kept as small as possible.

## Data flow

```
gh api .../pulls/N            gh api -H "Accept: ...diff" .../pulls/N
        |                                      |
     pr.json                                pr.diff
        \                                      /
         \                                    /
          v                                  v
   +-------------------------------------------------+
   | analyzePullRequest(pr, diffText, config?)       |
   |                                                 |
   |  parseUnifiedDiff()      src/diff.ts            |
   |        |                                        |
   |  computeDiffStats()      src/signals/diff.ts    |
   |        |                                        |
   |  collectDiffSignals()    src/signals/diff.ts    |
   |  collectBodySignals()    src/signals/body.ts    |
   |  collectContributorSignals()  .../contributor.ts|
   |        |                                        |
   |  score = clamp(sum(weight x intensity), 0, 100) |
   +-------------------------------------------------+
                          |
                   Report (JSON-safe)
                    /     |       \
              pretty   markdown   json
              (TTY)   (PR comment) (machines)

optional, opt-in:  runLlmReview() -> withLlmSignal(report, note)
```

## Modules

| Module | Responsibility | Notes |
| --- | --- | --- |
| `src/types.ts` | Shared shapes | Input mirrors `gh api` PR JSON; all fields optional |
| `src/diff.ts` | Unified diff parser | Tolerant by design; GitHub truncates big diffs |
| `src/paths.ts` | Path classification | lockfile / vendored / test / code heuristics |
| `src/signals/diff.ts` | Diff-shape signals + `DiffStats` | Prefers API line counts over parsed counts |
| `src/signals/body.ts` | Description signals | Boilerplate patterns are data, exported for tests |
| `src/signals/contributor.ts` | Contributor context | Combination-only; bots/missing data degrade to notes |
| `src/config.ts` | Weights, thresholds, levels | Everything overridable; `ramp()` for graduated intensity |
| `src/analyze.ts` | Orchestration + scoring | Pure function of inputs (except timestamp) |
| `src/llm.ts` | Opt-in LLM second opinion | Plain `fetch`, injectable for tests, failures degrade |
| `src/report/*` | Renderers | Markdown embeds `<!-- slopguard:report -->` for comment upsert |
| `src/cli.ts` | IO and flags | Exit 0 by default; `--threshold` is the only gate and is opt-in |
| `action.yml` | Composite Action | Builds from source at run time; `dry-run` defaults to true |

## Design decisions

**Signals, not verdicts.** The scoring model is a transparent weighted sum,
not a classifier. This is deliberate: a maintainer must be able to read every
point of the score and veto it. Accuracy claims about "AI detection" are a
non-goal (see GOVERNANCE.md for the scope rules that enforce this).

**Saturating weights above 100.** The sum of all weights exceeds 100, then
the score clamps. No single signal can push a PR into "high" alone, and a PR
does not need to trip every heuristic to get there.

**Graduated intensities.** Signals use `ramp(value, low, high)` rather than
binary cliffs, so a 450-line diff scores differently from a 6,000-line one.
Cliff effects create gaming incentives and unfair edge cases.

**API counts over parsed counts.** For PR-level size we trust
`additions`/`deletions` from the API (GitHub truncates large diffs); for
composition ratios we necessarily use the parsed diff and say so in the docs.

**Sparse bodies short-circuit body sub-checks.** An empty description already
raises `sparse-body`; also raising "no issue reference" and "no verification
steps" would triple-count the same underlying fact.

**The Action builds from source.** No committed `dist/`, so reviewing the
Action means reviewing `src/`. Costs ~20s of CI per run; avoids the classic
"compiled artifact drifts from source" attack/bug surface.

**LLM is additive and bounded.** The optional model note is folded in as one
more weighted signal (default max 10 points). It can nudge, never dominate,
and the tool is complete without it.

## Testing strategy

- **Unit**: parser, ramp/levels, path classification, provider resolution,
  JSON extraction from model output (`test/*.test.js`, `node:test`).
- **Fixture integration**: five checked-in PRs (2 well-formed, 3 slop-shaped)
  with expected score bands and signal sets (`test/fixtures/`). These fixtures
  are the project's regression memory; signal tuning PRs must update them.
- **CLI black-box**: spawned end-to-end runs asserting formats, exit codes,
  stdin handling, and the no-key LLM degradation path.
