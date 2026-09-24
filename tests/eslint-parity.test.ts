// A local ESLint run with antdA11y.config() must give the same findings, with the same blocking
// status, as the action. Both run the plugin's engine; this test keeps it that way.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tsParser from '@typescript-eslint/parser';
import { ESLint, type Linter } from 'eslint';
import antdA11y from 'eslint-plugin-antd-a11y';
import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/config.js';
import { walk } from '../src/files.js';
import { A11yLinter } from '../src/lint.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(repo, 'fixtures/app');
const parser = tsParser as Linter.Parser;

async function eslintRun(cwd: string, options: Parameters<typeof antdA11y.config>[0] = {}) {
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: antdA11y.config({ cwd, parser, ...options }),
  });
  const results = await eslint.lintFiles(['src']);
  return results.flatMap((r) =>
    r.messages
      .filter((m) => m.ruleId) // unused-directive notices are ESLint's own, not findings
      .map((m) => `${path.relative(cwd, r.filePath)}:${m.line}:${m.column} ${m.ruleId} ${m.severity === 2 ? 'blocking' : 'non-blocking'}`),
  );
}

async function actionRun(workspace: string, configFile: string) {
  const config = resolveConfig({ workspace, configFile });
  const linter = new A11yLinter({ config, failOn: config.failOn ?? 'serious' });
  const files = await walk(workspace, 'src');
  const result = await linter.lintFiles(workspace, files);
  return result.findings.map(
    (f) => `${f.file}:${f.line}:${f.column} ${f.ruleId} ${f.blocking ? 'blocking' : 'non-blocking'}`,
  );
}

describe('ESLint parity with the action', () => {
  it('gives the same findings and blocking status on the fixture app', async () => {
    const local = await eslintRun(app, { configFile: 'antd-a11y.json' });
    const action = await actionRun(app, 'antd-a11y.json');
    expect(action.length).toBeGreaterThan(20);
    expect([...local].sort()).toEqual([...action].sort());
  });

  it('reads failOn from the config file for both', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'a11y-parity-'));
    mkdirSync(path.join(dir, 'src'));
    mkdirSync(path.join(dir, '.github'));
    writeFileSync(path.join(dir, '.github/antd-a11y.json'), JSON.stringify({ failOn: 'critical' }));
    writeFileSync(
      path.join(dir, 'src/a.tsx'),
      [
        "import { Button, Modal } from 'antd';",
        'export const A = () => <><Button icon={<svg />} /><Modal open /></>;',
        '{/* a11y-ignore modal-has-title -- a multi-line reason',
        '    that runs on */}',
        'export const B = () => <Modal open />;',
      ].join('\n'),
    );
    const local = await eslintRun(dir);
    const action = await actionRun(dir, '.github/antd-a11y.json');
    // icon-button-has-name is critical (blocks); modal-has-title is serious (doesn't at failOn: critical).
    expect([...local].sort()).toEqual([
      'src/a.tsx:2:26 antd-a11y/icon-button-has-name blocking',
      'src/a.tsx:2:51 antd-a11y/modal-has-title non-blocking',
    ]);
    expect([...action].sort()).toEqual([...local].sort());
  });

  it("leaves other plugins' messages alone and can run without the processor", async () => {
    const code = "import { Modal } from 'antd';\nexport const A = () => <Modal open />; debugger;";
    const linter = new (await import('eslint')).Linter({ configType: 'flat' });
    const withOther = [...antdA11y.config({ configFile: false, parser }), { rules: { 'no-debugger': 'error' } }] as Linter.Config[];
    const messages = linter.verify(code, withOther, { filename: 'a.tsx' });
    expect(messages.map((m) => `${m.ruleId}:${m.severity}`).sort()).toEqual(['antd-a11y/modal-has-title:2', 'no-debugger:2']);

    // Without the processor, ESLint reports every finding as an error and doesn't read a11y-ignore.
    const plain = antdA11y.config({ configFile: false, parser, processor: false, failOn: 'critical' }) as Linter.Config[];
    expect(linter.verify(code, plain, { filename: 'a.tsx' }).map((m) => `${m.ruleId}:${m.severity}`)).toEqual([
      'antd-a11y/modal-has-title:2',
    ]);
  });

  it('fails loudly on a bad config when ESLint loads it', () => {
    expect(() => antdA11y.config({ configFile: false, rules: { 'jsx-a11y/typo': 'off' } })).toThrow(/unknown rule "jsx-a11y\/typo"/);
    expect(() => antdA11y.config({ configFile: false, failOn: 'loud' })).toThrow(/failOn: expected minor, moderate, serious, critical or none/);
  });
});
