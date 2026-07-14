# FAQ

## Is this an AI detector?

No, and it never will be (that is codified in
[GOVERNANCE.md](../GOVERNANCE.md#scope)). Text/code "AI detectors" have
well-documented false-positive problems, and in an open-source context a
false positive means publicly accusing a volunteer of fraud. slopguard
measures things that are *directly observable and directly relevant to
review cost*: diff size and composition, description quality, missing
verification, context mismatches. It reports those observations with
reasons, and stops there.

## Why shouldn't I block PRs on the score?

You *can* (`--threshold` / the Action's `threshold` input exist), but the
defaults refuse to, for three reasons:

1. **False positives are asymmetric.** A blocked good-faith contributor is
   hurt publicly; a slop PR that slips through merely costs triage time —
   which the score already helped you spend wisely.
2. **Heuristics are gameable.** Anyone who wants to get past a threshold
   will; the only people reliably stopped are the ones who did not read the
   contributing guide. You would be gating the wrong population.
3. **The score is calibrated for ranking, not judging.** "This PR deserves
   attention before that one" is robust; "76 is bad, 74 is fine" is not.

Recommended uses instead: dry-run + step summary, a `needs-early-triage`
label, sorting your review queue, or a comment that gives the *author*
actionable feedback (link an issue, describe testing, split the change).

## A perfectly good PR got a high score. Now what?

First: nothing happened to the PR — nothing was blocked or labeled unless
you configured that. Read the reasons; they are all in the report. Usually
one signal dominates and is genuinely true-but-fine for your project (e.g.
`unrelated-files` in a monorepo). Turn that weight down or off in your
[config](./configuration.md), and please file a
[signal feedback issue](https://github.com/kero168/slopguard/issues/new?template=signal_feedback.yml)
with the PR's shape so the defaults improve.

## Doesn't this discourage AI-assisted contributions?

The intent is the opposite: it separates *assistance* from *asymmetry*.
A contributor who uses an LLM, reads the output, tests it, and writes an
honest description will score low — every signal here is about observable
effort, not authorship. What scores high is the pattern that was already
unwelcome before LLMs existed: large, unverified, contextless changes that
outsource the effort to the reviewer.

## Why does the LLM feature exist at all if heuristics work?

Heuristics see shape; a model can notice content-level mismatches ("the
description says one module, the diff touches three"). Some teams find that
note useful. It is bounded (max 10 points by default), opt-in, and the tool
is complete without it — see [llm.md](./llm.md), including the privacy
trade-off of sending diff content to a provider.

## Does slopguard run code from the PR?

No. It reads the PR JSON and the diff as text. It never checks out, builds,
or executes the contribution. (The Action builds *slopguard itself* from the
pinned action ref — not the PR's code.)

## Can I use it outside GitHub?

The analyzer is platform-neutral (`analyzePullRequest(prJson, diffText)`),
but the input shape is GitHub's PR JSON. A GitLab adapter is on the
[roadmap](../ROADMAP.md); PRs welcome after an issue.

## Why zero runtime dependencies?

This tool runs in other people's CI, next to a token. Every dependency is
attack surface and audit burden for adopters. The diff parser, arg parser,
and renderers are small enough to own.
