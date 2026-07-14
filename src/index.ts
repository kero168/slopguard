/**
 * slopguard — review-effort signals for pull requests.
 *
 * Programmatic API:
 *
 * ```ts
 * import { analyzePullRequest } from 'slopguard';
 * const report = analyzePullRequest(prJson, diffText);
 * console.log(report.score, report.level, report.signals);
 * ```
 */

export { analyzePullRequest, withLlmSignal, scoreFromSignals } from './analyze.js';
export { parseUnifiedDiff } from './diff.js';
export {
  computeDiffStats,
  collectDiffSignals,
  type DiffStats,
  type SignalBatch,
} from './signals/diff.js';
export { collectBodySignals, countBoilerplateHits, BOILERPLATE_PATTERNS } from './signals/body.js';
export { collectContributorSignals } from './signals/contributor.js';
export {
  DEFAULT_CONFIG,
  mergeConfig,
  ramp,
  levelForScore,
  type SlopGuardConfig,
  type PartialConfig,
  type Thresholds,
  type LevelBounds,
} from './config.js';
export {
  resolveProvider,
  runLlmReview,
  buildPrompt,
  parseLlmJson,
  DEFAULT_MODELS,
  type ProviderPreference,
  type ResolvedProvider,
  type LlmRunOptions,
} from './llm.js';
export { renderPretty } from './report/pretty.js';
export { renderMarkdown, REPORT_MARKER } from './report/markdown.js';
export { isCodePath, isLockfilePath, isTestPath, isVendoredPath, topLevelSegment } from './paths.js';
export { toolVersion } from './version.js';
export type {
  PullRequestData,
  PullRequestUser,
  DiffFile,
  ParsedDiff,
  Signal,
  SignalCategory,
  AttentionLevel,
  LlmNote,
  Report,
} from './types.js';
