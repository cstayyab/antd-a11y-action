import { engine } from 'eslint-plugin-antd-a11y';

const { fingerprintAt, matchBaseline, updateBaseline, parseBaseline, serializeBaseline } = engine;

/** Fingerprint of the element that starts with `marker` in `code`. */
function fp(code: string, marker: string, extra?: Set<string>): string {
  const index = code.indexOf(marker);
  if (index < 0) throw new Error(`no ${marker}`);
  const before = code.slice(0, index).split('\n');
  return fingerprintAt({ code }, before.length, before.at(-1)!.length + 1, extra);
}

describe('fingerprints', () => {
  const base = `import { Modal, Select } from 'antd';
export const A = () => (
  <div>
    <Select options={opts} placeholder="Pick" />
    <Modal open={open} onCancel={close} className="big" />
  </div>
);`;

  it('survive code moving, reformatting and unrelated props', () => {
    const moved = `import { Modal, Select } from 'antd';
import { other } from './other';

export const A = () => (
  <section>
    <Select
      options={opts}
      placeholder="Pick"
      onChange={save}
    />
    <Modal   open={open}  onCancel={close} className="small" data-x="1" />
  </section>
);`;
    expect(fp(moved, '<Select')).toBe(fp(base, '<Select'));
    expect(fp(moved, '<Modal')).toBe(fp(base, '<Modal'));
  });

  it('change when an attribute the rules read changes', () => {
    expect(fp(base.replace('placeholder="Pick"', 'placeholder="Choose"'), '<Select')).not.toBe(fp(base, '<Select'));
    expect(fp(base.replace('<Modal open', '<Modal aria-label="x" open'), '<Modal')).not.toBe(fp(base, '<Modal'));
    expect(fp(base.replace('<Select', '<Select disabled'), '<Select')).not.toBe(fp(base, '<Select'));
  });

  it('count alias props as relevant', () => {
    const code = `const A = () => <HintTooltip asButton title="x"><span /></HintTooltip>;`;
    const without = fp(code, '<HintTooltip');
    expect(fp(code.replace(' asButton', ''), '<HintTooltip')).toBe(without);
    expect(fp(code.replace(' asButton', ''), '<HintTooltip', new Set(['asButton']))).not.toBe(fp(code, '<HintTooltip', new Set(['asButton'])));
  });

  it('point at the element when the finding is on an attribute', () => {
    const code = `const A = () => <Input.Password autoComplete="off" onPaste={(e) => e.preventDefault()} />;`;
    expect(fp(code, 'autoComplete')).toBe(fp(code, '<Input.Password'));
  });

  it('use the relevant keys of an object, e.g. a Table column', () => {
    const code = `const columns = [{ dataIndex: 'name', render: (v) => v, width: 100 }, { dataIndex: 'age' }];`;
    const reformatted = `const columns = [\n  {\n    dataIndex: 'name',\n    render: (value) => value,\n  },\n  { dataIndex: 'age' },\n];`;
    expect(fp(reformatted, "{\n    dataIndex: 'name'")).toBe(fp(code, "{ dataIndex: 'name'"));
    expect(fp(code, "{ dataIndex: 'age'")).not.toBe(fp(code, "{ dataIndex: 'name'"));
  });

  it('fall back to the line text when the file does not parse', () => {
    const broken = 'const A = () => <Select options={';
    expect(fp(broken, '<Select')).toMatch(/^[0-9a-f]{10}$/);
  });
});

const finding = (file: string, fingerprint: string, rule = 'antd-a11y/form-control-has-name') => ({ file, rule, fingerprint });
const entry = (file: string, fingerprint: string, count = 1, added = '2026-01-01', rule = 'antd-a11y/form-control-has-name') => ({ file, rule, fingerprint, count, added });
const scope = (scanned: string[], extra: Partial<engine.MatchScope> = {}): engine.MatchScope => ({
  scanned: new Set(scanned),
  dir: '',
  exists: () => true,
  ...extra,
});
const states = (m: engine.Match<ReturnType<typeof finding>>) => m.findings.map((f) => f.state);

describe('matchBaseline', () => {
  it('baselines up to the count per fingerprint; the rest are new', () => {
    const findings = [1, 2, 3, 4, 5].map(() => finding('a.tsx', 'loop'));
    const m = matchBaseline(findings, [entry('a.tsx', 'loop', 4)], scope(['a.tsx']));
    expect(states(m)).toEqual(['baselined', 'baselined', 'baselined', 'baselined', 'new']);
    expect(m.fixed).toEqual([]);
  });

  it('reports one fixed when one of four is removed, and nothing when they are reordered', () => {
    const three = matchBaseline([1, 2, 3].map(() => finding('a.tsx', 'loop')), [entry('a.tsx', 'loop', 4)], scope(['a.tsx']));
    expect(three.fixed).toEqual([{ ...entry('a.tsx', 'loop', 4), fixed: 1 }]);
    const reordered = matchBaseline([finding('a.tsx', 'x'), finding('a.tsx', 'loop'), finding('a.tsx', 'loop')], [entry('a.tsx', 'loop', 2), entry('a.tsx', 'x')], scope(['a.tsx']));
    expect(reordered.fixed).toEqual([]);
    expect(states(reordered)).toEqual(['baselined', 'baselined', 'baselined']);
  });

  it('tells two different issues in one file apart: fixing one and adding another is one fixed and one new', () => {
    const m = matchBaseline([finding('a.tsx', 'second')], [entry('a.tsx', 'first')], scope(['a.tsx']));
    expect(states(m)).toEqual(['new']);
    expect(m.fixed.map((e) => e.fingerprint)).toEqual(['first']);
  });

  it('only matches and fixes entries for scanned files, plus deleted ones', () => {
    const entries = [entry('a.tsx', 'x'), entry('b.tsx', 'y'), entry('gone.tsx', 'z')];
    const m = matchBaseline([], entries, scope(['a.tsx'], { exists: (f) => f !== 'gone.tsx' }));
    expect(m.fixed.map((e) => e.file)).toEqual(['a.tsx', 'gone.tsx']);
  });

  it('keeps a renamed file baselined', () => {
    const m = matchBaseline([finding('src/new.tsx', 'x')], [entry('src/old.tsx', 'x')], scope(['src/new.tsx'], { renames: new Map([['src/old.tsx', 'src/new.tsx']]), exists: (f) => f !== 'src/old.tsx' }));
    expect(states(m)).toEqual(['baselined']);
    expect(m.fixed).toEqual([]);
  });

  it('only reads entries under its working directory', () => {
    const entries = [entry('apps/web/a.tsx', 'x'), entry('apps/admin/a.tsx', 'x')];
    const m = matchBaseline([finding('apps/web/a.tsx', 'x')], entries, scope(['apps/web/a.tsx'], { dir: 'apps/web', exists: () => false }));
    expect(states(m)).toEqual(['baselined']);
    expect(m.fixed).toEqual([]);
  });
});

describe('updateBaseline', () => {
  const today = '2026-10-01';

  it('full: rewrites this directory from the scan, keeps added dates and other directories', () => {
    const entries = [entry('apps/web/a.tsx', 'kept', 1, '2025-05-05'), entry('apps/web/a.tsx', 'fixed'), entry('apps/admin/b.tsx', 'other')];
    const next = updateBaseline('full', [finding('apps/web/a.tsx', 'kept'), finding('apps/web/a.tsx', 'kept'), finding('apps/web/c.tsx', 'fresh')], entries, scope(['apps/web/a.tsx', 'apps/web/c.tsx'], { dir: 'apps/web' }), today);
    expect(next).toEqual([
      entry('apps/admin/b.tsx', 'other'),
      entry('apps/web/a.tsx', 'kept', 2, '2025-05-05'),
      entry('apps/web/c.tsx', 'fresh', 1, today),
    ]);
  });

  it('shrink: lowers counts and drops fixed entries, never adds', () => {
    const entries = [entry('a.tsx', 'loop', 4), entry('a.tsx', 'fixed'), entry('b.tsx', 'unscanned'), entry('gone.tsx', 'z')];
    const findings = [finding('a.tsx', 'loop'), finding('a.tsx', 'loop'), finding('a.tsx', 'brand-new')];
    const next = updateBaseline('shrink', findings, entries, scope(['a.tsx'], { exists: (f) => f !== 'gone.tsx' }), today);
    expect(next).toEqual([entry('a.tsx', 'loop', 2), entry('b.tsx', 'unscanned')]);
  });
});

describe('the baseline file', () => {
  it('serializes sorted and stable', () => {
    const text = serializeBaseline([entry('b.tsx', 'x'), entry('a.tsx', 'y'), entry('a.tsx', 'b', 1, '2026-01-01', 'antd-a11y/a')]);
    expect(JSON.parse(text).entries.map((e: { file: string; fingerprint: string }) => `${e.file}:${e.fingerprint}`)).toEqual(['a.tsx:b', 'a.tsx:y', 'b.tsx:x']);
    expect(serializeBaseline(parseBaseline(JSON.parse(text), 'x').entries)).toBe(text);
  });

  it('refuses a newer version, naming it', () => {
    expect(() => parseBaseline({ version: 2, entries: [] }, 'base.json')).toThrow(
      'base.json is baseline version 2, but this version of antd A11y Guard reads up to version 1. Upgrade the action',
    );
  });

  it.each([
    [[], 'expected a JSON object'],
    [{ entries: [] }, '"version" must be an integer'],
    [{ version: 1 }, '"entries" must be an array'],
    [{ version: 1, entries: [{ file: 'a', rule: 'x', fingerprint: 'f', count: 1, added: '2026-01-01' }] }, 'entries[0].rule must be a rule id'],
    [{ version: 1, entries: [{ file: 'a', rule: 'a/b', fingerprint: 'f', count: 0, added: '2026-01-01' }] }, 'entries[0].count must be a positive integer'],
    [{ version: 1, entries: [{ file: 'a', rule: 'a/b', fingerprint: 'f', count: 1, added: 'yesterday' }] }, 'entries[0].added must be a date'],
  ])('rejects malformed %j', (data, message) => {
    expect(() => parseBaseline(data, 'base.json')).toThrow(message);
  });
});
