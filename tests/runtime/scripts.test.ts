import { mkdirSync, mkdtempSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeInstrumentation } from '../../runtime/scripts/inject-next.mjs';
import { atLeast, lines } from '../../runtime/scripts/lib.mjs';
import { resolveConfig } from '../../runtime/scripts/prepare.mjs';
import { buildRoutes, discoverNextRoutes } from '../../runtime/scripts/routes.mjs';
import { normalizeSource, resolveStack } from '../../runtime/resolve';

function tmpApp(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'a11y-app-'));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), content);
  }
  return dir;
}

const pkg = (version: string) => JSON.stringify({ version });

describe('lib', () => {
  it('parses newline lists and compares versions', () => {
    expect(lines(' /a \n\n/b\r\n')).toEqual(['/a', '/b']);
    expect(atLeast('15.5.2', [15, 3])).toBe(true);
    expect(atLeast('15.2.9', [15, 3])).toBe(false);
    expect(atLeast('16.0.0-canary.1', [15, 3])).toBe(true);
    expect(atLeast('nope', [1, 0])).toBe(false);
  });
});

describe('prepare', () => {
  const base = (cwd: string, env: Record<string, string> = {}) =>
    resolveConfig({ GITHUB_WORKSPACE: path.dirname(cwd), IN_WD: path.basename(cwd), RUNNER_TEMP: '/tmp/rt', ...env });

  it('picks Next mode when next >= 15.3 is installed and no start-command is given', () => {
    const cwd = tmpApp({ 'node_modules/next/package.json': pkg('15.5.26'), 'node_modules/react/package.json': pkg('19.3.0') });
    const { vars, warnings } = base(cwd);
    expect(vars.A11Y_MODE).toBe('next');
    expect(vars.A11Y_DEV_CMD).toBe('npx next dev --turbopack -p 3100');
    expect(vars.A11Y_BASE_URL).toBe('http://localhost:3100');
    expect(warnings).toEqual([]);
  });

  it('falls back to generic below Next 15.3 and warns about old React and Next 16', () => {
    const old = tmpApp({ 'node_modules/next/package.json': pkg('14.2.0') });
    expect(() => base(old)).toThrow(/start-command/); // generic without a way to reach the app
    const oldWithCmd = base(old, { IN_FRAMEWORK: 'next', IN_START_COMMAND: 'npm start' });
    expect(oldWithCmd.vars.A11Y_MODE).toBe('generic');
    expect(oldWithCmd.warnings[0]).toMatch(/instrumentation-client/);

    const next16 = tmpApp({ 'node_modules/next/package.json': pkg('16.3.6'), 'node_modules/react/package.json': pkg('19.3.0') });
    expect(base(next16)).toMatchObject({ vars: { A11Y_MODE: 'next' }, warnings: [] });

    const next17 = tmpApp({ 'node_modules/next/package.json': pkg('17.0.0'), 'node_modules/react/package.json': pkg('19.0.0') });
    const { warnings } = base(next17);
    expect(warnings.join(' ')).toMatch(/untested/);
    expect(warnings.join(' ')).toMatch(/captureOwnerStack/);
  });

  it('uses start-command and target-url in generic mode', () => {
    const cwd = tmpApp({ 'package.json': '{}' });
    const { vars } = base(cwd, { IN_START_COMMAND: 'npm run preview', IN_TARGET_URL: 'http://localhost:4173' });
    expect(vars).toMatchObject({ A11Y_MODE: 'generic', A11Y_DEV_CMD: 'npm run preview', A11Y_BASE_URL: 'http://localhost:4173' });
  });

  it('exports the setup module and keeps the saved session out of the results folder', () => {
    const cwd = tmpApp({ 'node_modules/next/package.json': pkg('15.5.26'), 'a11y/setup.mjs': 'export default () => {}' });
    const { vars } = base(cwd, { IN_SETUP: 'a11y/setup.mjs' });
    expect(vars.A11Y_SETUP).toBe(path.join(cwd, 'a11y/setup.mjs'));
    expect(path.dirname(vars.A11Y_AUTH_STATE)).toBe(path.dirname(vars.A11Y_OUT));
    expect(vars.A11Y_AUTH_STATE.startsWith(vars.A11Y_OUT)).toBe(false);
    expect(base(cwd).vars.A11Y_AUTH_STATE).toBe('');
  });

  it('rejects paths outside the repository and bad framework values', () => {
    const cwd = tmpApp({ 'package.json': '{}' });
    expect(() => base(cwd, { IN_WD: '../elsewhere' })).toThrow(/inside the repository/);
    expect(() => base(cwd, { IN_FRAMEWORK: 'vite' })).toThrow(/framework/);
  });
});

describe('routes', () => {
  const app = tmpApp({
    'app/page.tsx': '',
    'app/about/page.tsx': '',
    'app/(marketing)/pricing/page.tsx': '',
    'app/products/[id]/page.tsx': '',
    'app/docs/[...slug]/page.mdx': '',
    'app/@modal/login/page.tsx': '',
    'app/feed/(.)photo/page.tsx': '',
    'app/_private/page.tsx': '',
    'app/admin/page.tsx': '',
  });

  it('discovers static App Router pages only', async () => {
    expect((await discoverNextRoutes(app)).sort()).toEqual(['/', '/about', '/admin', '/pricing']);
  });

  it('merges extra routes, applies exclusions, sorts and caps', async () => {
    const routes = await buildRoutes({
      cwd: app,
      mode: 'next',
      extra: ['/products/demo', 'orders/1'],
      exclude: ['^/admin'],
      discover: true,
      max: 5,
    });
    expect(routes).toEqual(['/', '/about', '/orders/1', '/pricing', '/products/demo']);
  });

  it('crawls "/" when nothing else is configured in generic mode', async () => {
    expect(await buildRoutes({ cwd: app, mode: 'generic', extra: [], exclude: [], discover: true, max: 50 })).toEqual(['/']);
  });
});

describe('inject', () => {
  const guardDir = (cwd: string) => path.join(cwd, '.a11y-guard', 'next-a11y');

  it('writes a relative import next to the app, matching the project language', () => {
    const cwd = tmpApp({ 'app/page.tsx': '', 'tsconfig.json': '{}' });
    const target = writeInstrumentation(cwd, guardDir(cwd));
    expect(path.basename(target)).toBe('instrumentation-client.ts');
    expect(readFileSync(target, 'utf8')).toContain('from "./.a11y-guard/next-a11y/src/client.js"');
  });

  it('uses src/ when the app lives there and keeps an existing instrumentation-client', () => {
    const cwd = tmpApp({ 'src/app/page.jsx': '', 'src/instrumentation-client.js': 'console.log("mine")' });
    const target = writeInstrumentation(cwd, guardDir(cwd));
    expect(target).toBe(path.join(cwd, 'src/instrumentation-client.js'));
    const body = readFileSync(target, 'utf8');
    expect(body).toContain('import "./instrumentation-client.a11y-original";');
    expect(body).toContain('from "../.a11y-guard/next-a11y/src/client.js"');
    expect(readFileSync(path.join(cwd, 'src/instrumentation-client.a11y-original.js'), 'utf8')).toContain('mine');
  });

  it('is idempotent: a second injection replaces its own file and keeps the original import', () => {
    const cwd = tmpApp({ 'app/page.tsx': '', 'tsconfig.json': '{}', 'instrumentation-client.ts': 'export {}' });
    writeInstrumentation(cwd, guardDir(cwd));
    const target = writeInstrumentation(cwd, guardDir(cwd));
    const body = readFileSync(target, 'utf8');
    expect(body.match(/installA11yGuard\(/g)).toHaveLength(1);
    expect(body).toContain('instrumentation-client.a11y-original');
    expect(readFileSync(path.join(cwd, 'instrumentation-client.a11y-original.ts'), 'utf8')).toBe('export {}');
    expect(existsSync(path.join(cwd, 'instrumentation-client.a11y-original.ts'))).toBe(true);
  });
});

describe('resolve', () => {
  it('normalizes Turbopack, webpack and file sources to app-relative paths', () => {
    const cwd = '/repo/apps/web';
    expect(normalizeSource('turbopack:///[project]/app/bad/page.tsx', cwd)).toBe('app/bad/page.tsx');
    expect(normalizeSource('webpack://_N_E/./app/x.tsx?1234', cwd)).toBe('app/x.tsx');
    expect(normalizeSource('file:///repo/apps/web/src/app/page.tsx', cwd)).toBe('src/app/page.tsx');
    expect(normalizeSource('/repo/apps/web/app/%5Bid%5D/page.tsx', cwd)).toBe('app/[id]/page.tsx');
  });

  it('gives file-level blame for webpack dev frames, skipping the guard and node_modules', async () => {
    const stack = [
      'at jsx (webpack-internal:///(app-pages-browser)/./.a11y-guard/next-a11y/src/client.js:54:125)',
      'at Button (webpack-internal:///(app-pages-browser)/./node_modules/antd/es/button/button.js:10:1)',
      'at Bad (webpack-internal:///(app-pages-browser)/./app/bad/page.tsx:31:88)',
    ].join('\n');
    expect(await resolveStack(stack, '/repo/apps/web')).toEqual({ file: 'app/bad/page.tsx' });
    expect(await resolveStack('at x (webpack-internal:///./node_modules/a.js:1:1)', '/repo')).toBeNull();
  });
});
