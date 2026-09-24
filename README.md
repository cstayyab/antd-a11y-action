# antd A11y Guard

A GitHub Action that blocks pull requests adding accessibility problems to React + [Ant Design](https://ant.design) apps. It catches the antd-specific ones that axe and `eslint-plugin-jsx-a11y` miss, because those tools only see plain JSX elements or rendered DOM.

> Two layers: the **static** action (10 antd rules plus jsx-a11y's recommended set, on changed files) and the **[runtime check](#runtime-check)** sub-action (starts your app, crawls routes with Playwright + axe, and in Next.js apps blames issues on the source line that rendered them). Both report through inline annotations, SARIF for Code Scanning and a sticky PR comment. The theme contrast layer is next; see [Roadmap](#roadmap).

> **Beta (0.x).** `@v0` is a branch that moves to each 0.x release, so pinning it gets fixes automatically. To stay on one version, pin a release tag (`@v0.9.5`) or a commit SHA. Inputs may still change between minor versions until 1.0, which ships once the baseline file and theme audit land; see [Roadmap](#roadmap) and the release notes before upgrading.

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
      - uses: cstayyab/antd-a11y-action@v0
        id: a11y
      - uses: github/codeql-action/upload-sarif@v3
        if: always() && steps.a11y.outputs.sarif-file != ''
        with:
          sarif_file: ${{ steps.a11y.outputs.sarif-file }}
          category: antd-a11y
```

Nothing to install: the action ships its own parser and rules and ignores your ESLint config. It reads `.js`, `.jsx`, `.ts` and `.tsx` files.

**Supports antd 5 and 6.** The rules behave the same on both, and CI checks every rule against the rendered DOM of each major.

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
| [`tooltip-no-disabled-child`](docs/rules/tooltip-no-disabled-child.md) | `Tooltip` / `Popover` around a disabled `Button`, directly or through a `<span>` wrapper (keyboard can't reach it) | serious |
| [`popup-trigger-focusable`](docs/rules/popup-trigger-focusable.md) | `Dropdown` / `Tooltip` / `Popover` / `Popconfirm` on a `span`, icon, `Avatar`… | serious |
| [`auth-input-autocomplete`](docs/rules/auth-input-autocomplete.md) | `autoComplete="off"` or paste blocking on login fields (WCAG 2.2 3.3.8) | serious |

Every finding names the WCAG 2.2 success criteria it fails, with level and a link to W3C's Understanding page: in the annotation, the PR comment's WCAG column, and the SARIF rule help. Runtime axe findings take theirs from axe's own tags.

Impact uses axe-core's scale, and `fail-on` (default `serious`) decides what blocks the PR. Anything below the threshold still appears as a warning, in SARIF, and in the PR comment.

**Built to stay quiet when unsure.** A rule only reports on components it can trace back to an `antd` import (named, aliased, namespace, `antd/es/*`, or `const { Item } = Form`). In-house wrappers around antd components are invisible to the rules until you declare them; see [Wrapper components](#wrapper-components). Spread props, `id`s and custom children count as "may be labelled". Each rule's claim about antd's markup is also checked in CI by rendering real antd and inspecting the DOM (`packages/eslint-plugin-antd-a11y/tests/dom`).

**jsx-a11y, tuned.** The jsx-a11y layer runs the recommended set with a few precision changes:

- `control-has-associated-label` is on, so `<button><svg/></button>` is caught.
- `no-autofocus` is off.
- `no-redundant-roles` allows `role="list"` on `ul`/`ol`, which restores list semantics that Safari drops.
- Filters drop reports jsx-a11y can't see past:
  - a spread (dnd-kit's `{...attributes}`) that may supply the role or `tabIndex`
  - a conditional role with an interactive branch (`role={x ? 'button' : undefined}`)
  - key handlers on `role="dialog"`, `alertdialog`, `group` or `tabpanel`
  - an icon component with a `title`

  Rule ids and messages are unchanged, and the filters apply whatever you configure.

When an antd rule and a jsx-a11y rule flag the same element, only the antd finding is kept.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `fail-on` | `serious` | Lowest impact that fails the check: `minor`, `moderate`, `serious`, `critical` |
| `changed-only` | `true` | On `pull_request` events, scan only files the PR adds or modifies. Other events scan everything. |
| `include` | `**/*.{js,jsx,ts,tsx}` | Globs relative to `working-directory` (comma or newline separated) |
| `exclude` | | Globs to skip. `node_modules`, `dist`, `build`, `coverage`, `.next` and `*.d.ts` are always skipped. |
| `working-directory` | `.` | Directory to scan, e.g. `apps/web` in a monorepo |
| `jsx-a11y` | `recommended` | `eslint-plugin-jsx-a11y` preset: `recommended` (tuned, see above), `strict`, or `false`. `true` means `recommended`. |
| `components` | | Map your own components to the element they render, one `Name: tag` per line (`Icon: svg`, `Link: a`), so jsx-a11y checks them. `FontAwesomeIcon: svg` is built in. antd components need no mapping. |
| `rules` | | Per-rule severity, one `rule-id: off\|warn\|error` per line. See [Configuration](#configuration). |
| `aliases` | | In-house wrappers around antd components, one `WrapperName: AntdComponent` per line. See [Wrapper components](#wrapper-components). |
| `config` | `.github/antd-a11y.json` | JSON config file, used when it exists. See [Configuration](#configuration). |
| `comment` | `true` | Post and update one sticky PR comment. Clean PRs get no comment. |
| `sarif-file` | `antd-a11y.sarif` | Where to write the SARIF report |
| `max-annotations` | `50` | Cap on inline annotations |
| `github-token` | `${{ github.token }}` | Used to list PR files and write the comment |
| `mode` | `static` | `theme` and `runtime` are accepted but skipped with a warning in this release |

`baseline` is reserved for the baseline layer and ignored for now. The runtime check is a separate step; see below.

**Outputs:** `violations`, `blocking-violations`, `sarif-file`.

## Configuration

Per-rule severity works in both actions:

- `off` turns the rule off.
- `warn` reports its findings but never blocks.
- `error` blocks on every finding, whatever its impact or `fail-on`.

Every other rule follows `fail-on`. Ids are `antd-a11y/<rule>` (or just `<rule>`), `jsx-a11y/<rule>`, `runtime/<rule>` and `axe/<rule-id>`.

```yaml
      - uses: cstayyab/antd-a11y-action@v0
        with:
          rules: |
            jsx-a11y/anchor-is-valid: off
            picker-has-name: warn            # 40 existing violations, fixing them over time
            modal-has-title: error           # at zero, keep it there
```

That is a ratchet. Set `error` on rules your codebase is clean on, so they can't regress. Set `warn` on rules with a backlog, so they are visible without blocking. When a backlog reaches zero, flip its rule to `error`.

For rule options and jsx-a11y settings, use a config file. The action reads `.github/antd-a11y.json` when it exists (the `config` input changes the path):

```json
{
  "jsxA11y": "recommended",
  "rules": {
    "jsx-a11y/no-autofocus": ["error", { "ignoreNonDOM": true }],
    "jsx-a11y/anchor-is-valid": "off",
    "antd-a11y/picker-has-name": "warn",
    "axe/color-contrast": "warn"
  },
  "settings": {
    "components": { "Link": "a", "Icon": "svg" },
    "polymorphicPropName": "as"
  }
}
```

Rules take a severity, or `[severity, options]` as in ESLint. The options go to the rule unchanged; only antd-a11y and jsx-a11y rules take them. Unlike ESLint, a bare severity keeps the options the preset sets (recommended's exemptions for `onLoad` on `img`, expression values for `tabIndex`), so `"warn"` never makes a rule stricter. `settings` is jsx-a11y's (`components`, `polymorphicPropName`, `attributes`). Workflow inputs override the file, and the file overrides the defaults. The runtime action reads the same file's `runtime/*` and `axe/*` rules.

Guardrails:

- The action never reads your ESLint config, so a permissive or broken `.eslintrc` can't switch it off.
- An unknown rule id, or options a rule's schema rejects, fails the step. A typo never silently disables a rule.
- Turning off every antd rule logs a warning.
- The PR comment footer lists the overrides (e.g. "3 rules overridden (`.github/antd-a11y.json`): 2 off, 1 warn"), so reviewers can see when the gate was loosened.

### Wrapper components

If your codebase wraps antd components (`HintTooltip` around `Tooltip`, `TextField` around `Input`), the rules skip the wrappers, because they only trust what they can trace to an `antd` import. Declare the wrappers so the rules check them as the component they wrap:

```yaml
      - uses: cstayyab/antd-a11y-action@v0
        with:
          aliases: |
            HintTooltip: Tooltip
            TextField: Input
```

A wrapper often handles some rules itself, sometimes only when it gets a certain prop. Describe that in the config file, so those call sites aren't reported:

```json
{
  "aliases": {
    "TextField": {
      "as": "Input",
      "name": ["label:string", "ariaLabel"],
      "props": { "ariaLabel": "aria-label" }
    },
    "HintTooltip": {
      "as": "Tooltip",
      "satisfies": { "popup-trigger-focusable": "asButton" }
    },
    "UI.Field": { "as": "Form.Item", "except": ["form-item-has-label"] }
  }
}
```

- `name`: when the wrapper renders its own accessible name. Every rule that asks whether a control is named honours it: `form-control-has-name`, `picker-has-name`, `form-item-has-label` and `icon-button-has-name`. Declare naming here, not per rule. A `Form.Item` without a `label` is reported when its control has no name, so a condition given only to `form-control-has-name` leaves `<Form.Item name="email"><TextField label="Email" /></Form.Item>` reported as unlabelled. The action warns about aliases set up that way.
- `props`: props the wrapper forwards under another name, such as a camelCase `ariaLabel` passed on as `aria-label`. The rules then read `ariaLabel` wherever they would read `aria-label`.
- `satisfies`: a condition, per rule, under which the wrapper meets that rule itself. `asButton` above renders a real `<button>` around the trigger, so the trigger can take focus.
- Conditions read the wrapper's props:
  - `prop`: the prop is present and not `false` or empty (`asButton`, `asButton={true}`).
  - `!prop`: the prop is absent, `false` or empty.
  - `prop:string`: the prop is a non-empty string. `label="Email"` meets it; `label={<Trans>Email</Trans>}` doesn't, so that call site is checked like a bare `Input`.

  A list of conditions holds when any one of them does. When a value can't be read statically (a variable, a function call, a spread), the rule stays quiet.
- `only` or `except` limit which rules apply to the wrapper at all.
- Wrappers matter inside triggers too: `popup-trigger-focusable` counts an antd `Button` or `Input` inside a trigger as focusable, but your own `Button` wrapper only once it's aliased (`"ToolbarButton": "Button"`).
- Aliases match imported components only. A component defined in the same file with the same name is left alone. On a full scan, an alias that matches no tag logs a warning, so typos surface.
- Workflow input lines replace the file's entry for that wrapper.

The runtime check sees through wrappers without configuration, but only for what axe and the guard check in the rendered page: missing names on inputs, buttons and images. The tooltip and popup rules (`tooltip-no-disabled-child`, `popup-trigger-focusable`) are static only, so for them an alias is the only way to cover a wrapper.

### What the static rules can't see

The rules read JSX, not the rendered page, so props that a component adds at runtime are invisible to them. A common case: antd's `Dropdown` with `disabled` clones its trigger and sets `disabled` on it. Here the `Button` is unreachable by keyboard in the browser, even though the JSX gives it only `aria-disabled`:

```jsx
<Tooltip title={atMax ? reason : ''} trigger={['hover', 'focus']}>
  <span>
    <Dropdown disabled={atMax} menu={menu}>
      <Button aria-disabled={atMax}>Add</Button>
    </Dropdown>
  </span>
</Tooltip>
```

Neither rule reports this: the JSX shows an enabled `Button` inside the `span`, which is keyboard-reachable as written. To keep the trigger focusable, control the popup's `open` rather than passing `disabled`. The same applies to any component, antd's or your own, that clones its child and sets props on it.

A component that renders its trigger as `<span>{children}</span>` is reported even when every current caller passes a focusable element, because the rule can't see the callers, and a future caller passing plain text would break keyboard access. Treat it as a finding about the component's contract: render a focusable trigger, or suppress it at that site with the contract in the reason.

The rules also can't see context outside the element they check. A tooltip trigger inside an element that is itself focusable, such as a `<span>` inside antd's `role="tab"`, is reported by `popup-trigger-focusable` even though the tab takes focus. Suppress it at that site with `// a11y-ignore popup-trigger-focusable -- the tab is the focus stop`.

## Runtime check

The static rules read your source. The runtime check starts the app and looks at what actually renders, including markup inside antd and other libraries, portals and client-side state. Add it as its own job:

```yaml
  antd-a11y-runtime:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      contents: read
      pull-requests: write
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - uses: cstayyab/antd-a11y-action/runtime@v0
        id: runtime
        env:
          NEXT_PUBLIC_API_URL: https://staging.example.com   # anything the app needs at dev time
        with:
          routes: |            # dynamic routes need concrete URLs
            /products/demo-product
          exclude-routes: |
            ^/admin
          interactions: .github/a11y-interactions.mjs
      - uses: github/codeql-action/upload-sarif@v3
        if: always() && steps.runtime.outputs.sarif-file != ''
        with:
          sarif_file: ${{ steps.runtime.outputs.sarif-file }}
          category: antd-a11y-runtime
```

It runs in one of two modes (`framework: auto` picks for you):

| Mode | When | What you get |
| --- | --- | --- |
| **Next.js** | `next` 15.3+ installed and no `start-command` | Runs `next dev --turbopack` and injects a guard through `instrumentation-client` (working tree only; nothing is committed). The guard patches `React.createElement` and the JSX runtime, so issues inside antd components are blamed on **your** line that used the component, and issues in your own markup on the line that wrote it. Also crawls every static App Router page, then runs axe. |
| **Generic** | Any other app | Starts `start-command` (or uses an app already running at `target-url`), crawls `routes` (default `/`) and runs axe. Findings point at DOM selectors, not source lines. |

Only rendered UI is checked. To audit modals, dropdowns and tabs, open them in an `interactions` module:

```js
// .github/a11y-interactions.mjs
export default async function ({ page, route }) {
  if (route === '/settings') {
    await page.getByRole('tab', { name: 'Billing' }).click();
    await page.getByRole('button', { name: 'Add card' }).click();
  }
}
```

### Signed-in pages

The action starts the app itself, so sign in with a `setup` module. It runs once, after the app is up and before any route, and every route then reuses the browser session it leaves behind:

```js
// .github/a11y-setup.mjs
export default async function ({ page }) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.A11Y_USER);
  await page.getByLabel('Password').fill(process.env.A11Y_PASS);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
}
```

```yaml
      - uses: cstayyab/antd-a11y-action/runtime@v0
        env:
          A11Y_USER: ${{ secrets.A11Y_USER }}
          A11Y_PASS: ${{ secrets.A11Y_PASS }}
        with:
          setup: .github/a11y-setup.mjs
          fail-on-redirect: true
```

Because setup signs in against the app the action started, cookies match its host. If you already have a session file for that host, pass it as `storage-state` instead (setup starts from it when both are set). The saved session stays in the runner's temp folder and is never uploaded with the results.

Every route records where it actually landed. A route that ends up on another path (say `/account` → `/login` because the session was missing or expired) is listed in the report, and its findings are labelled with both paths, since they describe the page it landed on. `fail-on-redirect: true` fails the job instead; exclude routes that redirect on purpose with `exclude-routes`.

| Input | Default | Description |
| --- | --- | --- |
| `framework` | `auto` | `auto`, `next` or `generic` |
| `working-directory` | `.` | App directory; install its dependencies first |
| `start-command` | | Command that starts the app (generic), or overrides `next dev` (Next) |
| `target-url` | `http://localhost:3000` | Base URL in generic mode |
| `port` | `3100` | Next dev server port |
| `routes` | | Routes to crawl, one per line |
| `exclude-routes` | | Regexes, one per line |
| `discover-routes` | `true` | Crawl static App Router pages (Next mode) |
| `max-routes` | `50` | Cap on routes |
| `storage-state` | | Playwright `storageState` JSON for signed-in pages |
| `interactions` | | ESM module run on each route before scanning |
| `setup` | | ESM module run once before the crawl, e.g. to sign in; its session is reused for every route |
| `fail-on-redirect` | `false` | Fail when a route ends up on a different path (e.g. `/login`) |
| `wcag-tags` | `wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa` | axe tags |
| `fail-on` | `serious` | `minor`, `moderate`, `serious`, `critical` or `none` |
| `require-guard` | `true` | Next mode: fail if the guard intercepted nothing |
| `comment` | `true` | Sticky PR comment (separate from the static one) |
| `sarif-file` | `antd-a11y-runtime.sarif` | Only findings mapped to a source file go into SARIF |
| `artifact-name` | `antd-a11y-runtime` | Per-route JSON results are uploaded under this name |
| `rules` | | Per-rule severity for `runtime/*` and `axe/*` ids (`axe/color-contrast: warn`); see [Configuration](#configuration) |
| `config` | `.github/antd-a11y.json` | Config file shared with the static action |

**Outputs:** `total`, `blocking`, `critical`, `serious`, `guard-active`, `redirects`, `sarif-file`.

**Before you adopt it**

- The check runs the pull request's code with a dev server. Use it on `pull_request`, never on `pull_request_target`.
- In Next mode the guard is written into the working tree. If a later step in the **same job** builds or deploys the app, it would pick it up: keep the check in its own job, or run `git checkout -- . && git clean -fdx -- .a11y-guard '*instrumentation-client*'` in the app directory after it.
- Guard requirements: Next 15.3+ (for `instrumentation-client`) and React 19.1+ (for `captureOwnerStack`; older React still works, without source lines). Verified on Next 15.5 and 16.3 (CI runs both); Next 17+ logs a warning until verified.
- Server Components never render in the browser, so only axe sees them (no source line).
- A library's own markup choices (for example antd's modal mask closing on click) are reported as minor, since app code can't change them.

| Symptom | Fix |
| --- | --- |
| Route times out | Lower `max-routes` or raise the job's `timeout-minutes`; the first hit compiles the route |
| Routes redirect to login | Sign in with a `setup` module; the report lists every redirect, and `fail-on-redirect: true` makes them fail the job |
| "The setup module failed" | The report shows its error. Setup runs in a real browser: wait for the URL or element that proves you are signed in |
| `next dev --turbopack` fails | Set `start-command: npx next dev --webpack -p 3100` (Next 16) or `npx next dev -p 3100` (Next 15) to use webpack |
| "Guard did not intercept any renders" | Check the inject step log; `instrumentation-client` must sit where Next expects it (root, or `src/`) |
| Comment step skipped on fork PRs | Expected: forks get a read-only token. The job summary and artifact still have everything |

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

An `a11y-ignore` comment covers its own line and the next one. Name rules to ignore only those; a bare `a11y-ignore` covers all of them. Put the reason after `--`. It can run over several lines, and the directive then covers the element right after the comment:

```jsx
{/* a11y-ignore popup-trigger-focusable -- the radio card is the focus stop,
    and a visually hidden sibling already carries the text */}
<span className="method-info" aria-hidden="true">i</span>
```

The PR comment shows how many findings were suppressed.

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
| **MVP** | 10 static antd rules, SARIF, sticky PR comment, changed-files mode |
| **v1 (in progress)** | Done: runtime check (Next.js guard + axe, generic axe crawl) with sign-in and redirect detection (0.9.0); WCAG criteria on every finding and per-rule configuration (0.9.1); wrapper component aliases (0.9.2, refined in 0.9.3). Next: [baseline file](https://github.com/cstayyab/antd-a11y-action/issues/1), theme-token contrast audit, Storybook stories |
| v1.1 | WCAG 2.2 runtime checks (focus not obscured, target size) |
| v2 | Autofix via suggested changes, antd v4 support |

## Development

```sh
npm ci
npm ci --prefix runtime   # runner deps for the runtime sub-action
npm run check   # typecheck + lint + tests (rules, DOM checks against antd 5 and 6, runtime)
npm run build   # bundles the action into dist/ (commit the result)
```

---

Not affiliated with or endorsed by Ant Group or the Ant Design team. "Ant Design" and "antd" are used only to describe compatibility.

## License

[MIT](LICENSE)
