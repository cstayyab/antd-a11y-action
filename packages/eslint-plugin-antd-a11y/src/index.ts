import { config } from './engine/flat-config.js';
import { plugin } from './plugin.js';

export type { AntdA11yDocs, Impact } from './utils/create-rule.js';
export { aliasErrors, aliasWarnings, type AliasMap, type AliasSpec } from './utils/aliases.js';
export { PLUGIN_NAME, VERSION, rules, configs, type RuleName } from './plugin.js';
export { config, type PluginConfigOptions } from './engine/flat-config.js';

// The engine the GitHub Action runs, so the action and a local ESLint run share one implementation.
export * as engine from './engine/index.js';

export default Object.assign(plugin, { config });
