import { describe as suite, expect, it } from 'vitest';
import { criterion, describe, fromAxeTags } from '../src/wcag.js';

suite('wcag', () => {
  it('names criteria with their level and W3C Understanding link', () => {
    expect(describe('4.1.2')).toBe('4.1.2 Name, Role, Value (A)');
    expect(describe('3.3.8')).toBe('3.3.8 Accessible Authentication (Minimum) (AA)');
    expect(criterion('1.4.3').url).toBe('https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum');
    expect(criterion('2.4.4').url).toBe('https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context');
    expect(describe('9.9.9')).toBe('9.9.9');
  });

  it('reads criteria from axe tags and skips level tags', () => {
    expect(fromAxeTags(['cat.forms', 'wcag2a', 'wcag412', 'wcag21aa', 'wcag111', 'wcag1410', 'wcag412'])).toEqual([
      '1.1.1',
      '1.4.10',
      '4.1.2',
    ]);
    expect(fromAxeTags(['wcag22aa', 'wcag258'])).toEqual(['2.5.8']);
    expect(fromAxeTags(undefined)).toEqual([]);
  });
});
