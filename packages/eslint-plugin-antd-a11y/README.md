# eslint-plugin-antd-a11y

ESLint rules for accessibility problems specific to [Ant Design](https://ant.design) components, the ones `eslint-plugin-jsx-a11y` can't see because it only understands plain JSX elements.

```sh
npm install --save-dev eslint-plugin-antd-a11y
```

```js
// eslint.config.js (flat config)
import antdA11y from 'eslint-plugin-antd-a11y';

export default [antdA11y.configs.recommended];
```

```json
// .eslintrc (legacy)
{ "extends": ["plugin:antd-a11y/recommended-legacy"] }
```

Rules only report on components they can trace to an `antd` import. Each rule's `meta.docs` carries an axe-style `impact` and the WCAG criteria it covers.

See the [rule list and docs](https://github.com/cstayyab/antd-a11y-action#what-it-catches). The same rules power the [antd A11y Guard](https://github.com/cstayyab/antd-a11y-action) GitHub Action.

Not affiliated with or endorsed by Ant Group or the Ant Design team.
