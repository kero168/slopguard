# Governance

slopguard is a small project with a single maintainer. This document exists
so that expectations are explicit anyway — especially the project's scope,
which is a values question, not just a technical one.

## Scope

slopguard exists to **protect maintainer review time**, not to police
contributors or detect AI authorship.

The following are **in scope**:

- Heuristics over PR *artifacts* (diff shape, description quality, linked
  context) that estimate review effort
- Explainability: every score component has a human-readable reason
- Integrations that surface signals to maintainers (CLI, Action, API)

The following are **permanently out of scope**, and PRs implementing them
will be declined regardless of quality:

- Claims of AI authorship ("this was written by ChatGPT") or accuracy
  statistics implying such claims
- Contributor profiling beyond the PR at hand (account history mining,
  cross-repository tracking, block lists of users)
- Default-on gating, auto-closing, or auto-labeling of PRs as spam
- Wording in default output that accuses rather than describes

These lines exist because the failure mode of a false accusation — a burned
contributor and a public flame war — costs more than the tool saves.

## Decision making

- Routine changes: maintainer review and merge.
- Signal defaults (weights, thresholds, new signals): require an issue with
  the false-positive analysis before the PR. The maintainer decides;
  dissent is recorded in the issue.
- Scope questions: decided against the list above. Changing the scope list
  itself requires a proposal issue open for at least two weeks.

## Becoming a maintainer

Contributors with a sustained record (several merged PRs, calibration work,
issue triage) may be invited as maintainers. The invitation happens in a PR
against [MAINTAINERS.md](./MAINTAINERS.md) so the record is public. With two
or more maintainers, contested decisions move to lazy consensus with a
one-week window, falling back to a majority of maintainers.

## Changes to this document

By PR, open for comment at least two weeks unless purely editorial.
