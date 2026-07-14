import type { PullRequestData, Signal } from '../types.js';
import type { SlopGuardConfig } from '../config.js';
import { ramp } from '../config.js';
import { makeSignal, truncate } from '../util.js';
import type { DiffStats, SignalBatch } from './diff.js';

interface BoilerplatePattern {
  re: RegExp;
  label: string;
}

/**
 * Phrases that show up disproportionately in template-generated or
 * LLM-boilerplate PR descriptions. Each pattern alone is harmless — plenty of
 * humans write "robust" — which is why a single hit never raises the signal
 * and the signal as a whole is only one input among many.
 */
export const BOILERPLATE_PATTERNS: BoilerplatePattern[] = [
  { re: /this (pr|pull request|change|commit) (introduces|enhances|aims|provides|delivers)/i, label: '"This PR introduces/enhances…"' },
  { re: /comprehensive (suite|solution|overhaul|update|improvements?|refactor)/i, label: '"comprehensive …"' },
  { re: /\bseamless(ly)?\b/i, label: '"seamless"' },
  { re: /\brobust(ness)?\b/i, label: '"robust"' },
  { re: /\bleverag(e|es|ing)\b/i, label: '"leverage"' },
  { re: /best practices/i, label: '"best practices"' },
  { re: /maintainability and readability|readability and maintainability/i, label: '"maintainability and readability"' },
  { re: /improves? the overall/i, label: '"improves the overall …"' },
  { re: /enhanc(e|es|ing|ed) the (overall )?(user experience|codebase|functionality|reliability)/i, label: '"enhances the overall …"' },
  { re: /in (conclusion|summary),/i, label: '"In conclusion/summary,"' },
  { re: /i hope this (helps|is helpful)/i, label: '"I hope this helps"' },
  { re: /feel free to (reach out|let me know|ask)/i, label: '"feel free to reach out"' },
  { re: /let me know if (you|there)/i, label: '"let me know if…"' },
  { re: /\bas an ai\b/i, label: '"as an AI"' },
  { re: /significantly (improv|enhanc)/i, label: '"significantly improves"' },
  { re: /cutting[- ]edge/i, label: '"cutting-edge"' },
  { re: /streamlin(e|es|ed|ing)/i, label: '"streamline"' },
  { re: /production[- ]ready/i, label: '"production-ready"' },
  { re: /key (changes|improvements|highlights|features):/i, label: '"Key Changes:" scaffold' },
  { re: /across the board/i, label: '"across the board"' },
];

const EMOJI_BULLET = /^\s*[-*+]?\s*\p{Extended_Pictographic}/gmu;

const ISSUE_REFERENCE =
  /#\d+|github\.com\/[^\s)]+\/(issues|pull)\/\d+/i;

const VERIFICATION_HINT =
  /\btest(s|ed|ing)?\b|\bverif(y|ied|ication)\b|\breproduc(e|ed|es|ing|tion)\b|\bnpm (test|run)\b|\bpytest\b|\bgo test\b|\bcargo test\b|\bmake check\b|\bscreenshots?\b|\bbefore\/after\b|\bmanual(ly)? (check|confirm)/i;

export function countBoilerplateHits(body: string, title: string): string[] {
  const matched: string[] = [];
  for (const p of BOILERPLATE_PATTERNS) {
    if (p.re.test(body) || p.re.test(title)) matched.push(p.label);
  }
  const emojiBullets = body.match(EMOJI_BULLET)?.length ?? 0;
  if (emojiBullets >= 3) matched.push(`emoji-decorated bullet list (${emojiBullets} lines)`);
  return matched;
}

export function collectBodySignals(
  pr: PullRequestData,
  stats: DiffStats,
  cfg: SlopGuardConfig,
): SignalBatch {
  const t = cfg.thresholds;
  const w = cfg.weights;
  const signals: Signal[] = [];
  const notes: string[] = [];

  const bodyRaw = pr.body ?? '';
  const body = bodyRaw.trim();
  const title = pr.title ?? '';

  // --- sparse-body ------------------------------------------------------------
  if (body.length < t.sparseBodyMaxChars) {
    const intensity = ramp(stats.totalLines, t.sparseBodyLinesLow, t.sparseBodyLinesHigh);
    if (intensity > 0) {
      signals.push(
        makeSignal(
          'sparse-body',
          'body',
          w['sparse-body'] ?? 0,
          intensity,
          body.length === 0
            ? `Empty PR description for a ${stats.totalLines.toLocaleString('en-US')}-line change`
            : `Nearly empty PR description ("${truncate(body, 40)}") for a ` +
              `${stats.totalLines.toLocaleString('en-US')}-line change`,
          'Without context, every reviewer has to reconstruct intent from the diff itself.',
        ),
      );
    }
    notes.push(
      'missing-issue-reference / missing-verification-steps: skipped (description too short to evaluate)',
    );
    return { signals, notes };
  }

  // --- boilerplate-body ---------------------------------------------------------
  const matched = countBoilerplateHits(body, title);
  const intensity = ramp(matched.length, t.boilerplateHitsLow, t.boilerplateHitsHigh);
  if (intensity > 0) {
    signals.push(
      makeSignal(
        'boilerplate-body',
        'body',
        w['boilerplate-body'] ?? 0,
        intensity,
        `Description matches ${matched.length} common template/boilerplate patterns`,
        `Matched: ${matched.join('; ')}. These phrasings are common in generated text; ` +
          'they say nothing definitive on their own.',
      ),
    );
  }

  // --- missing-issue-reference ---------------------------------------------------
  if (!ISSUE_REFERENCE.test(body) && !ISSUE_REFERENCE.test(title)) {
    signals.push(
      makeSignal(
        'missing-issue-reference',
        'body',
        w['missing-issue-reference'] ?? 0,
        1,
        'No linked issue, discussion, or PR reference found',
        'Not every repository requires linked issues — treat this as context. ' +
          'Unsolicited large changes without prior discussion cost the most review time.',
      ),
    );
  }

  // --- missing-verification-steps --------------------------------------------------
  if (stats.codeAdditions >= t.verificationMinCodeAdditions) {
    const hasVerification = bodyRaw.includes('```') || VERIFICATION_HINT.test(body);
    if (!hasVerification) {
      signals.push(
        makeSignal(
          'missing-verification-steps',
          'body',
          w['missing-verification-steps'] ?? 0,
          1,
          'No testing or verification notes found in the description',
          'A one-line "how I checked this" from the author often saves a full review round-trip. ' +
            'Note: the check is keyword-based, so an unsubstantiated "fully tested" also passes it.',
        ),
      );
    }
  } else {
    notes.push('missing-verification-steps: skipped (change too small to expect verification notes)');
  }

  return { signals, notes };
}
