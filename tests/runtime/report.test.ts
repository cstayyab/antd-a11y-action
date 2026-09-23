import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv-draft-04';
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../src/report/markdown.js';
import { toSarif } from '../../src/report/sarif.js';
import { buildRuntimeResult, RUNTIME_MARKER, type PageResult } from '../../src/runtime/report.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
const opts = { failOn: 'serious' as const, cwd: path.join(root, 'apps/web'), workspace: root };
const guard = { createElement: 10, jsx: 5, wraps: 8 };

const pages: PageResult[] = [
  {
    route: '/bad',
    status: 200,
    guard,
    runtime: [
      { rule: 'accessible-name', message: '<button> has no accessible name', origin: 'library', location: { file: 'app/bad/page.tsx', line: 10, column: 7 } },
      { rule: 'click-events-need-role', message: '<div onClick> without an interactive role', origin: 'app', location: { file: 'app/bad/page.tsx', line: 11, column: 7 } },
      { rule: 'click-events-need-role', message: '<div onClick> without an interactive role', origin: 'library', location: { file: 'app/bad/page.tsx', line: 13, column: 7 } },
      { rule: 'image-alt', message: '<img> missing alt', site: 'at Foo (chunk.js:1:1)', origin: null, location: null },
    ],
    axe: [{ id: 'image-alt', impact: 'critical', help: 'Images must have alternative text', helpUrl: 'https://x/image-alt', targets: ['img'] }],
  },
  {
    route: '/other',
    status: 200,
    guard,
    runtime: [
      { rule: 'accessible-name', message: '<button> has no accessible name', origin: 'library', location: { file: 'app/bad/page.tsx', line: 10, column: 7 } },
    ],
    axe: [
      { id: 'image-alt', impact: 'critical', help: 'Images must have alternative text', targets: ['img'] },
      { id: 'region', impact: null, help: 'Content should be in landmarks', targets: ['body > div'] },
    ],
  },
  { route: '/broken', status: 500, guard: null, runtime: [], axe: [] },
];

describe('buildRuntimeResult', () => {
  const result = buildRuntimeResult(pages, opts);
  const byId = (id: string) => result.findings.filter((f) => f.ruleId === id);

  it('merges the same issue across routes and maps files to repo paths', () => {
    const named = byId('runtime/accessible-name');
    expect(named).toHaveLength(1);
    expect(named[0]).toMatchObject({ file: 'apps/web/app/bad/page.tsx', line: 10, routes: ['/bad', '/other'], impact: 'critical', blocking: true });
    expect(byId('axe/image-alt')[0].routes).toEqual(['/bad', '/other']);
  });

  it('downgrades authoring rules on library-internal elements to minor', () => {
    const clicks = byId('runtime/click-events-need-role');
    expect(clicks.map((f) => [f.line, f.impact, f.blocking])).toEqual([
      [11, 'serious', true],
      [13, 'minor', false],
    ]);
    expect(clicks[1].message).toMatch(/inside a library component/);
  });

  it('keeps unresolved guard findings with their callsite, and axe findings without impact as moderate', () => {
    expect(byId('runtime/image-alt')[0]).toMatchObject({ file: undefined, target: 'at Foo (chunk.js:1:1)' });
    expect(byId('axe/region')[0]).toMatchObject({ impact: 'moderate', blocking: false, target: 'body > div' });
  });

  it('tracks guard activity, routes and error pages', () => {
    expect(result.guardActive).toBe(true);
    expect(result.routes).toEqual(['/bad', '/broken', '/other']);
    expect(result.failedRoutes).toEqual(['/broken']);
    expect(buildRuntimeResult([{ ...pages[2] }], opts).guardActive).toBe(false);
  });

  it('never blocks with fail-on none', () => {
    expect(buildRuntimeResult(pages, { ...opts, failOn: 'none' }).findings.some((f) => f.blocking)).toBe(false);
  });

  it('renders its own sticky comment and schema-valid SARIF with only located findings', async () => {
    const md = renderMarkdown(result, {
      failOn: 'serious',
      scope: 'Next.js guard + axe',
      marker: RUNTIME_MARKER,
      title: 'antd A11y Guard: runtime',
      scanned: '3 routes',
      banner: 'banner text',
    });
    expect(md.startsWith(RUNTIME_MARKER)).toBe(true);
    expect(md).not.toContain('<!-- antd-a11y-guard -->');
    expect(md).toContain('> banner text');
    expect(md).toContain('`body > div`<br><sub>/other</sub>');

    const sarif = toSarif(result, 'serious', '0.0.0-test', 'antd-a11y-guard-runtime');
    const run = sarif.runs[0];
    expect(run.results.every((r) => r.locations[0].physicalLocation.artifactLocation.uri.startsWith('apps/web/'))).toBe(true);
    expect(run.results).toHaveLength(3);
    const schema = JSON.parse(await readFile(path.join(root, 'tests/schemas/sarif-schema-2.1.0.json'), 'utf8'));
    const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
    expect(validate(JSON.parse(JSON.stringify(sarif)))).toBe(true);
  });
});
