# slopguard

**Review-effort signals for pull requests that look like low-effort, AI-generated changes.**
A GitHub Action + CLI that helps maintainers decide *where their review time goes first* —
without accusing anyone of anything.

[日本語のREADMEはこちら / Japanese README](./README.ja.md)

---

## Signals, not verdicts

Maintainers of popular repositories are drowning in a new kind of contribution:
large, plausible-looking pull requests produced in minutes, submitted in bulk,
with template descriptions and no tests. Reviewing one of them costs the
maintainer more time than it cost the author to create. That asymmetry —
not AI itself — is the problem this project addresses.

slopguard deliberately does **not** try to answer "was this written by an AI?"
That question is unanswerable in general, and getting it wrong in public is
worse than not asking: a false accusation burns a well-meaning contributor,
poisons the project's reputation, and starts exactly the kind of flame war
that costs even more maintainer time. Detector-style tools invite this failure
mode by design.

So the design contract is:

- **slopguard scores review effort, not people.** The output is
  "this PR probably deserves an early, deliberate look, and here is why" —
  never "this PR is AI slop."
- **Every point on the score has a stated reason** that a human can read and
  disagree with. No opaque verdicts.
- **It never blocks anything by default.** Exit code 0, no required check,
  comment posting off until you opt in. Gating on the score is possible but
  explicitly discouraged (see the [FAQ](./docs/faq.md)).
- **AI-assisted contributions are welcome** in the ecosystem this tool serves.
  What it surfaces is *unreviewed effort asymmetry* — huge diffs with no tests,
  no linked issue, and boilerplate text — patterns that predate LLMs and
  merely got cheaper to produce.

The goal: **don't reject AI — protect maintainer review time.**

## What it looks at

Three groups of weighted heuristics, combined into a 0–100 attention score
with a reason list. Full details, weights, and known blind spots:
[docs/signals.md](./docs/signals.md).

| Group | Signals |
| --- | --- |
| **Diff statistics** | `oversized-diff` (huge single-batch change), `generated-code-ratio` (lockfiles / bundles / minified / `@generated` files dominating the diff), `missing-tests`, `unrelated-files` (mixed-concern spread) |
| **PR description** | `boilerplate-body` (template/LLM-boilerplate phrasing), `missing-issue-reference`, `missing-verification-steps`, `sparse-body` |
| **Contributor context** | `first-contribution-large-change` (first interaction with the repo *combined with* a very large diff — never "new contributor" alone) |

Levels: `low` (< 20) · `moderate` (20–44) · `elevated` (45–69) · `high` (70+).
A `high` score means "review this deliberately and early," nothing more.

## CLI

```console
$ npm install -g slopguard
```

Input is exactly what the GitHub CLI already gives you:

```console
$ gh api repos/OWNER/REPO/pulls/482 > pr.json
$ gh api -H "Accept: application/vnd.github.diff" repos/OWNER/REPO/pulls/482 > pr.diff
$ slopguard --pr pr.json --diff pr.diff
```

Example output (a fixture from this repo's test suite; per-signal detail
lines trimmed here for brevity):

```text
slopguard v0.1.0 — review-effort signals (not verdicts)

PR #512 "Major improvements and enhancements to the entire codebase 🚀" by @codewizard-supreme
+4,816 -1,187 across 42 files

Attention score: 100/100 (high)  [########################]

Signals (points · id · what we noticed):
   22.0  generated-code-ratio             80% of added lines are in lockfiles, bundles, minified output, or files tagged as generated
   18.0  boilerplate-body                 Description matches 18 common template/boilerplate patterns
   18.0  oversized-diff                   6,003 changed lines across 42 files in a single PR
   16.0  first-contribution-large-change  First interaction with this repository (FIRST_TIME_CONTRIBUTOR) combined with a 6,003-line change
   10.0  missing-verification-steps       No testing or verification notes found in the description
    6.7  unrelated-files                  Touches 7 distinct top-level areas ((root), dist, src, docs, scripts, .github, config)
    6.0  missing-issue-reference          No linked issue, discussion, or PR reference found
    4.8  missing-tests                    173 added lines of code without any test changes

Signals, not verdicts: slopguard cannot tell whether a change is AI-generated or
unwanted. Use these hints to decide where review time goes first.
```

Other formats:

```console
$ slopguard --pr pr.json --diff pr.diff --format json | jq .score
$ slopguard --pr pr.json --diff pr.diff --format markdown > comment.md
```

See [docs/cli.md](./docs/cli.md) for all flags.

## GitHub Action

```yaml
# .github/workflows/slopguard.yml
name: SlopGuard
on:
  pull_request:
    types: [opened, edited, synchronize]

permissions:
  contents: read
  pull-requests: write # only needed once dry-run is turned off

jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: kero168/slopguard@v0.1.0
        with:
          # Default is true: report goes to the job summary only.
          # Flip to false to post/update a PR comment once you trust the tuning.
          dry-run: 'true'
```

The action starts in **dry-run** on purpose. Watch the scores on your real
traffic for a week or two, tune weights if needed, then decide whether a
comment is worth the noise. Details and fork/permission caveats:
[docs/action.md](./docs/action.md).

## Optional LLM second opinion

Fully opt-in, and slopguard is complete without it:

```console
$ export ANTHROPIC_API_KEY=...   # or OPENAI_API_KEY
$ slopguard --pr pr.json --diff pr.diff --llm auto
```

The model receives the heuristic results, description, and (truncated) diff,
and returns a short triage note plus a bounded concern value that can add at
most a few points. It is called with plain `fetch` — no SDK dependencies — and
any failure degrades to a note in the report. See [docs/llm.md](./docs/llm.md),
including the privacy note about sending diff content to a third party.

## Configuration

Every weight, threshold, and level bound can be overridden with a JSON file:

```json
{
  "weights": { "missing-tests": 0, "boilerplate-body": 24 },
  "thresholds": { "oversizedLinesLow": 800 },
  "levels": { "high": 80 }
}
```

```console
$ slopguard --pr pr.json --diff pr.diff --config .slopguard.json
```

Setting a weight to `0` disables a signal. See
[docs/configuration.md](./docs/configuration.md).

## Programmatic API

```ts
import { analyzePullRequest } from 'slopguard';

const report = analyzePullRequest(prJson, diffText);
console.log(report.score, report.level);
for (const signal of report.signals) {
  console.log(`${signal.points} ${signal.id}: ${signal.summary}`);
}
```

## Honest limitations

- These are **heuristics**. A careful human PR can trip them (big vendored
  update, genuine wide refactor); a determined bad actor can dodge them.
  The score prioritizes attention — it cannot replace it.
- The `missing-verification-steps` check is keyword-based: an unsubstantiated
  "fully tested" satisfies it. Documented, not hidden.
- Boilerplate phrasing patterns are English-centric in v0.1.
- No calibration against a large public corpus has been done yet; the default
  weights are reasoned starting points, and the
  [signal feedback issue template](./.github/ISSUE_TEMPLATE/signal_feedback.yml)
  exists precisely to improve them with real-world counterexamples.

## Project

- [ARCHITECTURE.md](./ARCHITECTURE.md) — how the pieces fit
- [CONTRIBUTING.md](./CONTRIBUTING.md) — dev setup, adding a signal
- [GOVERNANCE.md](./GOVERNANCE.md) · [MAINTAINERS.md](./MAINTAINERS.md)
- [SECURITY.md](./SECURITY.md) · [SUPPORT.md](./SUPPORT.md)
- [ROADMAP.md](./ROADMAP.md) · [CHANGELOG.md](./CHANGELOG.md)

## License

[MIT](./LICENSE) © kero168
