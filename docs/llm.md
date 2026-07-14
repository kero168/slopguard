# Optional LLM second opinion

Off by default. slopguard's heuristic analysis is complete without any LLM;
this feature adds one extra *bounded* signal for teams that want it.

## Enabling

```console
$ export ANTHROPIC_API_KEY=sk-ant-...    # or OPENAI_API_KEY=sk-...
$ slopguard --pr pr.json --diff pr.diff --llm auto
```

| `--llm` value | Behavior |
| --- | --- |
| `off` (default) | No network call, no key read |
| `auto` | Anthropic if `ANTHROPIC_API_KEY` is set, else OpenAI if `OPENAI_API_KEY` is set, else a note in the report |
| `anthropic` | Anthropic only (`claude-sonnet-4-5` by default) |
| `openai` | OpenAI only (`gpt-4o-mini` by default) |

Override the model with `--llm-model`. Requests use plain `fetch` with a 30s
timeout — there is no SDK dependency.

## What is sent

- The already-computed heuristic signal list
- PR title and description (truncated to 4,000 chars)
- The diff, truncated to 20,000 chars

**Privacy note:** this means PR content leaves your machine/runner and goes
to the provider you chose, under that provider's data terms. Do not enable
this on repositories where that is not acceptable. This is the main reason
the feature is opt-in rather than opt-out.

## What comes back

The model is instructed to return strict JSON:

```json
{ "concern": 0.4, "note": "The retry logic changes three modules but the description only mentions one; worth asking about scope." }
```

- `concern` (clamped to 0..1) becomes the intensity of the `llm-review`
  signal — default weight 10, so the model can add **at most 10 points**.
- `note` appears verbatim in the report, attributed to the provider/model.
- The prompt explicitly tells the model it is producing a triage hint, not a
  verdict, and must not claim certainty about AI authorship.

## Failure behavior

Missing key, network error, HTTP error, timeout, or unparseable output all
degrade to a `llm-review skipped: …` note in the report. The exit code and
the heuristic score are unaffected. This is tested (`test/llm.test.js`,
`test/cli.test.js`).
