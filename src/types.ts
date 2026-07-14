/**
 * Shared types for SlopGuard.
 *
 * The input shape mirrors the JSON returned by
 * `gh api repos/{owner}/{repo}/pulls/{number}` — only the fields SlopGuard
 * actually reads are declared, and every field is optional so partial
 * payloads degrade gracefully instead of crashing.
 */

export interface PullRequestUser {
  login?: string;
  /** "User" | "Bot" | "Organization" */
  type?: string;
}

export interface PullRequestData {
  number?: number;
  title?: string;
  body?: string | null;
  user?: PullRequestUser;
  /**
   * GitHub's relationship between the author and the repository:
   * OWNER, MEMBER, COLLABORATOR, CONTRIBUTOR, FIRST_TIME_CONTRIBUTOR,
   * FIRST_TIMER, NONE, MANNEQUIN.
   */
  author_association?: string;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  commits?: number;
  html_url?: string;
  draft?: boolean;
  labels?: Array<{ name?: string }>;
  base?: { repo?: { full_name?: string } };
}

/** One file entry parsed out of a unified diff. */
export interface DiffFile {
  path: string;
  oldPath: string;
  additions: number;
  deletions: number;
  binary: boolean;
  renamed: boolean;
  created: boolean;
  removed: boolean;
  /** Length of the longest added line — very long lines suggest minified or bundled output. */
  maxAddedLineLength: number;
  /** True when an added line contains a generated-code marker such as "@generated". */
  generatedMarker: boolean;
}

export interface ParsedDiff {
  files: DiffFile[];
  totalAdditions: number;
  totalDeletions: number;
}

export type SignalCategory = 'diff' | 'body' | 'contributor' | 'llm';

/**
 * A single heuristic observation. Signals are additive hints, never verdicts:
 * `points = weight x intensity`, where intensity is in [0, 1] and expresses
 * how strongly the pattern is present.
 */
export interface Signal {
  id: string;
  category: SignalCategory;
  weight: number;
  intensity: number;
  points: number;
  summary: string;
  details?: string;
}

export type AttentionLevel = 'low' | 'moderate' | 'elevated' | 'high';

export interface LlmNote {
  provider: string;
  model: string;
  /** 0..1 — how much extra review attention the model suggests. */
  concern: number;
  note: string;
}

export interface Report {
  tool: 'slopguard';
  version: string;
  generatedAt: string;
  pr: {
    number?: number;
    title?: string;
    author?: string;
    authorAssociation?: string;
    additions: number;
    deletions: number;
    changedFiles: number;
    url?: string;
  };
  /** 0-100. Higher = more worth an early, deliberate look. Not a quality grade. */
  score: number;
  level: AttentionLevel;
  signals: Signal[];
  /** Context notes: skipped signals, missing data, LLM status. */
  notes: string[];
  llm: LlmNote | null;
}
