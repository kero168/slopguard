import type { LlmNote, PullRequestData, Report, Signal } from './types.js';
import type { PartialConfig } from './config.js';
import { levelForScore, mergeConfig } from './config.js';
import { parseUnifiedDiff } from './diff.js';
import { collectDiffSignals, computeDiffStats } from './signals/diff.js';
import { collectBodySignals } from './signals/body.js';
import { collectContributorSignals } from './signals/contributor.js';
import { makeSignal } from './util.js';
import { toolVersion } from './version.js';

export function scoreFromSignals(signals: Signal[]): number {
  const sum = signals.reduce((n, s) => n + s.points, 0);
  return Math.max(0, Math.min(100, Math.round(sum)));
}

function sortSignals(signals: Signal[]): Signal[] {
  return [...signals].sort((a, b) => b.points - a.points || a.id.localeCompare(b.id));
}

/**
 * The core entry point: takes the PR JSON (as returned by
 * `gh api repos/{owner}/{repo}/pulls/{number}`) and the unified diff text,
 * and returns a report of weighted signals.
 *
 * The report is advisory. It never claims a PR is AI-generated or unwanted —
 * it estimates how much deliberate review attention the PR deserves, with
 * the reasons spelled out so a human can disagree with any of them.
 */
export function analyzePullRequest(
  pr: PullRequestData,
  diffText: string,
  config?: PartialConfig,
): Report {
  const cfg = mergeConfig(config);
  const diff = parseUnifiedDiff(diffText);
  const stats = computeDiffStats(pr, diff);

  const batches = [
    collectDiffSignals(pr, diff, stats, cfg),
    collectBodySignals(pr, stats, cfg),
    collectContributorSignals(pr, stats, cfg),
  ];

  const signals = sortSignals(batches.flatMap((b) => b.signals));
  const notes = batches.flatMap((b) => b.notes);
  const score = scoreFromSignals(signals);

  return {
    tool: 'slopguard',
    version: toolVersion(),
    generatedAt: new Date().toISOString(),
    pr: {
      number: pr.number,
      title: pr.title,
      author: pr.user?.login,
      authorAssociation: pr.author_association,
      additions: stats.additions,
      deletions: stats.deletions,
      changedFiles: stats.changedFiles,
      url: pr.html_url,
    },
    score,
    level: levelForScore(score, cfg.levels),
    signals,
    notes,
    llm: null,
  };
}

/** Returns a new report with the opt-in LLM note folded in as one more signal. */
export function withLlmSignal(report: Report, llm: LlmNote, config?: PartialConfig): Report {
  const cfg = mergeConfig(config);
  const signal = makeSignal(
    'llm-review',
    'llm',
    cfg.weights['llm-review'] ?? 0,
    llm.concern,
    `LLM triage note (${llm.provider}/${llm.model})`,
    llm.note,
  );
  const signals = sortSignals([...report.signals, signal]);
  const score = scoreFromSignals(signals);
  return {
    ...report,
    signals,
    score,
    level: levelForScore(score, cfg.levels),
    llm,
  };
}
