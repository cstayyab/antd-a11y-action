// @vitest-environment jsdom
/**
 * Each static rule makes a claim about what antd renders ("this Select has no
 * accessible name", "this Modal renders an unnamed dialog"). These tests render
 * the same snippets with real antd and check the claim in the DOM, so a rule
 * can't silently turn into a false positive when antd changes its markup.
 */
import { cleanup, render } from '@testing-library/react';
import axe from 'axe-core';
import { computeAccessibleName } from 'dom-accessibility-api';
import type { ReactElement } from 'react';
import {
  Button,
  Checkbox,
  DatePicker,
  Drawer,
  Dropdown,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Select,
  Slider,
  Switch,
  Table,
  Tooltip,
} from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { afterEach, describe, expect, it } from 'vitest';

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

afterEach(cleanup);

function mount(element: ReactElement): HTMLElement {
  return render(element).container;
}

function nameOf(container: HTMLElement, selector: string): string {
  const el = container.querySelector(selector);
  if (!el) throw new Error(`No element matches ${selector}:\n${container.innerHTML.slice(0, 500)}`);
  return computeAccessibleName(el).trim();
}

async function axeViolations(container: HTMLElement, rules: string[]): Promise<string[]> {
  const result = await axe.run(container, { runOnly: { type: 'rule', values: rules } });
  return result.violations.map((v) => v.id);
}

function isKeyboardFocusable(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if ((el as HTMLButtonElement).disabled) return false;
  return el.tabIndex >= 0;
}

describe('icon-button-has-name', () => {
  it('missing: a Button with a bare svg icon has no name', async () => {
    const c = mount(<Button icon={<svg viewBox="0 0 1 1" />} />);
    expect(nameOf(c, 'button')).toBe('');
    expect(await axeViolations(c, ['button-name'])).toContain('button-name');
  });
  it('iconLabelOnly: an antd icon names the Button with its English icon id', () => {
    const c = mount(<Button icon={<DeleteOutlined />} />);
    expect(nameOf(c, 'button')).toBe('delete');
  });
  it('valid: aria-label wins', () => {
    const c = mount(<Button icon={<DeleteOutlined />} aria-label="Delete row" />);
    expect(nameOf(c, 'button')).toBe('Delete row');
  });
});

describe('picker-has-name', () => {
  it('missing: Select placeholder is not exposed as a name', () => {
    const c = mount(<Select placeholder="Country" options={[{ value: 'pk', label: 'Pakistan' }]} />);
    expect(nameOf(c, '[role="combobox"]')).toBe('');
  });
  it('placeholderOnly: DatePicker is named only by its default placeholder', async () => {
    const c = mount(<DatePicker />);
    // Browsers and axe fall back to the placeholder; dom-accessibility-api does not.
    expect(nameOf(c, 'input')).toBe('');
    expect(c.querySelector('input')?.getAttribute('placeholder')).toBe('Select date');
    expect(await axeViolations(c, ['label'])).toEqual([]);
  });
  it('valid: aria-label reaches the combobox', () => {
    const c = mount(<Select aria-label="Country" />);
    expect(nameOf(c, '[role="combobox"]')).toBe('Country');
  });
  it('valid: a labelled Form.Item with name labels the Select', () => {
    const c = mount(
      <Form>
        <Form.Item label="Country" name="country">
          <Select />
        </Form.Item>
      </Form>,
    );
    expect(nameOf(c, '[role="combobox"]')).toBe('Country');
  });
});

describe('form-control-has-name', () => {
  it.each([
    ['Input', <Input key="i" />, 'input'],
    ['InputNumber', <InputNumber key="n" />, 'input'],
    ['Switch', <Switch key="s" />, '[role="switch"]'],
    ['Slider', <Slider key="sl" />, '[role="slider"]'],
    ['Checkbox', <Checkbox key="c" />, 'input[type="checkbox"]'],
  ])('missing: bare %s has no name', (_label, element, selector) => {
    expect(nameOf(mount(element), selector)).toBe('');
  });
  it('missing: bare Input fails axe label', async () => {
    expect(await axeViolations(mount(<Input />), ['label'])).toContain('label');
  });
  it('placeholderOnly: Input placeholder is the only (fallback) name', async () => {
    const c = mount(<Input placeholder="Search" />);
    expect(nameOf(c, 'input')).toBe('');
    expect(c.querySelector('input')?.getAttribute('placeholder')).toBe('Search');
    expect(await axeViolations(c, ['label'])).toEqual([]);
  });
  it.each([
    ['Input aria-label', <Input key="i" aria-label="Search" />, 'input', 'Search'],
    ['Switch aria-label', <Switch key="s" aria-label="Dark mode" />, '[role="switch"]', 'Dark mode'],
    ['Slider ariaLabelForHandle', <Slider key="sl" ariaLabelForHandle="Volume" />, '[role="slider"]', 'Volume'],
    ['Checkbox text', <Checkbox key="c">Remember me</Checkbox>, 'input[type="checkbox"]', 'Remember me'],
  ])('valid: %s', (_label, element, selector, expected) => {
    expect(nameOf(mount(element), selector)).toBe(expected);
  });
  it('valid: Switch checkedChildren/unCheckedChildren give it a text name', () => {
    // jsdom has no CSS, so both states' text is visible here; a browser reads only the active one.
    const c = mount(<Switch checkedChildren="On" unCheckedChildren="Off" />);
    expect(nameOf(c, '[role="switch"]')).not.toBe('');
  });
});

describe('form-item-has-label', () => {
  it('missing: Form.Item with name and no label leaves the input unnamed', () => {
    const c = mount(
      <Form>
        <Form.Item name="email">
          <Input />
        </Form.Item>
      </Form>,
    );
    expect(nameOf(c, 'input')).toBe('');
  });
  it('valid: label + name associates the label', () => {
    const c = mount(
      <Form>
        <Form.Item name="email" label="Email">
          <Input />
        </Form.Item>
      </Form>,
    );
    expect(nameOf(c, 'input')).toBe('Email');
  });
});

describe('modal-has-title', () => {
  it('missing: Modal without title renders an unnamed dialog', async () => {
    const c = mount(
      <Modal open getContainer={false}>
        Body
      </Modal>,
    );
    expect(nameOf(c, '[role="dialog"]')).toBe('');
    expect(await axeViolations(c, ['aria-dialog-name'])).toContain('aria-dialog-name');
  });
  it('missing: Drawer without title renders an unnamed dialog', () => {
    const c = mount(
      <Drawer open getContainer={false}>
        Body
      </Drawer>,
    );
    expect(nameOf(c, '[role="dialog"]')).toBe('');
  });
  it('valid: title names Modal and Drawer via aria-labelledby', () => {
    const modal = mount(
      <Modal open title="Delete item" getContainer={false}>
        Body
      </Modal>,
    );
    expect(nameOf(modal, '[role="dialog"]')).toBe('Delete item');
    cleanup();
    const drawer = mount(
      <Drawer open title="Filters" getContainer={false}>
        Body
      </Drawer>,
    );
    expect(nameOf(drawer, '[role="dialog"]')).toBe('Filters');
  });
});

describe('table-column-has-title', () => {
  it('missing: a column without title renders an empty header cell', async () => {
    const c = mount(
      <Table
        pagination={false}
        columns={[{ title: 'Name', dataIndex: 'name' }, { key: 'actions', render: () => 'Edit' }]}
        dataSource={[{ key: 1, name: 'Ada' }]}
      />,
    );
    const headers = [...c.querySelectorAll('th')].map((th) => th.textContent?.trim());
    expect(headers).toEqual(['Name', '']);
    expect(await axeViolations(c, ['empty-table-header'])).toContain('empty-table-header');
  });
});

describe('image-has-alt', () => {
  it('missing: antd Image without alt renders <img> without alt', async () => {
    const c = mount(<Image src="photo.png" preview={false} />);
    expect(c.querySelector('img')?.hasAttribute('alt')).toBe(false);
    expect(await axeViolations(c, ['image-alt'])).toContain('image-alt');
  });
  it('valid: alt="" passes through as decorative', async () => {
    const c = mount(<Image src="photo.png" alt="" preview={false} />);
    expect(c.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(await axeViolations(c, ['image-alt'])).toEqual([]);
  });
});

describe('tooltip-no-disabled-child', () => {
  it('disabled: nothing in the Tooltip trigger can take focus', () => {
    const c = mount(
      <Tooltip title="You need edit rights">
        <Button disabled>Edit</Button>
      </Tooltip>,
    );
    const focusable = [...c.querySelectorAll('*')].filter(isKeyboardFocusable);
    expect(focusable).toEqual([]);
  });
});

describe('popup-trigger-focusable', () => {
  it('notFocusable: a span trigger is not keyboard focusable', () => {
    const c = mount(
      <Dropdown menu={{ items: [{ key: '1', label: 'Rename' }] }}>
        <span>Actions</span>
      </Dropdown>,
    );
    expect(isKeyboardFocusable(c.querySelector('span'))).toBe(false);
  });
  it('notFocusable: an antd icon trigger is not keyboard focusable', () => {
    const c = mount(
      <Tooltip title="Delete">
        <DeleteOutlined />
      </Tooltip>,
    );
    expect(isKeyboardFocusable(c.querySelector('[role="img"]'))).toBe(false);
  });
  it('valid: a Button trigger is focusable', () => {
    const c = mount(
      <Dropdown menu={{ items: [{ key: '1', label: 'Rename' }] }}>
        <Button>Actions</Button>
      </Dropdown>,
    );
    expect(isKeyboardFocusable(c.querySelector('button'))).toBe(true);
  });
});

describe('auth-input-autocomplete', () => {
  it('autocompleteOff: antd forwards autoComplete="off" to the native input', () => {
    const c = mount(<Input.Password autoComplete="off" />);
    expect(c.querySelector('input')?.getAttribute('autocomplete')).toBe('off');
  });
  it('valid: current-password reaches the native input', () => {
    const c = mount(<Input.Password autoComplete="current-password" />);
    expect(c.querySelector('input')?.getAttribute('autocomplete')).toBe('current-password');
  });
});
