# Roadmap

Plans, not promises — this is a volunteer project. Items move when issues
demonstrate real maintainer need. Nothing below is started unless linked to
a tracking issue.

## 0.2 — calibration and ergonomics

- **Calibration corpus tooling**: a script to run slopguard over a set of
  historical PR URLs (via `gh`) and report score distributions, so projects
  can tune weights against their own traffic instead of trusting defaults.
- **Config presets**: `"preset": "strict" | "lenient" | "monorepo"` in the
  config file, because monorepos legitimately trip `unrelated-files`.
- **Per-path exemptions**: glob patterns to exclude (e.g. `docs/**` PRs in a
  docs-heavy project).
- `.slopguard.json` auto-discovery in the repository root.

## 0.3 — signal quality

- Non-English boilerplate patterns (Japanese first, since the maintainer can
  actually validate them; community patterns via the signal-feedback template).
- Commit-message signals (bulk identical messages, subject/diff mismatch).
- Smarter test detection (repos that keep tests out-of-tree, doctest styles).

## Later / maybe

- GitLab MR support (input adapter only; scoring stays platform-neutral).
- A `--compare` mode showing which signals changed between two pushes of the
  same PR.
- SARIF output so signals can appear in the GitHub code-scanning UI.

## Explicit non-goals

Codified in [GOVERNANCE.md](./GOVERNANCE.md#scope): AI-authorship claims,
contributor profiling, block lists, default-on gating. Not "later" — never.
