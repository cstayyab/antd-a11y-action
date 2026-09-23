import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { minimatch } from 'minimatch';

/** Directories never worth scanning. */
export const ALWAYS_EXCLUDED = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.next/**',
  '**/storybook-static/**',
  '**/*.d.ts',
  '**/*.min.js',
];
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'storybook-static']);

export function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

/** Repo-relative path of the working directory, '' for the root. */
export function normalizeDir(workingDirectory: string): string {
  const posix = toPosix(path.normalize(workingDirectory)).replace(/\/$/, '');
  if (posix === '..' || posix.startsWith('../') || path.isAbsolute(workingDirectory)) {
    throw new Error('working-directory must be a relative path inside the repository.');
  }
  return posix === '.' ? '' : posix.replace(/^\.\//, '');
}

/**
 * Keeps repo-relative files that sit under `dir` and match the include/exclude
 * globs. Globs are relative to `dir`.
 */
export function filterFiles(files: string[], dir: string, include: string[], exclude: string[]): string[] {
  const prefix = dir ? `${dir}/` : '';
  const excluded = [...ALWAYS_EXCLUDED, ...exclude];
  const opts = { dot: true };
  return files.filter((file) => {
    if (prefix && !file.startsWith(prefix)) return false;
    const rel = file.slice(prefix.length);
    if (!include.some((glob) => minimatch(rel, glob, opts))) return false;
    return !excluded.some((glob) => minimatch(rel, glob, opts));
  });
}

/** Every file under `root/dir`, repo-relative. */
export async function walk(root: string, dir: string): Promise<string[]> {
  const out: string[] = [];
  const visit = async (rel: string): Promise<void> => {
    const entries = await readdir(path.join(root, rel), { withFileTypes: true });
    for (const entry of entries) {
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await visit(child);
      } else if (entry.isFile()) {
        out.push(child);
      }
    }
  };
  await visit(dir);
  return out.sort();
}
