import * as core from '@actions/core';
import { IMPACTS, type Impact } from './types.js';

export type Mode = 'static' | 'theme' | 'runtime';
const MODES: readonly Mode[] = ['static', 'theme', 'runtime'];

// Declared in action.yml for the baseline layer; accepted but not used yet.
const RESERVED_INPUTS = ['baseline'];

export interface Inputs {
  modes: Mode[];
  failOn: Impact;
  changedOnly: boolean;
  include: string[];
  exclude: string[];
  workingDirectory: string;
  token: string;
  comment: boolean;
  sarifFile: string;
  /** Raw jsx-a11y preset input (recommended | strict | false); empty lets the config file decide. */
  jsxA11y: string;
  /** Per-rule severity lines, "rule-id: off|warn|error". */
  rules: string;
  /** jsx-a11y component mapping lines, "Name: tag". */
  components: string;
  aliases: string;
  /** JSON config file, relative to the repository root; used only if it exists. */
  configFile: string;
  maxAnnotations: number;
}

/** Splits on newlines and on commas outside `{}` so globs like `*.{ts,tsx}` survive. */
export function list(value: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '{') depth += 1;
    if (char === '}') depth = Math.max(0, depth - 1);
    if (char === '\n' || (char === ',' && depth === 0)) {
      items.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  items.push(current);
  return items.map((item) => item.trim()).filter(Boolean);
}

function bool(name: string, fallback: boolean): boolean {
  const raw = core.getInput(name).trim().toLowerCase();
  if (raw === '') return fallback;
  if (['true', 'yes', '1', 'on'].includes(raw)) return true;
  if (['false', 'no', '0', 'off'].includes(raw)) return false;
  throw new Error(`Input "${name}" must be true or false, got "${raw}".`);
}

export function readInputs(): Inputs {
  const modes = list(core.getInput('mode') || 'static').map((m) => m.toLowerCase());
  for (const mode of modes) {
    if (!MODES.includes(mode as Mode)) {
      throw new Error(`Unknown mode "${mode}". Use a comma-separated list of: ${MODES.join(', ')}.`);
    }
  }
  for (const mode of modes) {
    if (mode === 'runtime') {
      core.warning('mode "runtime" runs as its own step: add `uses: cstayyab/antd-a11y-action/runtime@v0`. This step runs "static" only.');
    } else if (mode !== 'static') {
      core.warning(`mode "${mode}" is not available yet in this release and will be skipped. Only "static" runs.`);
    }
  }
  for (const name of RESERVED_INPUTS) {
    if (core.getInput(name)) {
      core.warning(`Input "${name}" is reserved for the baseline layer and is ignored in this release.`);
    }
  }

  const failOn = (core.getInput('fail-on') || 'serious').toLowerCase() as Impact;
  if (!IMPACTS.includes(failOn)) {
    throw new Error(`Input "fail-on" must be one of ${IMPACTS.join(', ')}, got "${failOn}".`);
  }

  const maxAnnotations = Number(core.getInput('max-annotations') || '50');
  if (!Number.isInteger(maxAnnotations) || maxAnnotations < 0) {
    throw new Error('Input "max-annotations" must be a non-negative integer.');
  }

  return {
    modes: modes as Mode[],
    failOn,
    changedOnly: bool('changed-only', true),
    include: list(core.getInput('include') || '**/*.{js,jsx,ts,tsx}'),
    exclude: list(core.getInput('exclude')),
    workingDirectory: core.getInput('working-directory') || '.',
    token: core.getInput('github-token'),
    comment: bool('comment', true),
    sarifFile: core.getInput('sarif-file') || 'antd-a11y.sarif',
    jsxA11y: core.getInput('jsx-a11y'),
    rules: core.getInput('rules'),
    components: core.getInput('components'),
    aliases: core.getInput('aliases'),
    configFile: core.getInput('config') || '.github/antd-a11y.json',
    maxAnnotations,
  };
}
