// The baseline file: findings a codebase already has, committed so a PR only fails on new ones. Shared
// by the action and the plugin's processor, so a local ESLint run treats the same findings as known.
//
// A finding is identified by file + rule + a fingerprint of the flagged element (its tag and the
// attributes that matter for accessibility), with a count per fingerprint. Moving code, reformatting
// or editing an unrelated prop keeps the fingerprint; editing what the rule looks at changes it.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { parse, type TSESTree } from '@typescript-eslint/typescript-estree';
import type { AliasMap } from '../utils/aliases.js';
import { ConfigError } from './config.js';

export const BASELINE_VERSION = 1;
export const BASELINE_TOOL = 'antd-a11y-action';

export interface BaselineEntry {
  /** Repo-relative, forward slashes. */
  file: string;
  rule: string;
  fingerprint: string;
  count: number;
  /** YYYY-MM-DD the entry first appeared. */
  added: string;
}

export interface BaselineFile {
  version: number;
  tool: string;
  entries: BaselineEntry[];
}

export class BaselineError extends ConfigError {}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Reads and validates a baseline. A missing file is `null`: every finding is new. */
export function readBaseline(path: string, label = path): BaselineFile | null {
  if (!existsSync(path)) return null;
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new BaselineError(`${label}: not valid JSON (${(error as Error).message}).`);
  }
  return parseBaseline(data, label);
}

export function parseBaseline(data: unknown, label: string): BaselineFile {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new BaselineError(`${label}: expected a JSON object.`);
  const raw = data as Record<string, unknown>;
  if (typeof raw.version !== 'number' || !Number.isInteger(raw.version)) throw new BaselineError(`${label}: "version" must be an integer.`);
  if (raw.version > BASELINE_VERSION) {
    throw new BaselineError(
      `${label} is baseline version ${raw.version}, but this version of antd A11y Guard reads up to version ${BASELINE_VERSION}. Upgrade the action (and eslint-plugin-antd-a11y).`,
    );
  }
  if (raw.version < 1) throw new BaselineError(`${label}: unknown baseline version ${raw.version}.`);
  if (!Array.isArray(raw.entries)) throw new BaselineError(`${label}: "entries" must be an array.`);
  const entries = raw.entries.map((e, i): BaselineEntry => {
    const where = `${label}: entries[${i}]`;
    if (!e || typeof e !== 'object') throw new BaselineError(`${where} must be an object.`);
    const { file, rule, fingerprint, count, added } = e as Record<string, unknown>;
    if (typeof file !== 'string' || !file) throw new BaselineError(`${where}.file must be a path.`);
    if (typeof rule !== 'string' || !rule.includes('/')) throw new BaselineError(`${where}.rule must be a rule id like antd-a11y/modal-has-title.`);
    if (typeof fingerprint !== 'string' || !fingerprint) throw new BaselineError(`${where}.fingerprint must be a string.`);
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) throw new BaselineError(`${where}.count must be a positive integer.`);
    if (typeof added !== 'string' || !DATE.test(added)) throw new BaselineError(`${where}.added must be a date like 2026-09-24.`);
    return { file, rule, fingerprint, count, added };
  });
  return { version: raw.version, tool: typeof raw.tool === 'string' ? raw.tool : BASELINE_TOOL, entries };
}

/** Deterministic, sorted and pretty-printed, so diffs stay reviewable. */
export function serializeBaseline(entries: readonly BaselineEntry[]): string {
  const sorted = [...entries].sort(
    (a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule) || a.fingerprint.localeCompare(b.fingerprint),
  );
  const body: BaselineFile = {
    version: BASELINE_VERSION,
    tool: BASELINE_TOOL,
    entries: sorted.map(({ file, rule, fingerprint, count, added }) => ({ file, rule, fingerprint, count, added })),
  };
  return `${JSON.stringify(body, null, 2)}\n`;
}

// ------------------------------------------------------------------------------------------------
// Fingerprints

/** Attributes that decide whether an element is accessible, plus the ones that say which element it is. */
const RELEVANT = new Set([
  'role', 'label', 'title', 'alt', 'disabled', 'tabIndex', 'htmlFor', 'id', 'name',
  'autoComplete', 'type', 'placeholder', 'icon', 'trigger', 'onPaste', 'children',
]);
const isRelevant = (name: string, extra: ReadonlySet<string>) => /^aria(-|[A-Z])/.test(name) || RELEVANT.has(name) || extra.has(name);

/** Props aliases read (`props` mappings and condition props), which count as relevant too. */
export function aliasProps(aliases: AliasMap): Set<string> {
  const props = new Set<string>();
  const conditionProp = (c: string) => c.replace(/^!/, '').replace(/:.*$/, '');
  for (const alias of Object.values(aliases)) {
    if (typeof alias === 'string') continue;
    for (const from of Object.keys(alias.props ?? {})) props.add(from);
    for (const c of [alias.name ?? []].flat()) props.add(conditionProp(String(c)));
    for (const conditions of Object.values(alias.satisfies ?? {})) for (const c of [conditions].flat()) props.add(conditionProp(String(c)));
  }
  return props;
}

const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 10);
const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

type Node = TSESTree.Node;

function tagName(name: TSESTree.JSXTagNameExpression): string {
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXNamespacedName') return `${name.namespace.name}:${name.name.name}`;
  return `${tagName(name.object)}.${name.property.name}`;
}

export interface FingerprintSource {
  code: string;
  /** Parsed lazily, once per file. */
  ast?: TSESTree.Program | null;
}

function astOf(source: FingerprintSource): TSESTree.Program | null {
  if (source.ast === undefined) {
    try {
      source.ast = parse(source.code, { jsx: true, loc: true, range: true, comment: false });
    } catch {
      source.ast = null;
    }
  }
  return source.ast;
}

function offsetOf(code: string, line: number, column: number): number {
  let offset = 0;
  for (let l = 1; l < line; l += 1) {
    const next = code.indexOf('\n', offset);
    if (next === -1) return code.length;
    offset = next + 1;
  }
  return offset + Math.max(0, column - 1);
}

/** The innermost node of the wanted types that contains `offset`. */
function innermost(ast: TSESTree.Program, offset: number, types: ReadonlySet<string>): Node | undefined {
  let found: Node | undefined;
  const visit = (node: Node) => {
    if (node.range[0] > offset || node.range[1] < offset) return;
    if (types.has(node.type)) found = node;
    for (const key of Object.keys(node) as (keyof typeof node)[]) {
      if (key === 'parent') continue;
      const child = node[key] as unknown;
      for (const c of Array.isArray(child) ? child : [child]) {
        if (c && typeof (c as Node).type === 'string' && Array.isArray((c as Node).range)) visit(c as Node);
      }
    }
  };
  visit(ast);
  return found;
}

const ELEMENT = new Set(['JSXOpeningElement']);
const OBJECT = new Set(['ObjectExpression']);

/**
 * Fingerprint of the element a finding points at: the JSX element's tag and its relevant attributes
 * (values as written, whitespace collapsed), or for a finding on an object (a Table column) its
 * relevant keys. Falls back to the flagged line's text when the file can't be parsed.
 */
export function fingerprintAt(source: FingerprintSource, line: number, column: number, extraProps: ReadonlySet<string> = new Set()): string {
  const code = source.code;
  const ast = astOf(source);
  const offset = offsetOf(code, line, column);
  const text = (n: Node) => squash(code.slice(n.range[0], n.range[1]));
  if (ast) {
    // A finding on an attribute or a child points inside the element; one on the element points at `<`.
    const element = innermost(ast, offset + 1, ELEMENT) ?? innermost(ast, offset, ELEMENT);
    if (element?.type === 'JSXOpeningElement') {
      const parts = [`<${tagName(element.name)}`];
      for (const attr of element.attributes) {
        if (attr.type === 'JSXSpreadAttribute') {
          parts.push(`{...${text(attr.argument)}}`);
          continue;
        }
        const name = attr.name.type === 'JSXIdentifier' ? attr.name.name : `${attr.name.namespace.name}:${attr.name.name.name}`;
        if (!isRelevant(name, extraProps)) continue;
        parts.push(attr.value ? `${name}=${text(attr.value)}` : name);
      }
      return hash(parts.sort((a, b) => (a.startsWith('<') ? -1 : b.startsWith('<') ? 1 : a.localeCompare(b))).join(' '));
    }
    const object = innermost(ast, offset + 1, OBJECT);
    if (object?.type === 'ObjectExpression') {
      const parts = ['{'];
      for (const prop of object.properties) {
        if (prop.type !== 'Property' || prop.computed) continue;
        const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.type === 'Literal' ? String(prop.key.value) : '';
        if (key === 'key' || key === 'dataIndex' || isRelevant(key, extraProps)) parts.push(`${key}:${text(prop.value)}`);
      }
      return hash(parts.sort().join(' '));
    }
  }
  const lineText = code.split('\n')[line - 1] ?? '';
  return hash(`line:${squash(lineText)}`);
}

// ------------------------------------------------------------------------------------------------
// Matching

export interface Identified {
  file: string;
  rule: string;
  fingerprint: string;
}

export type BaselineState = 'new' | 'baselined';

export interface Match<T> {
  /** Each finding, in the order given, with its state and (when baselined) the entry it matched. */
  findings: { finding: T; state: BaselineState; entry?: BaselineEntry }[];
  /** Entries in scope with fewer matching findings than their count: what's left of each is fixed. */
  fixed: (BaselineEntry & { fixed: number })[];
}

const keyOf = (e: Identified) => `${e.file}\u0000${e.rule}\u0000${e.fingerprint}`;

export interface MatchScope {
  /** Files that were scanned: only their entries can match or be fixed. */
  scanned: ReadonlySet<string>;
  /** Entries under this repo-relative directory are this run's; '' for the whole repository. */
  dir: string;
  /** Files that no longer exist: all their entries in `dir` are fixed. */
  exists: (file: string) => boolean;
  /** Old path → new path, for files a change renamed. */
  renames?: ReadonlyMap<string, string>;
}

export const inDir = (file: string, dir: string) => !dir || file === dir || file.startsWith(`${dir}/`);

/** Applies renames to entries, merging counts that land on the same key. */
export function renameEntries(entries: readonly BaselineEntry[], renames: ReadonlyMap<string, string> | undefined): BaselineEntry[] {
  if (!renames?.size) return [...entries];
  const merged = new Map<string, BaselineEntry>();
  for (const entry of entries) {
    const moved = { ...entry, file: renames.get(entry.file) ?? entry.file };
    const existing = merged.get(keyOf(moved));
    if (existing) {
      existing.count += moved.count;
      if (moved.added < existing.added) existing.added = moved.added;
    } else merged.set(keyOf(moved), moved);
  }
  return [...merged.values()];
}

/**
 * Marks each finding new or baselined, count by count: four identical findings against `count: 3`
 * make three baselined and one new. Entries for scanned or deleted files with fewer findings than
 * their count are fixed.
 */
export function matchBaseline<T extends Identified>(findings: readonly T[], entries: readonly BaselineEntry[], scope: MatchScope): Match<T> {
  const renamed = renameEntries(entries, scope.renames);
  const remaining = new Map<string, { entry: BaselineEntry; left: number }>();
  for (const entry of renamed) {
    if (inDir(entry.file, scope.dir) && scope.scanned.has(entry.file)) remaining.set(keyOf(entry), { entry, left: entry.count });
  }
  const result: Match<T> = { findings: [], fixed: [] };
  for (const finding of findings) {
    const slot = remaining.get(keyOf(finding));
    if (slot && slot.left > 0) {
      slot.left -= 1;
      result.findings.push({ finding, state: 'baselined', entry: slot.entry });
    } else {
      result.findings.push({ finding, state: 'new' });
    }
  }
  for (const { entry, left } of remaining.values()) if (left > 0) result.fixed.push({ ...entry, fixed: left });
  for (const entry of renamed) {
    if (inDir(entry.file, scope.dir) && !scope.scanned.has(entry.file) && !scope.exists(entry.file)) result.fixed.push({ ...entry, fixed: entry.count });
  }
  return result;
}

export type UpdateMode = 'full' | 'shrink';

/**
 * The baseline after an update run. `full` replaces this directory's entries with what the scan
 * found (keeping each surviving entry's `added` date); `shrink` only lowers counts and drops fixed
 * entries, and never adds one. Entries outside `dir` are left as they are.
 */
export function updateBaseline<T extends Identified>(
  mode: UpdateMode,
  findings: readonly T[],
  entries: readonly BaselineEntry[],
  scope: MatchScope,
  today: string,
): BaselineEntry[] {
  const renamed = renameEntries(entries, scope.renames);
  const outside = renamed.filter((e) => !inDir(e.file, scope.dir));
  const inside = renamed.filter((e) => inDir(e.file, scope.dir));
  const counts = new Map<string, { id: Identified; count: number }>();
  for (const f of findings) {
    const key = keyOf(f);
    const slot = counts.get(key) ?? { id: { file: f.file, rule: f.rule, fingerprint: f.fingerprint }, count: 0 };
    slot.count += 1;
    counts.set(key, slot);
  }
  const previous = new Map(inside.map((e) => [keyOf(e), e]));
  if (mode === 'full') {
    const next = [...counts.entries()].map(([key, { id, count }]) => ({ ...id, count, added: previous.get(key)?.added ?? today }));
    return [...outside, ...next];
  }
  const kept: BaselineEntry[] = [];
  for (const entry of inside) {
    if (scope.scanned.has(entry.file)) {
      const count = Math.min(entry.count, counts.get(keyOf(entry))?.count ?? 0);
      if (count > 0) kept.push({ ...entry, count });
    } else if (scope.exists(entry.file)) {
      kept.push(entry);
    }
  }
  return [...outside, ...kept];
}

/** Whole days between a YYYY-MM-DD date and `today`. */
export function ageInDays(added: string, today: string): number {
  return Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${added}T00:00:00Z`)) / 86_400_000);
}

/** "8 months", "3 weeks", "5 days" */
export function describeAge(days: number): string {
  if (days >= 365) return `${Math.floor(days / 365)} ${Math.floor(days / 365) === 1 ? 'year' : 'years'}`;
  if (days >= 60) return `${Math.floor(days / 30)} months`;
  if (days >= 14) return `${Math.floor(days / 7)} weeks`;
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}
