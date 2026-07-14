# CLI reference

```
slopguard --pr <pr.json> --diff <pr.diff> [options]
```

## Getting the inputs

slopguard reads what `gh` already produces — it performs no network calls of
its own (except the opt-in `--llm`):

```console
$ gh api repos/OWNER/REPO/pulls/482 > pr.json
$ gh api -H "Accept: application/vnd.github.diff" repos/OWNER/REPO/pulls/482 > pr.diff
```

A full webhook event payload (`{"pull_request": {...}}`) is also accepted for
`--pr` and unwrapped automatically, so `"$GITHUB_EVENT_PATH"` works directly.

One input may come from stdin using `-`:

```console
$ gh api -H "Accept: application/vnd.github.diff" repos/OWNER/REPO/pulls/482 \
    | slopguard --pr pr.json --diff -
```

## Flags

| Flag | Default | Meaning |
| --- | --- | --- |
| `--pr <file\|->` | required | PR JSON (`gh api .../pulls/N` or event payload) |
| `--diff <file\|->` | required | Unified diff text |
| `--format <pretty\|json\|markdown>` | `pretty` | Output format |
| `--config <file>` | – | JSON overrides for weights/thresholds/levels |
| `--llm <off\|auto\|anthropic\|openai>` | `off` | Opt-in LLM second opinion |
| `--llm-model <id>` | provider default | Override the model id |
| `--threshold <0-100>` | – | Exit 2 when score ≥ n (opt-in gating; see FAQ) |
| `--no-color` | – | Disable ANSI colors in pretty output (`NO_COLOR` env also respected) |
| `-h, --help` | – | Help |
| `-V, --version` | – | Version |

## Output formats

- **pretty** — human-oriented terminal output with the score bar, per-signal
  points, details, and skipped-check notes.
- **json** — the full `Report` object, stable field names, suitable for `jq`
  and downstream tooling.
- **markdown** — a PR-comment-ready document containing the hidden
  `<!-- slopguard:report -->` marker used by the Action to update (rather
  than duplicate) its comment.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Analysis completed (regardless of score) |
| 1 | Usage or input error |
| 2 | `--threshold` was set and the score reached it |

Exit code 0 on a score of 100 is intentional. slopguard is a triage aid;
if you want gating you must opt in with `--threshold`, and
[the FAQ](./faq.md#why-shouldnt-i-block-prs-on-the-score) explains why you
probably should not.

## Recipes

Score every open PR in a repo, sorted:

```bash
for n in $(gh pr list --json number --jq '.[].number'); do
  gh api "repos/OWNER/REPO/pulls/$n" > /tmp/pr.json
  gh api -H "Accept: application/vnd.github.diff" "repos/OWNER/REPO/pulls/$n" > /tmp/pr.diff
  score=$(slopguard --pr /tmp/pr.json --diff /tmp/pr.diff --format json | jq .score)
  echo "$score PR#$n"
done | sort -rn
```

Post a report as a comment manually:

```bash
slopguard --pr pr.json --diff pr.diff --format markdown \
  | gh api "repos/OWNER/REPO/issues/482/comments" -F "body=@-"
```
