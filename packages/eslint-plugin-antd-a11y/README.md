# eslint-plugin-antd-a11y

Accessibility checks for [Ant Design](https://ant.design) apps: the antd-specific problems `eslint-plugin-jsx-a11y` can't see because it only understands plain JSX elements, plus a tuned jsx-a11y layer. It's the engine behind the [antd A11y Guard](https://github.com/cstayyab/antd-a11y-action) GitHub Action, so running it locally gives the same result as the PR check.

```sh
npm install --save-dev eslint-plugin-antd-a11y
```

## Same check as the GitHub Action

```js
// eslint.config.js
import antdA11y from 'eslint-plugin-antd-a11y';
import tseslint from 'typescript-eslint';

export default [
  ...tseslint.configs.recommended, // provides the parser for .ts/.tsx
  ...antdA11y.config(),
];
```

`antdA11y.config()` reads `.github/antd-a11y.json`, the file the action reads, and applies:
- rules and options
- the `failOn` threshold
- wrapper aliases
- jsx-a11y settings
- the jsx-a11y preset, with the action's tuning and false-positive filters

A processor then does what the action does after linting:
- drops a jsx-a11y finding on the same element as an antd finding
- applies `a11y-ignore` comments
- reports each finding as an **error** if it would block the PR check, or a **warning** if not

`eslint` exits non-zero exactly when the PR check would fail. A CI test in the action's repo lints its fixture app both ways and checks the results are identical.

Options override the config file:

| Option | Default | |
| --- | --- | --- |
| `configFile` | `.github/antd-a11y.json` | Path relative to `cwd`; `false` skips the file |
| `cwd` | `process.cwd()` | |
| `failOn` | `serious` | `minor`, `moderate`, `serious`, `critical` or `none` |
| `rules`, `aliases`, `settings`, `jsxA11y` | | Same shape as the config file |
| `files` | all JS/TS extensions | |
| `parser` | | Usually set by your TypeScript config instead |
| `processor` | `true` | `false` if another processor already handles `.jsx`/`.tsx`. Every finding then shows as an error, and `a11y-ignore` isn't read. |

An invalid config (an unknown rule id, options a rule's schema rejects, a bad alias) throws when ESLint loads it, with the same message the action gives.

This needs flat config (ESLint 9). See the [configuration guide](https://github.com/cstayyab/antd-a11y-action#configuration) for the config file.

## The antd rules only

To add just the antd rules to an existing setup:

```js
export default [antdA11y.configs.recommended];
```

```json
// .eslintrc (legacy)
{ "extends": ["plugin:antd-a11y/recommended-legacy"] }
```

Rules only report on components they can trace to an `antd` import. Each rule's `meta.docs` carries an axe-style `impact` and the WCAG criteria it covers.

In-house wrappers around antd components are skipped unless you declare them in `settings['antd-a11y'].aliases`, either for every rule or per rule, with a prop condition that meets the rule:

```js
export default [
  antdA11y.configs.recommended,
  {
    settings: {
      'antd-a11y': {
        aliases: {
          TextField: 'Input',
          HintTooltip: { as: 'Tooltip', satisfies: { 'popup-trigger-focusable': 'asButton' } },
        },
      },
    },
  },
];
```

With `antdA11y.config()`, put aliases in the config file instead. See [Wrapper components](https://github.com/cstayyab/antd-a11y-action#wrapper-components) for `name`, `props`, `satisfies`, `only` and `except`.

See the [rule list and docs](https://github.com/cstayyab/antd-a11y-action#what-it-catches).

Not affiliated with or endorsed by Ant Group or the Ant Design team.
