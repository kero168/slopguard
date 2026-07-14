#!/usr/bin/env node
/**
 * slopguard CLI.
 *
 * Input is the PR JSON and unified diff you already get from the GitHub CLI:
 *
 *   gh api repos/OWNER/REPO/pulls/123 > pr.json
 *   gh api -H "Accept: application/vnd.github.diff" repos/OWNER/REPO/pulls/123 > pr.diff
 *   slopguard --pr pr.json --diff pr.diff
 */
import { readFileSync } from 'node:fs';
import { analyzePullRequest, withLlmSignal } from './analyze.js';
import type { PartialConfig } from './config.js';
import { runLlmReview, type ProviderPreference } from './llm.js';
import { renderMarkdown } from './report/markdown.js';
import { renderPretty } from './report/pretty.js';
import type { PullRequestData, Report } from './types.js';
import { toolVersion } from './version.js';

const FORMATS = new Set(['pretty', 'json', 'markdown']);
const LLM_MODES = new Set(['off', 'auto', 'anthropic', 'openai']);

const HELP = `slopguard — review-effort signals for pull requests (signals, not verdicts)

Usage:
  slopguard --pr <pr.json> --diff <pr.diff> [options]

Inputs:
  --pr <file>        PR JSON from \`gh api repos/{owner}/{repo}/pulls/{n}\`.
                     Use "-" to read from stdin. A full webhook event payload
                     ({"pull_request": {...}}) is also accepted.
  --diff <file>      Unified diff, e.g.
                     \`gh api -H "Accept: application/vnd.github.diff" repos/{owner}/{repo}/pulls/{n}\`.
                     Use "-" to read from stdin (only one input may be "-").

Options:
  --format <f>       Output format: pretty | json | markdown  (default: pretty)
  --config <file>    JSON file overriding weights/thresholds/levels.
  --llm <mode>       Opt-in LLM second opinion: off | auto | anthropic | openai
                     (default: off). Uses ANTHROPIC_API_KEY / OPENAI_API_KEY.
                     slopguard is fully functional without this.
  --llm-model <m>    Override the model id for the chosen provider.
  --threshold <n>    Exit with code 2 when the score is >= n. Opt-in gating —
                     see docs/faq.md for why we discourage using it to block PRs.
  --no-color         Disable ANSI colors in pretty output.
  -h, --help         Show this help.
  -V, --version      Show the version.

Exit codes:
  0  analysis completed
  1  usage or input error
  2  --threshold was set and the score reached it

Examples:
  gh api repos/acme/widgets/pulls/482 > pr.json
  gh api -H "Accept: application/vnd.github.diff" repos/acme/widgets/pulls/482 > pr.diff
  slopguard --pr pr.json --diff pr.diff
  slopguard --pr pr.json --diff pr.diff --format markdown > comment.md
  slopguard --pr pr.json --diff pr.diff --format json | jq .score
`;

class UsageError extends Error {}

interface CliOptions {
  pr?: string;
  diff?: string;
  format: string;
  config?: string;
  llm: string;
  llmModel?: string;
  threshold?: number;
  color: boolean;
  help: boolean;
  version: boolean;
}

export function parseArgs(argv: string[]): CliOptions {
  // Normalize --key=value into --key value.
  const args: string[] = [];
  for (const a of argv) {
    const m = /^(--[\w-]+)=(.*)$/.exec(a);
    if (m) args.push(m[1], m[2]);
    else args.push(a);
  }

  const opts: CliOptions = { format: 'pretty', llm: 'off', color: true, help: false, version: false };
  const next = (i: number, flag: string): string => {
    const v = args[i + 1];
    if (v === undefined) throw new UsageError(`${flag} requires a value`);
    return v;
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case '--pr':
        opts.pr = next(i, arg);
        i += 1;
        break;
      case '--diff':
        opts.diff = next(i, arg);
        i += 1;
        break;
      case '--format':
        opts.format = next(i, arg);
        i += 1;
        break;
      case '--config':
        opts.config = next(i, arg);
        i += 1;
        break;
      case '--llm':
        opts.llm = next(i, arg);
        i += 1;
        break;
      case '--llm-model':
        opts.llmModel = next(i, arg);
        i += 1;
        break;
      case '--threshold': {
        const raw = next(i, arg);
        const n = Number.parseInt(raw, 10);
        if (Number.isNaN(n) || n < 0 || n > 100) {
          throw new UsageError(`--threshold must be an integer between 0 and 100, got "${raw}"`);
        }
        opts.threshold = n;
        i += 1;
        break;
      }
      case '--no-color':
        opts.color = false;
        break;
      case '-h':
      case '--help':
        opts.help = true;
        break;
      case '-V':
      case '--version':
        opts.version = true;
        break;
      default:
        throw new UsageError(`unknown argument "${arg}" (see --help)`);
    }
  }
  return opts;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk as Buffer));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readInput(pathOrDash: string, label: string): Promise<string> {
  if (pathOrDash === '-') return readStdin();
  try {
    return readFileSync(pathOrDash, 'utf8');
  } catch (err) {
    throw new UsageError(`could not read ${label} file "${pathOrDash}": ${(err as Error).message}`);
  }
}

function parsePrJson(raw: string): PullRequestData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new UsageError(`--pr input is not valid JSON: ${(err as Error).message}`);
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new UsageError('--pr input must be a JSON object');
  }
  const obj = parsed as Record<string, unknown>;
  // Accept a full webhook event payload and unwrap it.
  if (obj.pull_request && typeof obj.pull_request === 'object') {
    return obj.pull_request as PullRequestData;
  }
  return obj as PullRequestData;
}

function loadConfig(path?: string): PartialConfig | undefined {
  if (!path) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as PartialConfig;
  } catch (err) {
    throw new UsageError(`could not load config "${path}": ${(err as Error).message}`);
  }
}

async function main(argv: string[]): Promise<number> {
  const opts = parseArgs(argv);

  if (opts.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (opts.version) {
    process.stdout.write(`${toolVersion()}\n`);
    return 0;
  }
  if (!opts.pr || !opts.diff) {
    throw new UsageError('both --pr and --diff are required (see --help)');
  }
  if (opts.pr === '-' && opts.diff === '-') {
    throw new UsageError('only one of --pr / --diff may read from stdin');
  }
  if (!FORMATS.has(opts.format)) {
    throw new UsageError(`--format must be one of: ${[...FORMATS].join(', ')}`);
  }
  if (!LLM_MODES.has(opts.llm)) {
    throw new UsageError(`--llm must be one of: ${[...LLM_MODES].join(', ')}`);
  }

  const pr = parsePrJson(await readInput(opts.pr, 'PR JSON'));
  const diffText = await readInput(opts.diff, 'diff');
  const config = loadConfig(opts.config);

  let report: Report = analyzePullRequest(pr, diffText, config);

  if (opts.llm !== 'off') {
    try {
      const note = await runLlmReview(pr, diffText, report, {
        preference: opts.llm as ProviderPreference,
        model: opts.llmModel,
      });
      if (note) {
        report = withLlmSignal(report, note, config);
      } else {
        report.notes.push(
          'llm-review skipped: no API key found (set ANTHROPIC_API_KEY or OPENAI_API_KEY); ' +
            'heuristic analysis is complete without it',
        );
      }
    } catch (err) {
      report.notes.push(`llm-review skipped: ${(err as Error).message}`);
    }
  }

  let output: string;
  if (opts.format === 'json') {
    output = JSON.stringify(report, null, 2);
  } else if (opts.format === 'markdown') {
    output = renderMarkdown(report);
  } else {
    const useColor = opts.color && process.stdout.isTTY === true && !process.env.NO_COLOR;
    output = renderPretty(report, { color: useColor });
  }
  process.stdout.write(`${output}\n`);

  if (opts.threshold !== undefined && report.score >= opts.threshold) {
    process.stderr.write(
      `slopguard: score ${report.score} >= threshold ${opts.threshold} (exit 2)\n`,
    );
    return 2;
  }
  return 0;
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`slopguard: ${message}\n`);
    process.exitCode = 1;
  });
