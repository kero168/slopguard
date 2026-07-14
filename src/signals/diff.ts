import type { ParsedDiff, PullRequestData, Signal } from '../types.js';
import type { SlopGuardConfig } from '../config.js';
import { ramp } from '../config.js';
import { makeSignal } from '../util.js';
import {
  isCodePath,
  isLockfilePath,
  isTestPath,
  isVendoredPath,
  topLevelSegment,
} from '../paths.js';

export interface SignalBatch {
  signals: Signal[];
  notes: string[];
}

/** Aggregate numbers shared across signal collectors. */
export interface DiffStats {
  additions: number;
  deletions: number;
  totalLines: number;
  changedFiles: number;
  /** Added lines in non-test, non-vendored code files (from the parsed diff). */
  codeAdditions: number;
  touchesTests: boolean;
}

/**
 * PR-level line counts prefer the GitHub API numbers (`additions`,
 * `deletions`, `changed_files`) because GitHub truncates large diffs;
 * composition ratios necessarily come from the parsed diff itself.
 */
export function computeDiffStats(pr: PullRequestData, diff: ParsedDiff): DiffStats {
  const additions = pr.additions ?? diff.totalAdditions;
  const deletions = pr.deletions ?? diff.totalDeletions;
  const codeAdditions = diff.files
    .filter((f) => !f.binary && isCodePath(f.path) && !isTestPath(f.path))
    .reduce((n, f) => n + f.additions, 0);
  return {
    additions,
    deletions,
    totalLines: additions + deletions,
    changedFiles: pr.changed_files ?? diff.files.length,
    codeAdditions,
    touchesTests: diff.files.some((f) => isTestPath(f.path)),
  };
}

export function collectDiffSignals(
  pr: PullRequestData,
  diff: ParsedDiff,
  stats: DiffStats,
  cfg: SlopGuardConfig,
): SignalBatch {
  const t = cfg.thresholds;
  const w = cfg.weights;
  const signals: Signal[] = [];
  const notes: string[] = [];

  // --- oversized-diff -------------------------------------------------------
  const oversized = ramp(stats.totalLines, t.oversizedLinesLow, t.oversizedLinesHigh);
  if (oversized > 0) {
    signals.push(
      makeSignal(
        'oversized-diff',
        'diff',
        w['oversized-diff'] ?? 0,
        oversized,
        `${stats.totalLines.toLocaleString('en-US')} changed lines across ` +
          `${stats.changedFiles} files in a single PR`,
        'Very large single-batch diffs are hard to review line by line. ' +
          'Consider asking the author to split the change into reviewable steps.',
      ),
    );
  }

  // --- generated-code-ratio -------------------------------------------------
  if (diff.totalAdditions >= t.generatedMinAddedLines) {
    let generatedAdded = 0;
    const generatedPaths: string[] = [];
    for (const f of diff.files) {
      if (f.binary || f.additions === 0) continue;
      const looksGenerated =
        isLockfilePath(f.path) ||
        isVendoredPath(f.path) ||
        f.generatedMarker ||
        f.maxAddedLineLength > t.minifiedLineLength;
      if (looksGenerated) {
        generatedAdded += f.additions;
        generatedPaths.push(f.path);
      }
    }
    const ratio = generatedAdded / diff.totalAdditions;
    const intensity = ramp(ratio, t.generatedRatioLow, t.generatedRatioHigh);
    if (intensity > 0) {
      const shown = generatedPaths.slice(0, 8).join(', ');
      const more = generatedPaths.length > 8 ? `, +${generatedPaths.length - 8} more` : '';
      signals.push(
        makeSignal(
          'generated-code-ratio',
          'diff',
          w['generated-code-ratio'] ?? 0,
          intensity,
          `${Math.round(ratio * 100)}% of added lines are in lockfiles, bundles, ` +
            'minified output, or files tagged as generated',
          `Files counted as generated/vendored: ${shown}${more}. ` +
            'Regenerated artifacts inflate diffs and drown the hand-written part of the change.',
        ),
      );
    }
  } else {
    notes.push(
      `generated-code-ratio: skipped (diff has fewer than ${t.generatedMinAddedLines} added lines)`,
    );
  }

  // --- missing-tests ----------------------------------------------------------
  if (stats.touchesTests) {
    notes.push('missing-tests: not raised (the PR touches test files)');
  } else if (stats.codeAdditions >= t.missingTestsMinCodeAdditions) {
    const intensity =
      0.2 +
      0.8 * ramp(stats.codeAdditions, t.missingTestsMinCodeAdditions, t.missingTestsHighCodeAdditions);
    signals.push(
      makeSignal(
        'missing-tests',
        'diff',
        w['missing-tests'] ?? 0,
        intensity,
        `${stats.codeAdditions} added lines of code without any test changes`,
        'Some repositories keep tests elsewhere and some changes genuinely need none — ' +
          'treat this as a prompt to ask, not a rule violation.',
      ),
    );
  }

  // --- unrelated-files --------------------------------------------------------
  if (diff.files.length >= t.unrelatedMinFiles) {
    const dirs = new Set(diff.files.map((f) => topLevelSegment(f.path)));
    const intensity = ramp(dirs.size, t.unrelatedDirsLow, t.unrelatedDirsHigh);
    if (intensity > 0) {
      signals.push(
        makeSignal(
          'unrelated-files',
          'diff',
          w['unrelated-files'] ?? 0,
          intensity,
          `Touches ${dirs.size} distinct top-level areas ` +
            `(${[...dirs].slice(0, 8).join(', ')})`,
          'Wide, mixed-concern changes are a common shape for bulk-generated PRs — ' +
            'and also for legitimate refactors. Check whether the stated goal matches the spread.',
        ),
      );
    }
  }

  return { signals, notes };
}
