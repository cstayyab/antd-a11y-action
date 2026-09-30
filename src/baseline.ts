// The action's side of the baseline: read the file, mark each finding new or baselined, and in update
// runs write the new file. Matching and the file format live in the plugin's engine, shared with
// local ESLint runs.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { engine } from 'eslint-plugin-antd-a11y';
import type { Finding, ScanResult } from './types.js';

export type BaselineUpdate = 'false' | 'full' | 'shrink';

export interface BaselineOptions {
  /** Repo-relative path of the baseline file. */
  file: string;
  workspace: string;
  /** Repo-relative working directory; this run only reads and writes entries under it. */
  dir: string;
  /** Repo-relative files this run checked. */
  scanned: ReadonlySet<string>;
  renames?: ReadonlyMap<string, string>;
  update: BaselineUpdate;
  ageWarning?: number;
  /** YYYY-MM-DD */
  today: string;
}

export interface BaselineSummary {
  file: string;
  /** The file didn't exist: every finding is new. */
  missing: boolean;
  newFindings: number;
  baselined: number;
  /** Baseline entries in scope with fewer findings than their count, and how many are gone. */
  fixed: (engine.BaselineEntry & { fixed: number })[];
  /** Oldest `added` date among the entries that still match. */
  oldest?: string;
  /** Matching entries older than `ageWarning` days, out of `matchedEntries`. */
  aged: number;
  matchedEntries: number;
  ageWarning?: number;
  /** Update runs: where the new file was written, and its entry counts before and after. */
  written?: { path: string; before: number; after: number; mode: 'full' | 'shrink' };
}

type Identified = Finding & { file: string; fingerprint: string };
const identifiable = (f: Finding): f is Identified => !!f.file && !!f.fingerprint;

/**
 * Marks findings in the baseline as `baselined` (never blocking) and the rest as `new`. In an update
 * run nothing blocks and the new file is written to the workspace.
 */
export async function applyBaseline(result: ScanResult, options: BaselineOptions): Promise<BaselineSummary> {
  const absolute = path.resolve(options.workspace, options.file);
  const parsed = engine.readBaseline(absolute, options.file);
  const entries = parsed?.entries ?? [];
  const scope: engine.MatchScope = {
    scanned: options.scanned,
    dir: options.dir,
    renames: options.renames,
    exists: (file) => existsSync(path.join(options.workspace, file)),
  };

  const identified = result.findings.filter(identifiable);
  const candidates = identified.map((f) => ({ ...f, rule: f.ruleId }));
  const match = engine.matchBaseline(candidates, entries, scope);
  const stateOf = new Map<Finding, engine.BaselineState>();
  const matched = new Set<engine.BaselineEntry>();
  match.findings.forEach(({ state, entry }, i) => {
    stateOf.set(identified[i], state);
    if (entry) matched.add(entry);
  });
  for (const finding of result.findings) {
    finding.baseline = stateOf.get(finding) ?? 'new';
    if (finding.baseline === 'baselined') finding.blocking = false;
  }

  const summary: BaselineSummary = {
    file: options.file,
    missing: !parsed,
    newFindings: result.findings.filter((f) => f.baseline === 'new').length,
    baselined: result.findings.filter((f) => f.baseline === 'baselined').length,
    fixed: match.fixed,
    aged: 0,
    matchedEntries: matched.size,
    ageWarning: options.ageWarning,
  };
  for (const entry of matched) {
    if (!summary.oldest || entry.added < summary.oldest) summary.oldest = entry.added;
    if (options.ageWarning && engine.ageInDays(entry.added, options.today) > options.ageWarning) summary.aged += 1;
  }

  if (options.update !== 'false') {
    const next = engine.updateBaseline(options.update, candidates, entries, scope, options.today);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, engine.serializeBaseline(next));
    summary.written = { path: absolute, before: entries.length, after: next.length, mode: options.update };
    // An update run records the current state; it never fails on it.
    for (const finding of result.findings) finding.blocking = false;
  }
  return summary;
}

/** "3 new · 41 baselined (oldest 8 months) · 2 fixed (remove from the baseline)" */
export function baselineLine(summary: BaselineSummary, today: string): string {
  const parts = [`${summary.newFindings} new`];
  const age = summary.oldest ? ` (oldest ${engine.describeAge(engine.ageInDays(summary.oldest, today))})` : '';
  parts.push(`${summary.baselined} baselined${age}`);
  const fixed = summary.fixed.reduce((n, e) => n + e.fixed, 0);
  if (fixed) parts.push(`${fixed} fixed (remove from the baseline)`);
  return parts.join(' · ');
}
