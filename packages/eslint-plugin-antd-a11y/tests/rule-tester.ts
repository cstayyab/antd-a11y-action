import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { afterAll, describe, it } from 'vitest';

// ESLint's RuleTester picks these up so each case becomes a vitest test.
Object.assign(RuleTester, { describe, it, itOnly: it.only, afterAll });

export const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

/** Prefix used by most cases so the components resolve to antd. */
export const IMPORTS = `import { Button, Select, DatePicker, Input, InputNumber, Switch, Slider, Checkbox, Radio, Form, Modal, Drawer, Table, Image, Tooltip, Popover, Dropdown, Avatar } from 'antd';
import { DeleteOutlined, DownOutlined } from '@ant-design/icons';
`;

type Cases = Parameters<RuleTester['run']>[2];

export function run(name: string, rule: unknown, cases: Cases): void {
  ruleTester.run(name, rule as Parameters<RuleTester['run']>[1], cases);
}

export const withImports = (code: string): string => IMPORTS + code;
