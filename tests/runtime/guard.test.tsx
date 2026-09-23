// @vitest-environment jsdom
/**
 * The injected guard (runtime/guard): creation-time rules, post-render name checks, and
 * that patching React.createElement catches issues rendered inside antd components.
 */
import { act, render } from '@testing-library/react';
import { Button } from 'antd';
import React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { installA11yGuard } from '../../runtime/guard/src/client.js';
import { stats, wrap } from '../../runtime/guard/src/core.js';

type Violation = { rule: string; message: string; selector?: string; createdStack?: string };
const violations = () => ((window as unknown as { __A11Y_VIOLATIONS__?: Violation[] }).__A11Y_VIOLATIONS__ ?? []);
const rules = () => violations().map((v) => v.rule);

window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  (window as unknown as { __A11Y_VIOLATIONS__?: Violation[] }).__A11Y_VIOLATIONS__ = [];
});

describe('wrap: creation-time rules', () => {
  it('reports img without alt, but not alt="" or role="presentation"', () => {
    wrap('img', { src: 'a.png' });
    wrap('img', { src: 'b.png', alt: '' });
    wrap('img', { src: 'c.png', role: 'presentation' });
    expect(rules()).toEqual(['image-alt']);
  });

  it('reports iframe without title and positive tabIndex', () => {
    wrap('iframe', { src: '/x' });
    wrap('span', { tabIndex: 3 });
    wrap('span', { tabIndex: 0 });
    expect(rules()).toEqual(['frame-title', 'no-positive-tabindex']);
  });

  it('reports click handlers on non-interactive elements by what is missing', () => {
    const onClick = () => {};
    wrap('div', { onClick, 'data-case': 'no-role' });
    wrap('li', { onClick, role: 'button' });
    wrap('section', { onClick, role: 'button', tabIndex: 0, onKeyDown: onClick });
    expect(rules()).toEqual(['click-events-need-role', 'interactive-role-focusable', 'click-events-have-key-events']);
  });

  it('counts wraps, ignores components and never wraps the same props twice', () => {
    const before = stats.wraps;
    const props = wrap('button', { children: 'Save' });
    wrap('button', props);
    wrap(() => null, {});
    expect(stats.wraps).toBe(before + 1);
    expect(typeof props.ref).toBe('function');
  });
});

describe('installA11yGuard', () => {
  beforeAll(() => {
    installA11yGuard({ axe: false, patchCreateElement: true, patchJsxRuntime: true });
  });

  it('exposes interception stats on window', () => {
    expect((window as unknown as { __A11Y_GUARD__?: unknown }).__A11Y_GUARD__).toBe(stats);
  });

  it('catches an unnamed <button> rendered inside antd Button', async () => {
    const before = stats.createElement;
    render(React.createElement(Button, { icon: React.createElement('svg', { viewBox: '0 0 1 1' }) }));
    await act(() => new Promise((r) => setTimeout(r, 10)));
    expect(stats.createElement).toBeGreaterThan(before);
    const named = violations().filter((v) => v.rule === 'accessible-name');
    expect(named).toHaveLength(1);
    expect(named[0].selector).toContain('button.ant-btn');
    expect(named[0].createdStack).toBeTruthy();
  });

  it('stays quiet for a named Button and keeps user refs working', async () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(React.createElement('button', { ref, 'aria-label': 'Close' }));
    await act(() => new Promise((r) => setTimeout(r, 10)));
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(rules()).toEqual([]);
  });
});
