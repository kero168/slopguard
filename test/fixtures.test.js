import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzePullRequest } from '../dist/index.js';

function loadFixture(name) {
  const base = new URL(`./fixtures/${name}/`, import.meta.url);
  const pr = JSON.parse(readFileSync(new URL('pr.json', base), 'utf8'));
  const diff = readFileSync(new URL('pr.diff', base), 'utf8');
  return analyzePullRequest(pr, diff);
}

const ids = (report) => report.signals.map((s) => s.id);

test('good-focused-fix: small linked bugfix with tests raises nothing', () => {
  const report = loadFixture('good-focused-fix');
  assert.equal(report.level, 'low');
  assert.ok(report.score < 10, `expected score < 10, got ${report.score}`);
  assert.deepEqual(ids(report), []);
});

test('good-feature: well-described feature with tests stays low', () => {
  const report = loadFixture('good-feature');
  assert.equal(report.level, 'low');
  assert.ok(report.score < 20, `expected score < 20, got ${report.score}`);
  assert.ok(!ids(report).includes('boilerplate-body'));
  assert.ok(!ids(report).includes('missing-tests'));
});

test('slop-mega-dump: huge generated dump from a first-time account scores high', () => {
  const report = loadFixture('slop-mega-dump');
  assert.equal(report.level, 'high');
  assert.ok(report.score >= 70, `expected score >= 70, got ${report.score}`);
  for (const expected of [
    'oversized-diff',
    'generated-code-ratio',
    'boilerplate-body',
    'missing-issue-reference',
    'missing-verification-steps',
    'first-contribution-large-change',
    'missing-tests',
  ]) {
    assert.ok(ids(report).includes(expected), `missing signal ${expected}`);
  }
});

test('slop-boilerplate-body: templated body without tests is moderate, not high', () => {
  const report = loadFixture('slop-boilerplate-body');
  assert.ok(report.score >= 25 && report.score <= 60, `got ${report.score}`);
  assert.ok(['moderate', 'elevated'].includes(report.level), `got ${report.level}`);
  assert.ok(ids(report).includes('boilerplate-body'));
  assert.ok(ids(report).includes('missing-verification-steps'));
  // A known contributor: the first-time combination signal must NOT fire.
  assert.ok(!ids(report).includes('first-contribution-large-change'));
});

test('slop-drive-by: wide, sparse first PR lands at elevated', () => {
  const report = loadFixture('slop-drive-by');
  assert.ok(report.score >= 45, `expected score >= 45, got ${report.score}`);
  assert.ok(['elevated', 'high'].includes(report.level), `got ${report.level}`);
  for (const expected of ['sparse-body', 'first-contribution-large-change', 'unrelated-files', 'missing-tests']) {
    assert.ok(ids(report).includes(expected), `missing signal ${expected}`);
  }
  // Sparse bodies skip the body sub-checks instead of double-counting them.
  assert.ok(!ids(report).includes('missing-issue-reference'));
});

test('signals are sorted by points, descending', () => {
  const report = loadFixture('slop-mega-dump');
  const points = report.signals.map((s) => s.points);
  const sorted = [...points].sort((a, b) => b - a);
  assert.deepEqual(points, sorted);
});

test('reports carry the disclaimer plumbing (score bounded, notes array)', () => {
  for (const name of ['good-focused-fix', 'slop-mega-dump']) {
    const report = loadFixture(name);
    assert.ok(report.score >= 0 && report.score <= 100);
    assert.ok(Array.isArray(report.notes));
    assert.equal(report.tool, 'slopguard');
  }
});
