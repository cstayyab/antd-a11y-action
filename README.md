# antd A11y Guard

A GitHub Action that blocks pull requests adding accessibility problems to React + [Ant Design](https://ant.design) apps. It catches the antd-specific ones that axe and `eslint-plugin-jsx-a11y` miss, because those tools only see plain JSX elements or rendered DOM.

> Two layers: the **static** action (10 antd rules plus jsx-a11y's recommended set, on changed files) and the **[runtime check](#runtime-check)** sub-action (starts your app, crawls routes with Playwright + axe, and in Next.js apps blames issues on the source line that rendered them). Both report through inline annotations, SARIF for Code Scanning and a sticky PR comment. The theme contrast layer is next; see [Roadmap](#roadmap).

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
| [`tooltip-no-disabled-child`](docs/rules/tooltip-no-disabled-child.md) | `Tooltip` / `Popover` around a disabled `Button` (keyboard can't reach it) | serious |
| [`popup-trigger-focusable`](docs/rules/popup-trigger-focusable.md) | `Dropdown` / `Tooltip` / `Popover` / `Popconfirm` on a `span`, icon, `Avatar`… | serious |
| [`auth-input-autocomplete`](docs/rules/auth-input-autocomplete.md) | `autoComplete="off"` or paste blocking on login fields (WCAG 2.2 3.3.8) | serious |

Impact uses axe-core's scale, and `fail-on` (default `serious`) decides what blocks the PR. Anything below the threshold still appears as a warning, in SARIF, and in the PR comment.

**Built to stay quiet when unsure.** A rule only reports on components it can trace back to an `antd` import (named, aliased, namespace, `antd/es/*`, or `const { Item } = Form`). Spread props, `id`s and custom children count as "may be labelled". Each rule's claim about antd's markup is also checked in CI by rendering real antd and inspecting the DOM (`packages/eslint-plugin-antd-a11y/tests/dom`).

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

`baseline` is reserved for the baseline layer and ignored for now. The runtime check is a separate step; see below.

**Outputs:** `violations`, `blocking-violations`, `sarif-file`.

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
      - uses: cstayyab/antd-a11y-action/runtime@v1
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
      - uses: cstayyab/antd-a11y-action/runtime@v1
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
| **MVP** | 10 static antd rules, SARIF, sticky PR comment, changed-files mode |
| **v1 (in progress)** | Done: runtime check (Next.js guard + axe, generic axe crawl). Next: baseline file, theme-token contrast audit, Storybook stories |
| v1.1 | WCAG 2.2 runtime checks (focus not obscured, target size), auth via Playwright `storageState` |
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
