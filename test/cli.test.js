import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const fixture = (name, file) =>
  fileURLToPath(new URL(`./fixtures/${name}/${file}`, import.meta.url));

function run(args, opts = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    ...opts,
  });
}

test('json output is machine-readable and complete', () => {
  const out = execFileSync(
    process.execPath,
    [cli, '--pr', fixture('slop-mega-dump', 'pr.json'), '--diff', fixture('slop-mega-dump', 'pr.diff'), '--format', 'json'],
    { encoding: 'utf8' },
  );
  const report = JSON.parse(out);
  assert.equal(report.tool, 'slopguard');
  assert.equal(report.level, 'high');
  assert.ok(Array.isArray(report.signals) && report.signals.length > 0);
  assert.equal(report.pr.number, 512);
});

test('markdown output carries the upsert marker and the disclaimer', () => {
  const res = run(['--pr', fixture('good-focused-fix', 'pr.json'), '--diff', fixture('good-focused-fix', 'pr.diff'), '--format', 'markdown']);
  assert.equal(res.status, 0);
  assert.ok(res.stdout.includes('<!-- slopguard:report -->'));
  assert.ok(res.stdout.includes('Signals, not verdicts.'));
});

test('pretty output works without a TTY and without color', () => {
  const res = run(['--pr', fixture('slop-drive-by', 'pr.json'), '--diff', fixture('slop-drive-by', 'pr.diff'), '--no-color']);
  assert.equal(res.status, 0);
  assert.ok(res.stdout.includes('Attention score:'));
  assert.ok(!res.stdout.includes('['), 'no ANSI codes expected');
});

test('exit code is 0 by default even for high scores (signals, not gates)', () => {
  const res = run(['--pr', fixture('slop-mega-dump', 'pr.json'), '--diff', fixture('slop-mega-dump', 'pr.diff'), '--format', 'json']);
  assert.equal(res.status, 0);
});

test('--threshold makes gating opt-in via exit code 2', () => {
  const res = run(['--pr', fixture('slop-mega-dump', 'pr.json'), '--diff', fixture('slop-mega-dump', 'pr.diff'), '--threshold', '70', '--format', 'json']);
  assert.equal(res.status, 2);
  const low = run(['--pr', fixture('good-focused-fix', 'pr.json'), '--diff', fixture('good-focused-fix', 'pr.diff'), '--threshold', '70']);
  assert.equal(low.status, 0);
});

test('diff can be piped on stdin', () => {
  const res = spawnSync(
    process.execPath,
    [cli, '--pr', fixture('good-feature', 'pr.json'), '--diff', '-', '--format', 'json'],
    {
      encoding: 'utf8',
      input: '',
    },
  );
  assert.equal(res.status, 0);
  assert.equal(JSON.parse(res.stdout).pr.number, 233);
});

test('missing arguments fail with a usage error, exit 1', () => {
  const res = run([]);
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes('--pr'));
});

test('unknown flags are rejected', () => {
  const res = run(['--frobnicate']);
  assert.equal(res.status, 1);
});

test('--help and --version exit 0', () => {
  const help = run(['--help']);
  assert.equal(help.status, 0);
  assert.ok(help.stdout.includes('Usage:'));
  const version = run(['--version']);
  assert.equal(version.status, 0);
  assert.match(version.stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test('--llm auto without keys completes with a note instead of failing', () => {
  const res = run(
    ['--pr', fixture('good-feature', 'pr.json'), '--diff', fixture('good-feature', 'pr.diff'), '--llm', 'auto', '--format', 'json'],
    { env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' } },
  );
  assert.equal(res.status, 0);
  const report = JSON.parse(res.stdout);
  assert.ok(report.notes.some((n) => n.includes('llm-review skipped')));
  assert.equal(report.llm, null);
});
