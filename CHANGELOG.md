# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [0.1.0] - 2026-07-14

Initial release.

### Added

- Core analyzer: weighted, explained signals over PR JSON + unified diff
  - Diff signals: `oversized-diff`, `generated-code-ratio`, `missing-tests`,
    `unrelated-files`
  - Body signals: `boilerplate-body`, `missing-issue-reference`,
    `missing-verification-steps`, `sparse-body`
  - Contributor signals: `first-contribution-large-change` (combination only;
    bots and missing metadata degrade to notes)
- CLI (`slopguard`) with `pretty`, `json`, and `markdown` output, stdin
  support, config file overrides, and opt-in `--threshold` gating (exit 2)
- Composite GitHub Action (`action.yml`) with `dry-run` defaulting to `true`,
  step-summary report, and comment upsert via a hidden marker
- Opt-in LLM second opinion (`--llm`) for Anthropic / OpenAI via plain `fetch`;
  fully functional without any API key
- Fixture-based test suite (2 well-formed PRs, 3 slop-shaped PRs) on
  `node:test`

[Unreleased]: https://github.com/kero168/slopguard/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/kero168/slopguard/releases/tag/v0.1.0
