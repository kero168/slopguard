import type { AttentionLevel } from './types.js';

export interface Thresholds {
  /** Total changed lines where `oversized-diff` starts / saturates. */
  oversizedLinesLow: number;
  oversizedLinesHigh: number;
  /** Share of added lines that look generated where the signal starts / saturates. */
  generatedRatioLow: number;
  generatedRatioHigh: number;
  /** Skip the generated-ratio signal for diffs smaller than this many added lines. */
  generatedMinAddedLines: number;
  /** An added line longer than this marks the file as minified/bundled-looking. */
  minifiedLineLength: number;
  /** Added lines of non-test code below which `missing-tests` is not raised. */
  missingTestsMinCodeAdditions: number;
  missingTestsHighCodeAdditions: number;
  /** Distinct top-level directories where `unrelated-files` starts / saturates. */
  unrelatedDirsLow: number;
  unrelatedDirsHigh: number;
  /** Minimum files in the diff before `unrelated-files` is considered at all. */
  unrelatedMinFiles: number;
  /** A trimmed body shorter than this counts as "sparse". */
  sparseBodyMaxChars: number;
  /** Total changed lines where `sparse-body` starts / saturates. */
  sparseBodyLinesLow: number;
  sparseBodyLinesHigh: number;
  /** Boilerplate pattern hits where `boilerplate-body` starts / saturates. */
  boilerplateHitsLow: number;
  boilerplateHitsHigh: number;
  /** Added lines of code below which verification notes are not expected. */
  verificationMinCodeAdditions: number;
  /** Total changed lines where `first-contribution-large-change` starts / saturates. */
  firstTimeLinesLow: number;
  firstTimeLinesHigh: number;
}

export interface LevelBounds {
  /** Lower bound (inclusive) of each level; scores below `moderate` are "low". */
  moderate: number;
  elevated: number;
  high: number;
}

export interface SlopGuardConfig {
  weights: Record<string, number>;
  thresholds: Thresholds;
  levels: LevelBounds;
}

export interface PartialConfig {
  weights?: Record<string, number>;
  thresholds?: Partial<Thresholds>;
  levels?: Partial<LevelBounds>;
}

/**
 * Default weights. The theoretical maximum is deliberately above 100 so a PR
 * does not need to trip every heuristic to reach a "high" attention score,
 * while any single signal on its own stays well below "high".
 */
export const DEFAULT_CONFIG: SlopGuardConfig = {
  weights: {
    'oversized-diff': 18,
    'generated-code-ratio': 22,
    'missing-tests': 14,
    'unrelated-files': 10,
    'boilerplate-body': 18,
    'missing-issue-reference': 6,
    'missing-verification-steps': 10,
    'sparse-body': 10,
    'first-contribution-large-change': 16,
    'llm-review': 10,
  },
  thresholds: {
    oversizedLinesLow: 400,
    oversizedLinesHigh: 4000,
    generatedRatioLow: 0.25,
    generatedRatioHigh: 0.75,
    generatedMinAddedLines: 50,
    minifiedLineLength: 500,
    missingTestsMinCodeAdditions: 40,
    missingTestsHighCodeAdditions: 800,
    unrelatedDirsLow: 3,
    unrelatedDirsHigh: 9,
    unrelatedMinFiles: 8,
    sparseBodyMaxChars: 30,
    sparseBodyLinesLow: 50,
    sparseBodyLinesHigh: 600,
    boilerplateHitsLow: 1,
    boilerplateHitsHigh: 7,
    verificationMinCodeAdditions: 20,
    firstTimeLinesLow: 300,
    firstTimeLinesHigh: 2500,
  },
  levels: {
    moderate: 20,
    elevated: 45,
    high: 70,
  },
};

export function mergeConfig(partial?: PartialConfig): SlopGuardConfig {
  if (!partial) return structuredClone(DEFAULT_CONFIG);
  return {
    weights: { ...DEFAULT_CONFIG.weights, ...(partial.weights ?? {}) },
    thresholds: { ...DEFAULT_CONFIG.thresholds, ...(partial.thresholds ?? {}) },
    levels: { ...DEFAULT_CONFIG.levels, ...(partial.levels ?? {}) },
  };
}

/** Linear ramp: 0 at or below `low`, 1 at or above `high`. */
export function ramp(value: number, low: number, high: number): number {
  if (high <= low) return value >= high ? 1 : 0;
  return Math.min(1, Math.max(0, (value - low) / (high - low)));
}

export function levelForScore(score: number, levels: LevelBounds): AttentionLevel {
  if (score >= levels.high) return 'high';
  if (score >= levels.elevated) return 'elevated';
  if (score >= levels.moderate) return 'moderate';
  return 'low';
}
