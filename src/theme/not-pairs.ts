// Colour tokens the audit deliberately doesn't check as a foreground/background pair, each with the
// reason. tests/theme/coverage.test.ts fails when a colour token antd derives is neither in a pair
// (pairs.ts) nor matched here, so a new antd token can't go unchecked silently.

export interface NotPair {
  /** Token name, or a pattern; `component` limits it to that component's own tokens. */
  token: string | RegExp;
  component?: string;
  reason: string;
}

const PRESETS = 'blue|purple|cyan|green|magenta|pink|red|orange|yellow|volcano|geekblue|lime|gold';

export const NOT_PAIRS: readonly NotPair[] = [
  // Seeds and palettes
  { token: /^(colorTextBase|colorBgBase)$/, reason: 'Seed: every text and background token derives from it, and those are checked.' },
  { token: /^(colorPrimary|colorSuccess|colorWarning|colorError|colorInfo|colorLink)$/, reason: 'Checked through the component pairs that use it.' },
  { token: new RegExp(`^(${PRESETS})(-?\\d+)?$`), reason: 'Palette swatch. Preset Tags check shades 7 on 1; the other shades are not a foreground/background pair in any antd component.' },
  { token: new RegExp(`^(${PRESETS})(Hover|Active)$`), reason: 'Preset hover and active shades, used only by preset-coloured Buttons as border or background accents.' },
  // Effects that are not a text or control colour
  { token: 'colorShadow', reason: 'Shadow colour; not a foreground or background.' },
  { token: 'colorBgMask', reason: 'Backdrop behind modals and drawers; the dialog surface (colorBgElevated) is checked.' },
  { token: 'colorBgBlur', reason: 'Transparent by default; only shows behind a backdrop blur.' },
  { token: 'colorSplit', reason: 'Divider and list separator lines: decorative, not required to identify a control (WCAG 1.4.11 does not apply).' },
  { token: 'colorBorderSecondary', reason: 'Card, table and tab borders that separate content: decorative, not required to identify a control.' },
  { token: 'colorBorderBg', reason: 'The ring separating stacked avatars and badges from what is behind them: decorative.' },
  { token: /^(colorErrorOutline|colorWarningOutline|controlOutline|controlTmpOutline)$/, reason: 'Soft focus glow drawn in addition to the focus border, which is checked (activeBorderColor).' },
  { token: /^(colorErrorAffix|colorWarningAffix)$/, reason: 'Prefix/suffix icon tint in error and warning inputs; the input border carries the state and is checked.' },
  { token: 'colorHighlight', reason: 'Search-match highlight in Cascader options, shown with the option text colour it tints.' },
  { token: /^(colorFill|colorFillSecondary|colorFillQuaternary|colorFillContent|colorFillContentHover)$/, reason: 'Translucent fills layered under text; checked where a component uses them as a background (e.g. filled inputs, text buttons).' },
  { token: /^(colorPrimaryBorderHover|colorSuccessBorder|colorSuccessBorderHover|colorWarningBorder|colorInfoBorder|colorInfoBorderHover|colorErrorBorder)$/, reason: 'Alert and notice borders drawn around a tinted background that is itself checked; decorative.' },
  { token: /^(colorSuccessHover|colorSuccessActive|colorSuccessBgHover|colorInfoHover|colorInfoActive|colorInfoBgHover|colorWarningHover|colorWarningActive|colorWarningBgHover|colorErrorBgHover|colorErrorBgFilledHover)$/, reason: 'Status hover and active shades used for backgrounds and borders of status-coloured variants; their text is checked through the base status pairs.' },
  { token: 'colorFillAlter', reason: 'Alternate background; checked through the component tokens that default to it (Input.addonBg, Table.headerBg, Card.headerBg…).' },
  { token: /^(colorIconHover|colorBgTextActive)$/, reason: 'Checked in the Modal close button pairs.' },
  { token: /^(controlItemBgActiveDisabled)$/, reason: 'Disabled selected item background; WCAG exempts disabled controls.' },
  // Component tokens
  { token: /^(colorItemText|colorItemTextHover|colorItemTextHoverHorizontal|colorGroupTitle|colorItemTextSelected|colorItemTextSelectedHorizontal|colorItemBg|colorItemBgHover|colorItemBgActive|colorSubItemBg|colorItemBgSelected|colorItemBgSelectedHorizontal|colorItemTextDisabled|colorDangerItemText|colorDangerItemTextHover|colorDangerItemTextSelected|colorDangerItemBgActive|colorDangerItemBgSelected)$/, component: 'Menu', reason: 'Deprecated alias of the matching Menu token (itemColor, itemBg…), which is checked.' },
  { token: /^(colorBgHeader|colorBgBody|colorBgTrigger)$/, component: 'Layout', reason: 'Deprecated alias of headerBg, bodyBg and triggerBg, which are checked.' },
  { token: 'groupBorderColor', component: 'Avatar', reason: 'Ring between stacked avatars: decorative.' },
  { token: 'groupBorderColor', component: 'Button', reason: 'Divider between buttons in a group: decorative.' },
  { token: /^(defaultBorderColorDisabled)$/, component: 'Button', reason: 'Disabled border; WCAG exempts disabled controls.' },
  { token: /^(ghostBg)$/, component: 'Button', reason: 'Transparent; checked as the top layer of the ghost button pairs.' },
  { token: /^(clearBg|activeOutlineColor)$/, component: 'Select', reason: 'Clear-button backdrop and focus glow; the icon and the focus border are checked.' },
  { token: 'handleActiveBg', component: 'InputNumber', reason: 'Pressed step-handle background under the handle icon, which is checked on handleBg.' },
  { token: 'filledHandleBg', component: 'InputNumber', reason: 'Step-handle background in the filled variant, under the handle icon, which is checked on handleBg.' },
  { token: 'handleBorderColor', component: 'InputNumber', reason: 'Divider between the step handles: decorative.' },
  { token: 'headerSplitColor', component: 'Table', reason: 'Divider between header cells: decorative.' },
  { token: 'borderColor', component: 'Table', reason: 'Cell borders separating content: decorative.' },
  { token: 'stickyScrollBarBg', component: 'Table', reason: 'Sticky scroll bar thumb; browser scroll bars are outside WCAG 1.4.11 for antd.' },
  { token: 'tailColor', component: 'Timeline', reason: 'Line connecting timeline items: decorative.' },
  { token: /^(colorGradientEnd|gradientFromColor|gradientToColor)$/, component: 'Skeleton', reason: 'Loading shimmer animation colours: decorative.' },
  { token: 'handleBg', component: 'Switch', reason: 'Switch knob, drawn on the track colour; the track, which shows the state, is checked.' },
  { token: 'extraColor', component: 'Card', reason: 'Card extra text; checked as colorLink in rendered cards.' },
];

export function notPairFor(token: string, component?: string): NotPair | undefined {
  return NOT_PAIRS.find(
    (n) =>
      (n.component ? n.component === component : true) &&
      (typeof n.token === 'string' ? n.token === token : n.token.test(token)),
  );
}
