# Contributing to slopguard

Thanks for your interest. This project practices what it preaches: small,
explained, verified changes are easy to review and quick to merge.

## Ground rules

- **Discuss before building anything large.** Open an issue first for new
  signals, new integrations, or behavior changes. A 10-line issue can save a
  1,000-line PR.
- **AI assistance is welcome; unreviewed output is not.** If you used a tool
  to help write your change, read and verify every line before submitting —
  the PR template asks you to confirm this.
- **Every behavior change needs a test.** The fixture suite is the project's
  memory of what "good" and "slop-shaped" look like.
- Be kind. See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## Dev setup

```console
$ git clone https://github.com/kero168/slopguard.git
$ cd slopguard
$ npm ci
$ npm test        # builds (tsc) and runs node:test
```

There are no runtime dependencies; dev dependencies are TypeScript and
`@types/node` only. Please keep it that way unless an issue agrees otherwise.

Useful loops:

```console
$ npm run build && node dist/cli.js \
    --pr test/fixtures/slop-mega-dump/pr.json \
    --diff test/fixtures/slop-mega-dump/pr.diff
```

## Repository layout

See [ARCHITECTURE.md](./ARCHITECTURE.md). Quick map:

```
src/
  analyze.ts        orchestrates: parse -> stats -> signals -> score
  diff.ts           unified diff parser (dependency-free, tolerant)
  signals/          one module per signal group (diff, body, contributor)
  config.ts         weights, thresholds, level bounds, merging
  llm.ts            opt-in LLM second opinion (plain fetch)
  report/           pretty / markdown renderers
  cli.ts            argument parsing and IO
test/
  fixtures/         2 well-formed + 3 slop-shaped PR fixtures (JSON + diff)
```

## Adding or tuning a signal

1. Open an issue describing the maintainer problem and the false-positive
   story: *who gets hurt if this misfires, and how does the wording avoid it?*
   Signals that judge people rather than review effort are rejected —
   see [GOVERNANCE.md](./GOVERNANCE.md#scope).
2. Add the heuristic in the right `src/signals/*.ts` module. Give it:
   - a stable kebab-case id,
   - a weight in `DEFAULT_CONFIG.weights` (look at neighbors for scale),
   - a graduated intensity (use `ramp`) instead of a binary cliff when possible,
   - a `summary` a contributor can read about their own PR without feeling
     accused, and a `details` string that admits its own limits.
3. Add fixture coverage: extend an existing fixture or add a new directory
   under `test/fixtures/` with `pr.json` + `pr.diff`.
4. Update `docs/signals.md` (the table is the contract) and, if user-visible,
   the READMEs and `CHANGELOG.md` under `[Unreleased]`.

## Pull request checklist

- `npm test` passes (CI runs Node 20 and 22)
- New behavior has fixture or unit coverage
- Docs updated (`docs/signals.md` for signal changes)
- Commit messages say *why*, not just *what*

## Releases (maintainers)

1. Update `package.json` version and `CHANGELOG.md`.
2. Tag `vX.Y.Z` and push the tag; `release.yml` runs tests and publishes to
   npm via OIDC trusted publishing with provenance.
3. Move the major tag (e.g. `v0`) if applicable.
