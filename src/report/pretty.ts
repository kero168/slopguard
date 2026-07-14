import type { AttentionLevel, Report } from '../types.js';

const RESET = '\u001b[0m';
const BOLD = '\u001b[1m';
const DIM = '\u001b[2m';

const LEVEL_COLORS: Record<AttentionLevel, string> = {
  low: '\u001b[32m',
  moderate: '\u001b[33m',
  elevated: '\u001b[35m',
  high: '\u001b[31m',
};

export function renderPretty(report: Report, opts: { color?: boolean } = {}): string {
  const useColor = opts.color === true;
  const paint = (code: string, s: string): string => (useColor ? `${code}${s}${RESET}` : s);

  const lines: string[] = [];
  lines.push(paint(BOLD, `slopguard v${report.version} — review-effort signals (not verdicts)`));
  lines.push('');

  const prBits: string[] = [];
  if (report.pr.number !== undefined) prBits.push(`PR #${report.pr.number}`);
  if (report.pr.title) prBits.push(`"${report.pr.title}"`);
  if (report.pr.author) prBits.push(`by @${report.pr.author}`);
  if (prBits.length > 0) lines.push(prBits.join(' '));
  lines.push(
    `+${report.pr.additions.toLocaleString('en-US')} ` +
      `-${report.pr.deletions.toLocaleString('en-US')} across ${report.pr.changedFiles} files`,
  );
  lines.push('');

  const barWidth = 24;
  const filled = Math.round((report.score / 100) * barWidth);
  const bar = '#'.repeat(filled) + '-'.repeat(barWidth - filled);
  const levelColor = LEVEL_COLORS[report.level];
  lines.push(
    `Attention score: ${paint(BOLD + levelColor, `${report.score}/100 (${report.level})`)}  ` +
      paint(levelColor, `[${bar}]`),
  );
  lines.push('');

  if (report.signals.length === 0) {
    lines.push('No signals raised. Nothing here suggests this PR needs special triage.');
  } else {
    lines.push(paint(BOLD, 'Signals (points · id · what we noticed):'));
    for (const s of report.signals) {
      const pts = s.points.toFixed(1).padStart(5);
      lines.push(`  ${paint(BOLD, pts)}  ${s.id.padEnd(32)} ${s.summary}`);
      if (s.details) lines.push(paint(DIM, `         ${s.details}`));
    }
  }

  if (report.notes.length > 0) {
    lines.push('');
    lines.push(paint(BOLD, 'Notes:'));
    for (const n of report.notes) lines.push(paint(DIM, `  - ${n}`));
  }

  lines.push('');
  lines.push(
    paint(
      DIM,
      'Signals, not verdicts: slopguard cannot tell whether a change is AI-generated or ' +
        'unwanted. Use these hints to decide where review time goes first.',
    ),
  );
  return lines.join('\n');
}
