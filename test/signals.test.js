import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ramp, levelForScore, mergeConfig, DEFAULT_CONFIG } from '../dist/config.js';
import { countBoilerplateHits } from '../dist/signals/body.js';
import { isCodePath, isLockfilePath, isTestPath, isVendoredPath, topLevelSegment } from '../dist/paths.js';
import { analyzePullRequest } from '../dist/index.js';

test('ramp is clamped and linear', () => {
  assert.equal(ramp(0, 100, 200), 0);
  assert.equal(ramp(100, 100, 200), 0);
  assert.equal(ramp(150, 100, 200), 0.5);
  assert.equal(ramp(200, 100, 200), 1);
  assert.equal(ramp(9999, 100, 200), 1);
});

test('levelForScore uses configured bounds', () => {
  const levels = DEFAULT_CONFIG.levels;
  assert.equal(levelForScore(0, levels), 'low');
  assert.equal(levelForScore(19, levels), 'low');
  assert.equal(levelForScore(20, levels), 'moderate');
  assert.equal(levelForScore(44, levels), 'moderate');
  assert.equal(levelForScore(45, levels), 'elevated');
  assert.equal(levelForScore(70, levels), 'high');
  assert.equal(levelForScore(100, levels), 'high');
});

test('mergeConfig overlays partial weights without dropping defaults', () => {
  const cfg = mergeConfig({ weights: { 'boilerplate-body': 5 } });
  assert.equal(cfg.weights['boilerplate-body'], 5);
  assert.equal(cfg.weights['oversized-diff'], DEFAULT_CONFIG.weights['oversized-diff']);
  assert.equal(cfg.thresholds.oversizedLinesLow, DEFAULT_CONFIG.thresholds.oversizedLinesLow);
});

test('boilerplate detection needs more than one hit to matter', () => {
  const single = countBoilerplateHits('This adds a robust retry helper.', 'Add retry helper');
  assert.equal(single.length, 1);
  // One hit stays below the signal threshold by design (see thresholds.boilerplateHitsLow).
  const many = countBoilerplateHits(
    'This PR introduces a comprehensive overhaul, leveraging best practices for a seamless, production-ready experience.',
    'Improve everything',
  );
  assert.ok(many.length >= 5, `expected >=5 hits, got ${many.length}: ${many.join('; ')}`);
});

test('a natural human PR body produces no boilerplate hits', () => {
  const body = [
    'The date filter dropped the last day of the range.',
    'Fixes #142. Added a regression case that fails on main.',
    'Checked against the report from the issue before and after.',
  ].join('\n');
  assert.deepEqual(countBoilerplateHits(body, 'Fix date range'), []);
});

test('path classification', () => {
  assert.equal(isLockfilePath('package-lock.json'), true);
  assert.equal(isLockfilePath('backend/Cargo.lock'), true);
  assert.equal(isLockfilePath('src/locks.ts'), false);
  assert.equal(isVendoredPath('dist/bundle.min.js'), true);
  assert.equal(isVendoredPath('vendor/lib/x.go'), true);
  assert.equal(isVendoredPath('src/distance.ts'), false);
  assert.equal(isTestPath('test/foo.test.js'), true);
  assert.equal(isTestPath('pkg/store/store_test.go'), true);
  assert.equal(isTestPath('src/latest.js'), false);
  assert.equal(isCodePath('src/app.ts'), true);
  assert.equal(isCodePath('README.md'), false);
  assert.equal(isCodePath('dist/app.js'), false);
  assert.equal(topLevelSegment('src/a/b.ts'), 'src');
  assert.equal(topLevelSegment('Makefile'), '(root)');
});

test('bot authors skip contributor signals with a note', () => {
  const pr = {
    number: 1,
    title: 'chore(deps): bump lodash',
    body: 'Automated dependency update.',
    user: { login: 'dependabot[bot]', type: 'Bot' },
    author_association: 'NONE',
    additions: 2000,
    deletions: 2000,
    changed_files: 1,
  };
  const report = analyzePullRequest(pr, '');
  assert.ok(!report.signals.some((s) => s.id === 'first-contribution-large-change'));
  assert.ok(report.notes.some((n) => n.includes('bot')));
});

test('missing author_association degrades to a note, not a crash', () => {
  const report = analyzePullRequest({ additions: 10, deletions: 0 }, '');
  assert.ok(report.notes.some((n) => n.includes('author_association')));
});

test('custom weights change the score', () => {
  const pr = {
    title: 'big change',
    body: 'A long description with enough characters to not be sparse, explaining things. Tested with npm test. Fixes #1.',
    author_association: 'MEMBER',
    additions: 4000,
    deletions: 1000,
    changed_files: 3,
  };
  const base = analyzePullRequest(pr, '');
  const boosted = analyzePullRequest(pr, '', { weights: { 'oversized-diff': 40 } });
  assert.ok(boosted.score > base.score);
});
