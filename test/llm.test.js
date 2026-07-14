import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProvider, buildPrompt, parseLlmJson, runLlmReview, DEFAULT_MODELS } from '../dist/llm.js';
import { analyzePullRequest, withLlmSignal } from '../dist/index.js';

test('no keys means no provider — the tool must work without LLM access', () => {
  assert.equal(resolveProvider('auto', {}), null);
  assert.equal(resolveProvider('anthropic', {}), null);
  assert.equal(resolveProvider('openai', {}), null);
  assert.equal(resolveProvider('off', { ANTHROPIC_API_KEY: 'k' }), null);
});

test('provider resolution prefers explicit choice, then Anthropic, then OpenAI', () => {
  const both = { ANTHROPIC_API_KEY: 'a', OPENAI_API_KEY: 'o' };
  assert.equal(resolveProvider('auto', both).provider, 'anthropic');
  assert.equal(resolveProvider('openai', both).provider, 'openai');
  assert.equal(resolveProvider('auto', { OPENAI_API_KEY: 'o' }).provider, 'openai');
});

test('runLlmReview returns null (not an error) when unconfigured', async () => {
  const report = analyzePullRequest({ additions: 1, deletions: 0 }, '');
  const result = await runLlmReview({}, '', report, { preference: 'auto', env: {} });
  assert.equal(result, null);
});

test('prompt embeds signals and truncates huge diffs', () => {
  const pr = { title: 'x', body: 'y', additions: 1, deletions: 0 };
  const report = analyzePullRequest(pr, '');
  const prompt = buildPrompt(pr, 'z'.repeat(100000), report);
  assert.ok(prompt.length < 30000);
  assert.ok(prompt.includes('triage hint, NOT a verdict'));
});

test('parseLlmJson clamps concern and survives junk', () => {
  assert.deepEqual(parseLlmJson('{"concern": 1.7, "note": "hi"}'), { concern: 1, note: 'hi' });
  assert.equal(parseLlmJson('{"concern": -3, "note": "x"}').concern, 0);
  assert.equal(parseLlmJson('not json at all').concern, 0);
});

test('withLlmSignal folds the note into the score without exceeding bounds', () => {
  const report = analyzePullRequest(
    { title: 't', body: 'A sufficiently long body. Tested locally with npm test. Fixes #9.', author_association: 'MEMBER', additions: 5, deletions: 1 },
    '',
  );
  const withLlm = withLlmSignal(report, {
    provider: 'anthropic',
    model: DEFAULT_MODELS.anthropic,
    concern: 0.5,
    note: 'Worth a look at the retry logic.',
  });
  assert.ok(withLlm.signals.some((s) => s.id === 'llm-review'));
  assert.equal(withLlm.score, report.score + 5);
  assert.ok(withLlm.llm);
});

test('a mocked provider call round-trips through fetch', async () => {
  const report = analyzePullRequest({ title: 'x', additions: 1, deletions: 0 }, '');
  const fetchImpl = async (url) => {
    assert.ok(String(url).includes('api.anthropic.com'));
    return {
      ok: true,
      status: 200,
      json: async () => ({ content: [{ text: '{"concern": 0.4, "note": "check tests"}' }] }),
    };
  };
  const result = await runLlmReview({ title: 'x' }, 'diff', report, {
    preference: 'anthropic',
    env: { ANTHROPIC_API_KEY: 'test-key' },
    fetchImpl,
  });
  assert.equal(result.provider, 'anthropic');
  assert.equal(result.concern, 0.4);
  assert.equal(result.note, 'check tests');
});
