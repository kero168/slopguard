import type { Report } from '../types.js';

/** Hidden marker used to find and update an existing slopguard comment. */
export const REPORT_MARKER = '<!-- slopguard:report -->';

function escapeCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/** Renders the report as a Markdown comment suitable for posting on the PR. */
export function renderMarkdown(report: Report): string {
  const lines: string[] = [];
  lines.push(REPORT_MARKER);
  lines.push('### SlopGuard — review-effort signals');
  lines.push('');

  const prRef =
    report.pr.number !== undefined ? `PR #${report.pr.number}` : 'this pull request';
  lines.push(
    `**Attention score: ${report.score}/100 (${report.level})** for ${prRef} — ` +
      `+${report.pr.additions.toLocaleString('en-US')} / ` +
      `-${report.pr.deletions.toLocaleString('en-US')} across ${report.pr.changedFiles} files.`,
  );
  lines.push('');

  if (report.signals.length === 0) {
    lines.push('No heuristic signals were raised for this pull request.');
  } else {
    lines.push('| Signal | Points | What was noticed |');
    lines.push('| --- | ---: | --- |');
    for (const s of report.signals) {
      lines.push(`| \`${s.id}\` | ${s.points.toFixed(1)} | ${escapeCell(s.summary)} |`);
    }
    const detailed = report.signals.filter((s) => s.details);
    if (detailed.length > 0) {
      lines.push('');
      lines.push('<details><summary>Signal details</summary>');
      lines.push('');
      for (const s of detailed) {
        lines.push(`- \`${s.id}\`: ${s.details as string}`);
      }
      lines.push('');
      lines.push('</details>');
    }
  }

  if (report.notes.length > 0) {
    lines.push('');
    lines.push('<details><summary>Notes and skipped checks</summary>');
    lines.push('');
    for (const n of report.notes) lines.push(`- ${n}`);
    lines.push('');
    lines.push('</details>');
  }

  lines.push('');
  lines.push(
    '> **Signals, not verdicts.** SlopGuard highlights patterns that often correlate with ' +
      'low-effort or bulk-generated changes so maintainers can prioritize their review time. ' +
      'A high score is not an accusation, says nothing definitive about how the change was ' +
      'written, and must not replace human review.',
  );
  lines.push('');
  lines.push(
    `<sub>slopguard v${report.version} · ` +
      '<a href="https://github.com/kero168/slopguard/blob/main/docs/signals.md">how scoring works</a></sub>',
  );
  return lines.join('\n');
}
