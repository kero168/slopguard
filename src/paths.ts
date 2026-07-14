/** Path classification helpers shared by the diff signals. */

const LOCKFILE_NAMES = new Set([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lock',
  'bun.lockb',
  'cargo.lock',
  'gemfile.lock',
  'poetry.lock',
  'pipfile.lock',
  'uv.lock',
  'composer.lock',
  'go.sum',
  'flake.lock',
  'packages.lock.json',
  'gradle.lockfile',
  'pubspec.lock',
  'mix.lock',
]);

export function isLockfilePath(path: string): boolean {
  const base = path.split('/').pop() ?? path;
  return LOCKFILE_NAMES.has(base.toLowerCase());
}

const VENDORED_DIR =
  /(^|\/)(node_modules|vendor|vendored|third_party|thirdparty|dist|build|out|target|\.next|\.nuxt|coverage|__snapshots__)\//i;

export function isVendoredPath(path: string): boolean {
  return (
    VENDORED_DIR.test(path) ||
    /\.min\.(js|css)$/i.test(path) ||
    /\.map$/i.test(path) ||
    /\.pb\.(go|py|cc|h)$/i.test(path) ||
    /\.generated\.[a-z]+$/i.test(path)
  );
}

const TEST_DIR = /(^|\/)(tests?|__tests__|spec|specs|testdata|e2e)\//i;

export function isTestPath(path: string): boolean {
  if (TEST_DIR.test(path)) return true;
  const base = path.split('/').pop() ?? path;
  return (
    /\.(test|spec)\.[cm]?[jt]sx?$/i.test(base) ||
    /_test\.(go|py|rb|rs|c|cc|cpp|java|kt|ex|exs|ts|js)$/i.test(base) ||
    /^test_.*\.py$/i.test(base) ||
    /Tests?\.(java|kt|cs|scala|swift)$/.test(base)
  );
}

const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'svelte',
  'py', 'go', 'rb', 'rs', 'java', 'kt', 'kts', 'scala',
  'c', 'h', 'cc', 'cpp', 'hpp', 'cs', 'php', 'swift',
  'sh', 'bash', 'pl', 'lua', 'dart', 'ex', 'exs', 'sql',
]);

export function isCodePath(path: string): boolean {
  if (isLockfilePath(path) || isVendoredPath(path)) return false;
  const base = path.split('/').pop() ?? path;
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return false;
  return CODE_EXTENSIONS.has(base.slice(dot + 1).toLowerCase());
}

/** First path segment, or "(root)" for files at the repository root. */
export function topLevelSegment(path: string): string {
  const idx = path.indexOf('/');
  return idx === -1 ? '(root)' : path.slice(0, idx);
}
