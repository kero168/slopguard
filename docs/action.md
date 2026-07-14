# GitHub Action

slopguard ships as a composite action in this repository (`action.yml`).
It fetches the PR JSON and diff with `gh`, runs the same analyzer as the CLI,
writes the report to the job log and step summary, and — only when you turn
dry-run off — posts or updates a single PR comment.

## Minimal setup

```yaml
name: SlopGuard
on:
  pull_request:
    types: [opened, edited, synchronize]

permissions:
  contents: read

jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: kero168/slopguard@v0.1.0
```

That is fully functional: the report appears in the workflow summary for
every PR, and nothing is posted to the PR itself.

## Posting comments

```yaml
permissions:
  contents: read
  pull-requests: write

jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: kero168/slopguard@v0.1.0
        with:
          dry-run: 'false'
```

The comment embeds `<!-- slopguard:report -->`; on subsequent pushes the
action updates the existing comment instead of stacking new ones.

**Comment tone matters.** The generated comment describes the PR, includes
every reason, and ends with an explicit "signals, not verdicts" disclaimer.
If you customize anything downstream, please keep that property: a triage
comment a contributor reads about their own work should never read as an
accusation.

## Inputs

| Input | Default | Meaning |
| --- | --- | --- |
| `github-token` | `${{ github.token }}` | Token for reading the PR / posting the comment |
| `dry-run` | `'true'` | `'true'`: log + summary + outputs only. `'false'`: also upsert the PR comment |
| `threshold` | `''` (off) | Fail the step when score ≥ value. Opt-in gating — read [the FAQ](./faq.md) first |
| `llm` | `'off'` | `off` / `auto` / `anthropic` / `openai`; needs the matching API key in `env` |
| `config-file` | `''` | Path to a JSON config in your workspace (requires `actions/checkout` first) |

## Outputs

| Output | Meaning |
| --- | --- |
| `score` | 0–100 |
| `level` | `low` / `moderate` / `elevated` / `high` |
| `report-json` | Runner path of the full JSON report |

Example — label instead of comment:

```yaml
- uses: kero168/slopguard@v0.1.0
  id: slopguard
- if: steps.slopguard.outputs.level == 'high'
  run: gh pr edit "$PR" --add-label needs-early-triage
  env:
    GH_TOKEN: ${{ github.token }}
    PR: ${{ github.event.pull_request.number }}
```

## LLM keys

```yaml
- uses: kero168/slopguard@v0.1.0
  with:
    llm: 'auto'
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

The action is complete without this; see [llm.md](./llm.md) for what gets
sent where.

## Fork PRs, permissions, and safety notes

- On `pull_request` from a fork, `GITHUB_TOKEN` is read-only: analysis and
  the step summary work, comment posting does not. Options: keep dry-run for
  forks, or use `pull_request_target` **with care** — slopguard itself never
  checks out or executes PR code (it only reads the diff as text), which
  makes it safer than most in that context, but your other steps may not be.
- The action needs no `actions/checkout` unless you use `config-file`.
- PR titles/bodies are attacker-controlled input. The action's shell steps
  never interpolate them; they stay inside JSON files parsed by `jq`/Node.

## Version pinning

Pin a tag (`@v0.1.0`) or a commit SHA. The action builds from source at run
time (`npm ci && npm run build`), so what you pin is what runs — there is no
pre-built artifact that can drift from the reviewed source.
