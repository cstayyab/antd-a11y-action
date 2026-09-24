// Impact and blocking come from the plugin's engine, shared with local ESLint runs.
import { engine } from 'eslint-plugin-antd-a11y';

export const { blockingFor, impactFor, isA11yRule, ruleInfo } = engine;
