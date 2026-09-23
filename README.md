# antd A11y Guard

A GitHub Action that blocks pull requests adding accessibility problems to React + [Ant Design](https://ant.design) apps. It catches the antd-specific ones that axe and `eslint-plugin-jsx-a11y` miss, because those tools only see plain JSX elements or rendered DOM.

> This release ships the **static** layer: 10 antd rules plus jsx-a11y's recommended set, with inline annotations, SARIF for Code Scanning and a sticky PR comment. The runtime (Playwright + axe) and theme contrast layers are next; see [Roadmap](#roadmap).

## Quick start

```yaml
# .github/workflows/a11y.yml
name: Accessibility
on: pull_request

permissions:
  contents: read
  pull-requests: write     # sticky PR comment
  security-events: write   # SARIF upload

jobs:
  antd-a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cstayyab/antd-a11y-action@v1
        id: a11y
      - uses: github/codeql-action/upload-sarif@v3
        if: always() && steps.a11y.outputs.sarif-file != ''
        with:
          sarif_file: ${{ steps.a11y.outputs.sarif-file }}
          category: antd-a11y
```

Nothing to install: the action ships its own parser and rules and ignores your ESLint config. It reads `.js`, `.jsx`, `.ts` and `.tsx` files.

## What it catches

| Rule | Catches | Impact |
| --- | --- | --- |
| [`icon-button-has-name`](docs/rules/icon-button-has-name.md) | Icon-only `Button` with no `aria-label` | critical · moderate if only the icon's English id names it |
| [`picker-has-name`](docs/rules/picker-has-name.md) | Unlabelled `Select`, `DatePicker`, `RangePicker`, `TimePicker`, `Cascader`, `TreeSelect`, `AutoComplete` | serious · moderate if placeholder-only |
| [`form-control-has-name`](docs/rules/form-control-has-name.md) | Unlabelled `Input*`, `InputNumber`, `Switch`, `Slider`, bare `Checkbox`/`Radio` | serious · moderate if placeholder-only |
| [`form-item-has-label`](docs/rules/form-item-has-label.md) | `Form.Item` with `name` but no `label` around an unnamed control | serious |
| [`modal-has-title`](docs/rules/modal-has-title.md) | `Modal` / `Drawer` without `title` (unnamed dialog) | serious |
| [`table-column-has-title`](docs/rules/table-column-has-title.md) | Table columns with a missing or empty `title` | moderate |
| [`image-has-alt`](docs/rules/image-has-alt.md) | antd `Image` without `alt` | serious |
| [`tooltip-no-disabled-child`](docs/rules/tooltip-no-disabled-child.md) | `Tooltip` / `Popover` around a disabled `Button` (keyboard can't reach it) | serious |
| [`popup-trigger-focusable`](docs/rules/popup-trigger-focusable.md) | `Dropdown` / `Tooltip` / `Popover` / `Popconfirm` on a `span`, icon, `Avatar`… | serious |
| [`auth-input-autocomplete`](docs/rules/auth-input-autocomplete.md) | `autoComplete="off"` or paste blocking on login fields (WCAG 2.2 3.3.8) | serious |

Impact uses axe-core's scale, and `fail-on` (default `serious`) decides what blocks the PR. Anything below the threshold still appears as a warning, in SARIF, and in the PR comment.

**Built to stay quiet when unsure.** A rule only reports on components it can trace back to an `antd` import (named, aliased, namespace, `antd/es/*`, or `const { Item } = Form`). Spread props, `id`s and custom children count as "may be labelled". Each rule's claim about antd's markup is also checked in CI by rendering real antd 5 and inspecting the DOM (`packages/eslint-plugin-antd-a11y/tests/dom`).

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `fail-on` | `serious` | Lowest impact that fails the check: `minor`, `moderate`, `serious`, `critical` |
| `changed-only` | `true` | On `pull_request` events, scan only files the PR adds or modifies. Other events scan everything. |
| `include` | `**/*.{js,jsx,ts,tsx}` | Globs relative to `working-directory` (comma or newline separated) |
| `exclude` | | Globs to skip. `node_modules`, `dist`, `build`, `coverage`, `.next` and `*.d.ts` are always skipped. |
| `working-directory` | `.` | Directory to scan, e.g. `apps/web` in a monorepo |
| `jsx-a11y` | `true` | Also run `eslint-plugin-jsx-a11y`'s recommended rules |
| `comment` | `true` | Post and update one sticky PR comment. Clean PRs get no comment. |
| `sarif-file` | `antd-a11y.sarif` | Where to write the SARIF report |
| `max-annotations` | `50` | Cap on inline annotations |
| `github-token` | `${{ github.token }}` | Used to list PR files and write the comment |
| `mode` | `static` | `theme` and `runtime` are accepted but skipped with a warning in this release |

`baseline`, `start-command`, `target-url` and `routes` are reserved for the runtime layer and ignored for now.

**Outputs:** `violations`, `blocking-violations`, `sarif-file`.

## Suppressing a finding

```jsx
<Toolbar aria-label="Row actions">
  {/* a11y-ignore icon-button-has-name -- the toolbar label covers it */}
  <Button icon={<MoreOutlined />} />
</Toolbar>

// a11y-ignore
const picker = <Select options={opts} />;

// eslint-disable-next-line antd-a11y/modal-has-title
const dialog = <Modal open={open} />;
```

An `a11y-ignore` comment covers its own line and the next one. Name rules to ignore only those; a bare `a11y-ignore` covers all of them. The PR comment shows how many findings were suppressed.

## Using the rules in your editor

The rules are also published as a standalone ESLint plugin, so you can catch the same problems before they reach a PR:

```js
// eslint.config.js
import antdA11y from 'eslint-plugin-antd-a11y';

export default [antdA11y.configs.recommended];
```

## Roadmap

| Phase | Scope |
| --- | --- |
| **MVP (this release)** | 10 static antd rules, SARIF, sticky PR comment, changed-files mode |
| v1 | Runtime axe scan of app routes (`start-command` + `target-url` + `routes`, Storybook later), baseline file, theme-token contrast audit |
| v1.1 | WCAG 2.2 runtime checks (focus not obscured, target size), auth via Playwright `storageState` |
| v2 | Autofix via suggested changes, antd v4/v5/v6 support matrix |

## Development

```sh
npm ci
npm run check   # typecheck + lint + tests (rule tests and antd DOM checks)
npm run build   # bundles the action into dist/ (commit the result)
```

---

Not affiliated with or endorsed by Ant Group or the Ant Design team. "Ant Design" and "antd" are used only to describe compatibility.

## License

[MIT](LICENSE)
