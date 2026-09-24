import type { TSESLint } from '@typescript-eslint/utils';
import authInputAutocomplete from './rules/auth-input-autocomplete.js';
import formControlHasName from './rules/form-control-has-name.js';
import formItemHasLabel from './rules/form-item-has-label.js';
import iconButtonHasName from './rules/icon-button-has-name.js';
import imageHasAlt from './rules/image-has-alt.js';
import modalHasTitle from './rules/modal-has-title.js';
import pickerHasName from './rules/picker-has-name.js';
import popupTriggerFocusable from './rules/popup-trigger-focusable.js';
import tableColumnHasTitle from './rules/table-column-has-title.js';
import tooltipNoDisabledChild from './rules/tooltip-no-disabled-child.js';

export type { AntdA11yDocs, Impact } from './utils/create-rule.js';
export { aliasErrors, type AliasMap, type AliasSpec } from './utils/aliases.js';

export const PLUGIN_NAME = 'antd-a11y';
export const VERSION = '0.9.1';

export const rules = {
  'icon-button-has-name': iconButtonHasName,
  'picker-has-name': pickerHasName,
  'form-control-has-name': formControlHasName,
  'form-item-has-label': formItemHasLabel,
  'modal-has-title': modalHasTitle,
  'table-column-has-title': tableColumnHasTitle,
  'image-has-alt': imageHasAlt,
  'tooltip-no-disabled-child': tooltipNoDisabledChild,
  'popup-trigger-focusable': popupTriggerFocusable,
  'auth-input-autocomplete': authInputAutocomplete,
};

export type RuleName = keyof typeof rules;

const recommendedRules = Object.fromEntries(
  Object.keys(rules).map((name) => [`${PLUGIN_NAME}/${name}`, 'error']),
) as Record<`${typeof PLUGIN_NAME}/${RuleName}`, 'error'>;

const plugin = {
  meta: { name: 'eslint-plugin-antd-a11y', version: VERSION },
  rules,
  configs: {} as Record<string, unknown>,
};

const flatRecommended: TSESLint.FlatConfig.Config = {
  name: 'antd-a11y/recommended',
  plugins: { [PLUGIN_NAME]: plugin as unknown as TSESLint.FlatConfig.Plugin },
  languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  rules: recommendedRules,
};

const legacyRecommended = {
  plugins: [PLUGIN_NAME],
  parserOptions: { ecmaFeatures: { jsx: true } },
  rules: recommendedRules,
};

plugin.configs = {
  recommended: flatRecommended,
  'flat/recommended': flatRecommended,
  'recommended-legacy': legacyRecommended,
};

export const configs = plugin.configs as {
  recommended: TSESLint.FlatConfig.Config;
  'flat/recommended': TSESLint.FlatConfig.Config;
  'recommended-legacy': typeof legacyRecommended;
};

export default plugin;
