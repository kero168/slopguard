import type { LlmNote, PullRequestData, Report } from './types.js';
import { clamp01, truncate } from './util.js';

/**
 * Optional LLM second opinion. This module is strictly opt-in:
 *
 *  - Nothing here runs unless the caller passes `--llm` / `llm` explicitly.
 *  - SlopGuard is fully functional without any API key.
 *  - Providers are called with plain `fetch` — no SDK dependencies.
 *  - Failures degrade to a note in the report; they never fail the analysis.
 */

export type ProviderPreference = 'auto' | 'anthropic' | 'openai' | 'off';

export interface ResolvedProvider {
  provider: 'anthropic' | 'openai';
  apiKey: string;
}

export const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-5',
  openai: 'gpt-4o-mini',
} as const;

export function resolveProvider(
  preference: ProviderPreference,
  env: Record<string, string | undefined> = process.env,
): ResolvedProvider | null {
  if (preference === 'off') return null;
  const anthropicKey = env.ANTHROPIC_API_KEY;
  const openaiKey = env.OPENAI_API_KEY;
  if (preference === 'anthropic') {
    return anthropicKey ? { provider: 'anthropic', apiKey: anthropicKey } : null;
  }
  if (preference === 'openai') {
    return openaiKey ? { provider: 'openai', apiKey: openaiKey } : null;
  }
  if (anthropicKey) return { provider: 'anthropic', apiKey: anthropicKey };
  if (openaiKey) return { provider: 'openai', apiKey: openaiKey };
  return null;
}

export function buildPrompt(pr: PullRequestData, diffText: string, report: Report): string {
  const heuristics = report.signals
    .map((s) => `- ${s.id} (${s.points} pts): ${s.summary}`)
    .join('\n');
  return [
    'You are helping a repository maintainer decide how much review attention a pull request needs.',
    'You are producing a triage hint, NOT a verdict. Never claim certainty about whether the change',
    'was AI-generated, and never recommend rejecting a contribution outright.',
    '',
    'Heuristic signals already computed:',
    heuristics || '- (none raised)',
    '',
    `PR title: ${pr.title ?? '(none)'}`,
    'PR description:',
    truncate((pr.body ?? '').trim() || '(empty)', 4000),
    '',
    'Diff (may be truncated):',
    truncate(diffText, 20000),
    '',
    'Respond with strict JSON only, no code fences:',
    '{"concern": <number between 0 and 1>, "note": "<2-3 sentences a maintainer can act on>"}',
  ].join('\n');
}

export function parseLlmJson(text: string): { concern: number; note: string } {
  const match = /\{[\s\S]*\}/.exec(text);
  if (match) {
    try {
      const obj = JSON.parse(match[0]) as { concern?: unknown; note?: unknown };
      return {
        concern: clamp01(Number(obj.concern)),
        note: String(obj.note ?? '').trim() || truncate(text.trim(), 500),
      };
    } catch {
      // fall through to raw text
    }
  }
  return { concern: 0, note: truncate(text.trim(), 500) };
}

export interface LlmRunOptions {
  preference: ProviderPreference;
  model?: string;
  timeoutMs?: number;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}

async function callAnthropic(
  apiKey: string,
  model: string,
  prompt: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<string> {
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Anthropic API error: HTTP ${res.status}`);
  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Anthropic API returned no text content');
  return text;
}

async function callOpenAi(
  apiKey: string,
  model: string,
  prompt: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<string> {
  const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  });
  if (!res.ok) throw new Error(`OpenAI API error: HTTP ${res.status}`);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenAI API returned no text content');
  return text;
}

/**
 * Runs the opt-in LLM review. Returns `null` when no provider/key is
 * available; throws on API errors (callers turn that into a report note).
 */
export async function runLlmReview(
  pr: PullRequestData,
  diffText: string,
  report: Report,
  opts: LlmRunOptions,
): Promise<LlmNote | null> {
  const resolved = resolveProvider(opts.preference, opts.env ?? process.env);
  if (!resolved) return null;

  const model = opts.model ?? DEFAULT_MODELS[resolved.provider];
  const prompt = buildPrompt(pr, diffText, report);
  const fetchImpl = opts.fetchImpl ?? fetch;
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 30_000);

  const text =
    resolved.provider === 'anthropic'
      ? await callAnthropic(resolved.apiKey, model, prompt, fetchImpl, signal)
      : await callOpenAi(resolved.apiKey, model, prompt, fetchImpl, signal);

  const parsed = parseLlmJson(text);
  return {
    provider: resolved.provider,
    model,
    concern: parsed.concern,
    note: parsed.note,
  };
}
