import type { PullRequestData, Signal } from '../types.js';
import type { SlopGuardConfig } from '../config.js';
import { ramp } from '../config.js';
import { makeSignal } from '../util.js';
import type { DiffStats, SignalBatch } from './diff.js';

const FIRST_TIME_ASSOCIATIONS = new Set(['FIRST_TIME_CONTRIBUTOR', 'FIRST_TIMER', 'NONE']);

/**
 * Contributor-context signals. These are the easiest signals to get wrong in
 * a hurtful way, so they are deliberately conservative: being new is never a
 * signal by itself — only the *combination* of "first interaction with this
 * repository" and "very large change" is surfaced, and the wording frames it
 * as a sequencing question ("talk about scope early"), not a character check.
 */
export function collectContributorSignals(
  pr: PullRequestData,
  stats: DiffStats,
  cfg: SlopGuardConfig,
): SignalBatch {
  const t = cfg.thresholds;
  const w = cfg.weights;
  const signals: Signal[] = [];
  const notes: string[] = [];

  const login = pr.user?.login ?? '';
  if (pr.user?.type === 'Bot' || login.endsWith('[bot]')) {
    notes.push(`contributor signals skipped: author "${login}" appears to be a bot`);
    return { signals, notes };
  }

  const association = pr.author_association;
  if (!association) {
    notes.push('contributor signals skipped: author_association missing from PR JSON');
    return { signals, notes };
  }

  if (FIRST_TIME_ASSOCIATIONS.has(association)) {
    const intensity = ramp(stats.totalLines, t.firstTimeLinesLow, t.firstTimeLinesHigh);
    if (intensity > 0) {
      signals.push(
        makeSignal(
          'first-contribution-large-change',
          'contributor',
          w['first-contribution-large-change'] ?? 0,
          intensity,
          `First interaction with this repository (${association}) combined with a ` +
            `${stats.totalLines.toLocaleString('en-US')}-line change`,
          'Large first PRs benefit from an early scope conversation. This is about ' +
            'sequencing the review, not doubting the contributor — new contributors ' +
            'deserve fast, kind feedback.',
        ),
      );
    } else {
      notes.push(
        'first-contribution-large-change: not raised (first-time contributor, but the change is small)',
      );
    }
  }

  return { signals, notes };
}
