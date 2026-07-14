# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | yes |
| < 0.1 | no |

## Reporting a vulnerability

Please use **GitHub private vulnerability reporting**:
[Report a vulnerability](https://github.com/kero168/slopguard/security/advisories/new).
Do not open a public issue for security problems.

This is a volunteer-maintained project. The goal (not a guarantee) is to
acknowledge reports within 7 days and to ship a fix or public advisory within
90 days, with credit to the reporter unless anonymity is requested.

## Scope notes for reporters

Things that are particularly interesting here:

- **Diff/JSON parsing**: slopguard parses attacker-controlled input by design
  (PR bodies and diffs). Crashes, pathological slowdowns (ReDoS), or signal
  evasion tricks in `src/diff.ts` and `src/signals/*` are in scope.
  Signal evasion is a tuning issue, not a vulnerability, unless it involves
  memory unsafety or code execution.
- **The GitHub Action**: `action.yml` runs in workflows with a token.
  Anything that lets PR content escalate to token misuse (e.g. injection via
  crafted PR titles/bodies into the shell steps) is high priority.
- **LLM calls**: `src/llm.ts` sends data only to the configured provider and
  only when explicitly enabled. Key leakage or requests to unexpected hosts
  would be vulnerabilities.

Known design decisions (not vulnerabilities):

- The Action posts PR content to the job log and step summary.
- `--llm` sends (truncated) diff and description to a third-party API —
  documented in docs/llm.md.
