// A theme module for the theme-config input: named light and dark themes built from shared tokens.
import { theme, type ThemeConfig } from 'antd';

const brandTokens = (primary: string) => ({ colorPrimary: primary, borderRadius: 4 });

export const light: ThemeConfig = { token: brandTokens('#faad14') };
export const dark: ThemeConfig = { token: brandTokens('#faad14'), algorithm: theme.darkAlgorithm };

export default { light, dark };
