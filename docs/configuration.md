# Configuration

Pass a JSON file with `--config` (CLI) or `config-file` (Action). Anything
you omit keeps its default. The full default set lives in `src/config.ts`
and is documented signal-by-signal in [signals.md](./signals.md).

```json
{
  "weights": {
    "missing-tests": 0,
    "boilerplate-body": 24,
    "unrelated-files": 4
  },
  "thresholds": {
    "oversizedLinesLow": 800,
    "oversizedLinesHigh": 8000,
    "unrelatedDirsLow": 5
  },
  "levels": {
    "elevated": 50,
    "high": 80
  }
}
```

## `weights`

Points a signal contributes at full intensity. `0` disables the signal.
Keys are the signal ids: `oversized-diff`, `generated-code-ratio`,
`missing-tests`, `unrelated-files`, `boilerplate-body`,
`missing-issue-reference`, `missing-verification-steps`, `sparse-body`,
`first-contribution-large-change`, `llm-review`.

## `thresholds`

Where each ramp starts and saturates. The names mirror `src/config.ts`
(`Thresholds` interface) and are covered per-signal in
[signals.md](./signals.md). Common tweaks:

| Situation | Tweak |
| --- | --- |
| Monorepo, wide PRs are normal | raise `unrelatedDirsLow`/`unrelatedDirsHigh`, or weight `unrelated-files: 0` |
| Repo where big vendored updates are routine | raise `generatedRatioLow` |
| Docs-heavy repo | raise `missingTestsMinCodeAdditions` |
| Very active repo, only care about extremes | raise `oversizedLinesLow` to 1000+ |

## `levels`

Lower bounds for `moderate`, `elevated`, and `high`. Purely presentational —
they change the label and comment tone, not the score.

## Suggested rollout

1. Run in the Action with `dry-run: 'true'` (the default) for a week or two.
2. Compare scores against your own judgment on real PRs; adjust weights.
3. Only then decide whether to post comments, and whether a `threshold` is
   ever justified (usually: no).
