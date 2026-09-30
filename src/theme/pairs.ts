// Which colour sits on which: the foreground/background pairs antd's component styles produce,
// found by rendering each component with a fingerprint theme (every token a unique colour) and
// reading which token each element's colour came from. tests/theme/render.test.ts re-renders every
// pair in antd 5 and 6 and fails if a component stops using the tokens named here.
//
// Tokens are resolved in the component's token map (its own tokens, then `components.<Name>`
// overrides, then the global tokens), so `fg: 'primaryColor'` in a Button pair is Button.primaryColor.

export type PairKind =
  /** Text, WCAG 1.4.3: 4.5:1, or 3:1 when large. */
  | 'text'
  /** Placeholder text: 1.4.3 as well, under its own rule id so teams can set it separately. */
  | 'placeholder'
  /** A boundary, indicator or icon needed to identify a control or its state, WCAG 1.4.11: 3:1. */
  | 'non-text';

export type State = 'default' | 'hover' | 'active' | 'focus' | 'selected' | 'checked' | 'disabled' | 'error' | 'warning';

export type Pseudo = 'hover' | 'active' | 'focus' | 'focus-visible';
export type StyleProp = 'color' | 'background' | 'border' | 'fill';

export interface RenderSpec {
  /** Scene id in tests/theme/render/scenes.tsx. */
  scene: string;
  /** Element whose `fgProp` is the foreground token. */
  fg: string;
  fgProp?: StyleProp;
  /** Read the foreground from a pseudo-element, e.g. "::placeholder". */
  fgPseudo?: '::before' | '::after' | '::placeholder';
  /** Element whose `bgProp` is the top background layer; omitted when the top layer is the surface. */
  bg?: string;
  bgProp?: StyleProp;
  /** Pseudo-classes forced on `on` (defaults to `bg`, else `fg`) before reading styles. */
  force?: Pseudo | Pseudo[];
  on?: string;
  /** Selector differences in antd 5's DOM. */
  v5?: Partial<Omit<RenderSpec, 'v5'>>;
}

export interface Pair {
  id: string;
  /** Component whose token map resolves the tokens; also what the report names. */
  component: string;
  /** What the pair is, e.g. "Primary button label". */
  element: string;
  state: State;
  kind: PairKind;
  fg: string;
  /** Background layers, bottom first. The bottom one is the surface the component sits on. */
  bg: string[];
  /** Font-size and weight tokens for text, to tell large text (3:1) from normal (4.5:1). */
  fontSize?: string;
  fontWeight?: string;
  /** Disabled controls are exempt from 1.4.3 and 1.4.11; listed so coverage and the render check include them. */
  exempt?: 'disabled';
  /** How the render check finds the pair. Absent for tokens no antd component renders (see `documented`). */
  render?: RenderSpec;
  /** A text token's documented purpose, checked though no antd component uses it. */
  documented?: boolean;
  /** antd majors the pair applies to; both when absent. */
  majors?: number[];
}

const CONTAINER = 'colorBgContainer';
const ELEVATED = 'colorBgElevated';

type Extra = Partial<Pair>;
const pair = (
  id: string,
  component: string,
  element: string,
  state: State,
  kind: PairKind,
  fg: string,
  bg: string | string[],
  render?: RenderSpec,
  extra: Extra = {},
): Pair => ({ id, component, element, state, kind, fg, bg: Array.isArray(bg) ? bg : [bg], ...(render ? { render } : {}), ...extra });

const disabled: Extra = { exempt: 'disabled' };

// ---------------------------------------------------------------------------------------------
// Text tokens by their documented purpose. Where a component renders them, a component pair below
// covers the same token with a render check.
const tokenPairs: Pair[] = [
  ['colorText', 'Body text'],
  ['colorTextSecondary', 'Secondary text'],
  ['colorTextTertiary', 'Tertiary text'],
  ['colorTextDescription', 'Description text'],
  ['colorTextLabel', 'Label text'],
  ['colorTextHeading', 'Heading text'],
  ['colorPrimaryText', 'Text in the primary colour'],
  ['colorPrimaryTextHover', 'Text in the primary colour, hovered'],
  ['colorPrimaryTextActive', 'Text in the primary colour, pressed'],
  ['colorSuccessText', 'Success text'],
  ['colorSuccessTextHover', 'Success text, hovered'],
  ['colorSuccessTextActive', 'Success text, pressed'],
  ['colorWarningText', 'Warning text'],
  ['colorWarningTextHover', 'Warning text, hovered'],
  ['colorWarningTextActive', 'Warning text, pressed'],
  ['colorErrorText', 'Error text'],
  ['colorErrorTextHover', 'Error text, hovered'],
  ['colorErrorTextActive', 'Error text, pressed'],
  ['colorInfoText', 'Info text'],
  ['colorInfoTextHover', 'Info text, hovered'],
  ['colorInfoTextActive', 'Info text, pressed'],
].map(([token, element]) =>
  pair(`token.${token}`, 'Typography', element, /Hover$/.test(token) ? 'hover' : /Active$/.test(token) ? 'active' : 'default', 'text', token, CONTAINER, undefined, { documented: true }),
);

const typography: Pair[] = [
  pair('typography.text', 'Typography', 'Body text', 'default', 'text', 'colorText', CONTAINER, { scene: 'typography', fg: '.t-body' }),
  pair('typography.text.layout', 'Layout', 'Body text on the layout background', 'default', 'text', 'colorText', 'colorBgLayout', { scene: 'layout', fg: 'main.ant-layout-content' }),
  pair('typography.text.elevated', 'Popover', 'Body text in a popup', 'default', 'text', 'colorText', ELEVATED, { scene: 'popups', fg: '.ant-popover-content', bg: '.ant-popover-container', v5: { fg: '.ant-popover-inner-content', bg: '.ant-popover-inner' } }),
  pair('typography.heading1', 'Typography', 'Heading (h1)', 'default', 'text', 'colorTextHeading', CONTAINER, { scene: 'typography', fg: 'h1' }, { fontSize: 'fontSizeHeading1', fontWeight: 'fontWeightStrong' }),
  pair('typography.heading5', 'Typography', 'Heading (h5)', 'default', 'text', 'colorTextHeading', CONTAINER, { scene: 'typography', fg: 'h5' }, { fontSize: 'fontSizeHeading5', fontWeight: 'fontWeightStrong' }),
  pair('typography.secondary', 'Typography', 'Secondary text', 'default', 'text', 'colorTextDescription', CONTAINER, { scene: 'typography', fg: '.ant-typography-secondary' }),
  pair('typography.success', 'Typography', 'Success text', 'default', 'text', 'colorSuccessText', CONTAINER, { scene: 'typography', fg: '.ant-typography-success' }),
  pair('typography.warning', 'Typography', 'Warning text', 'default', 'text', 'colorWarningText', CONTAINER, { scene: 'typography', fg: '.ant-typography-warning' }),
  pair('typography.danger', 'Typography', 'Danger text', 'default', 'text', 'colorErrorText', CONTAINER, { scene: 'typography', fg: '.ant-typography-danger' }),
  pair('typography.disabled', 'Typography', 'Disabled text', 'disabled', 'text', 'colorTextDisabled', CONTAINER, { scene: 'typography', fg: '.ant-typography-disabled' }, disabled),
  pair('typography.link', 'Typography', 'Link', 'default', 'text', 'colorLink', CONTAINER, { scene: 'typography', fg: 'a.ant-typography' }),
  pair('typography.link.hover', 'Typography', 'Link', 'hover', 'text', 'colorLinkHover', CONTAINER, { scene: 'typography', fg: 'a.ant-typography', force: 'hover' }),
  pair('typography.link.active', 'Typography', 'Link', 'active', 'text', 'colorLinkActive', CONTAINER, { scene: 'typography', fg: 'a.ant-typography', force: 'active' }),
  pair('typography.label', 'Steps', 'Label text (waiting step number)', 'default', 'text', 'colorTextLabel', [CONTAINER, 'colorFillTertiary'], { scene: 'progressSteps', fg: '.ant-steps-item-wait .ant-steps-item-icon-number', bg: '.ant-steps-item-wait .ant-steps-item-icon', }, { majors: [6] }),
];

const button: Pair[] = [
  pair('button.default', 'Button', 'Default button label', 'default', 'text', 'defaultColor', [CONTAINER, 'defaultBg'], { scene: 'button', fg: '.t-default > span', bg: '.t-default' }),
  pair('button.default.hover', 'Button', 'Default button label', 'hover', 'text', 'defaultHoverColor', [CONTAINER, 'defaultHoverBg'], { scene: 'button', fg: '.t-default > span', bg: '.t-default', force: 'hover' }),
  pair('button.default.active', 'Button', 'Default button label', 'active', 'text', 'defaultActiveColor', [CONTAINER, 'defaultActiveBg'], { scene: 'button', fg: '.t-default > span', bg: '.t-default', force: 'active' }),
  pair('button.default.border', 'Button', 'Default button border', 'default', 'non-text', 'defaultBorderColor', CONTAINER, { scene: 'button', fg: '.t-default', fgProp: 'border' }),
  pair('button.default.border.hover', 'Button', 'Default button border', 'hover', 'non-text', 'defaultHoverBorderColor', CONTAINER, { scene: 'button', fg: '.t-default', fgProp: 'border', force: 'hover' }),
  pair('button.default.border.active', 'Button', 'Default button border', 'active', 'non-text', 'defaultActiveBorderColor', CONTAINER, { scene: 'button', fg: '.t-default', fgProp: 'border', force: 'active' }),
  pair('button.primary', 'Button', 'Primary button label', 'default', 'text', 'primaryColor', [CONTAINER, 'colorPrimary'], { scene: 'button', fg: '.t-primary > span', bg: '.t-primary' }),
  pair('button.primary.hover', 'Button', 'Primary button label', 'hover', 'text', 'primaryColor', [CONTAINER, 'colorPrimaryHover'], { scene: 'button', fg: '.t-primary > span', bg: '.t-primary', force: 'hover' }),
  pair('button.primary.active', 'Button', 'Primary button label', 'active', 'text', 'primaryColor', [CONTAINER, 'colorPrimaryActive'], { scene: 'button', fg: '.t-primary > span', bg: '.t-primary', force: 'active' }),
  pair('button.primary.fill', 'Button', 'Primary button background', 'default', 'non-text', 'colorPrimary', CONTAINER, { scene: 'button', fg: '.t-primary', fgProp: 'background' }),
  pair('button.text', 'Button', 'Text button label', 'default', 'text', 'textTextColor', CONTAINER, { scene: 'button', fg: '.t-text > span' }),
  pair('button.text.hover', 'Button', 'Text button label', 'hover', 'text', 'textTextHoverColor', [CONTAINER, 'textHoverBg'], { scene: 'button', fg: '.t-text > span', bg: '.t-text', force: 'hover' }),
  pair('button.text.active', 'Button', 'Text button label', 'active', 'text', 'textTextActiveColor', [CONTAINER, 'colorFill'], { scene: 'button', fg: '.t-text > span', bg: '.t-text', force: 'active' }, { majors: [6] }),
  pair('button.text.active.v5', 'Button', 'Text button label', 'active', 'text', 'textTextActiveColor', [CONTAINER, 'colorBgTextActive'], { scene: 'button', fg: '.t-text > span', bg: '.t-text', force: 'active' }, { majors: [5] }),
  pair('button.link', 'Button', 'Link button label', 'default', 'text', 'colorLink', CONTAINER, { scene: 'button', fg: '.t-link > span' }),
  pair('button.link.hover', 'Button', 'Link button label', 'hover', 'text', 'colorLinkHover', [CONTAINER, 'linkHoverBg'], { scene: 'button', fg: '.t-link > span', bg: '.t-link', force: 'hover' }),
  pair('button.link.active', 'Button', 'Link button label', 'active', 'text', 'colorLinkActive', CONTAINER, { scene: 'button', fg: '.t-link > span', force: ['hover', 'active'], on: '.t-link' }),
  pair('button.danger', 'Button', 'Danger button label', 'default', 'text', 'colorError', CONTAINER, { scene: 'button', fg: '.t-danger > span', bg: '.t-danger' }),
  pair('button.danger.hover', 'Button', 'Danger button label', 'hover', 'text', 'colorErrorHover', CONTAINER, { scene: 'button', fg: '.t-danger > span', bg: '.t-danger', force: 'hover' }, { majors: [6] }),
  pair('button.danger.hover.v5', 'Button', 'Danger button label', 'hover', 'text', 'colorErrorHover', [CONTAINER, 'defaultHoverBg'], { scene: 'button', fg: '.t-danger > span', bg: '.t-danger', force: 'hover' }, { majors: [5] }),
  pair('button.danger.active', 'Button', 'Danger button label', 'active', 'text', 'colorErrorActive', CONTAINER, { scene: 'button', fg: '.t-danger > span', bg: '.t-danger', force: 'active' }, { majors: [6] }),
  pair('button.danger.active.v5', 'Button', 'Danger button label', 'active', 'text', 'colorErrorActive', [CONTAINER, 'defaultActiveBg'], { scene: 'button', fg: '.t-danger > span', bg: '.t-danger', force: 'active' }, { majors: [5] }),
  pair('button.danger-primary', 'Button', 'Primary danger button label', 'default', 'text', 'dangerColor', [CONTAINER, 'colorError'], { scene: 'button', fg: '.t-danger-primary > span', bg: '.t-danger-primary' }),
  pair('button.danger-primary.hover', 'Button', 'Primary danger button label', 'hover', 'text', 'dangerColor', [CONTAINER, 'colorErrorHover'], { scene: 'button', fg: '.t-danger-primary > span', bg: '.t-danger-primary', force: 'hover' }, { majors: [6] }),
  pair('button.danger-primary.hover.v5', 'Button', 'Primary danger button label', 'hover', 'text', 'primaryColor', [CONTAINER, 'colorErrorHover'], { scene: 'button', fg: '.t-danger-primary > span', bg: '.t-danger-primary', force: 'hover' }, { majors: [5] }),
  pair('button.danger-primary.active', 'Button', 'Primary danger button label', 'active', 'text', 'dangerColor', [CONTAINER, 'colorErrorActive'], { scene: 'button', fg: '.t-danger-primary > span', bg: '.t-danger-primary', force: 'active' }, { majors: [6] }),
  pair('button.danger-primary.active.v5', 'Button', 'Primary danger button label', 'active', 'text', 'primaryColor', [CONTAINER, 'colorErrorActive'], { scene: 'button', fg: '.t-danger-primary > span', bg: '.t-danger-primary', force: 'active' }, { majors: [5] }),
  pair('button.danger-text.hover', 'Button', 'Danger text button label', 'hover', 'text', 'colorErrorHover', [CONTAINER, 'colorErrorBg'], { scene: 'button', fg: '.t-danger-text > span', bg: '.t-danger-text', force: 'hover' }),
  pair('button.danger-text.active', 'Button', 'Danger text button label', 'active', 'text', 'colorErrorActive', [CONTAINER, 'colorErrorBgActive'], { scene: 'button', fg: '.t-danger-text > span', bg: '.t-danger-text', force: ['hover', 'active'] }, { majors: [6] }),
  pair('button.danger-text.active.v5', 'Button', 'Danger text button label', 'active', 'text', 'colorErrorHover', [CONTAINER, 'colorErrorBgActive'], { scene: 'button', fg: '.t-danger-text > span', bg: '.t-danger-text', force: ['hover', 'active'] }, { majors: [5] }),
  pair('button.ghost', 'Button', 'Ghost button label', 'default', 'text', 'defaultGhostColor', ['colorBgSpotlight', 'ghostBg'], { scene: 'button', fg: '.t-ghost > span', bg: '.t-ghost' }),
  pair('button.ghost.border', 'Button', 'Ghost button border', 'default', 'non-text', 'defaultGhostBorderColor', 'colorBgSpotlight', { scene: 'button', fg: '.t-ghost', fgProp: 'border' }),
  pair('button.ghost-primary', 'Button', 'Primary ghost button label', 'default', 'text', 'colorPrimary', ['colorBgSpotlight', 'ghostBg'], { scene: 'button', fg: '.t-ghost-primary > span', bg: '.t-ghost-primary' }),
  pair('button.solid', 'Button', 'Solid button label', 'default', 'text', 'solidTextColor', [CONTAINER, 'colorBgSolid'], { scene: 'button', fg: '.t-solid > span', bg: '.t-solid' }),
  pair('button.solid.hover', 'Button', 'Solid button label', 'hover', 'text', 'solidTextColor', [CONTAINER, 'colorBgSolidHover'], { scene: 'button', fg: '.t-solid > span', bg: '.t-solid', force: 'hover' }),
  pair('button.solid.active', 'Button', 'Solid button label', 'active', 'text', 'solidTextColor', [CONTAINER, 'colorBgSolidActive'], { scene: 'button', fg: '.t-solid > span', bg: '.t-solid', force: 'active' }),
  pair('button.filled', 'Button', 'Filled button label', 'default', 'text', 'colorPrimary', [CONTAINER, 'colorPrimaryBg'], { scene: 'button', fg: '.t-filled > span', bg: '.t-filled' }),
  pair('button.filled.hover', 'Button', 'Filled button label', 'hover', 'text', 'colorPrimary', [CONTAINER, 'colorPrimaryBgHover'], { scene: 'button', fg: '.t-filled > span', bg: '.t-filled', force: 'hover' }),
  pair('button.filled.active', 'Button', 'Filled button label', 'active', 'text', 'colorPrimary', [CONTAINER, 'colorPrimaryBorder'], { scene: 'button', fg: '.t-filled > span', bg: '.t-filled', force: 'active' }),
  pair('button.disabled', 'Button', 'Disabled button label', 'disabled', 'text', 'colorTextDisabled', [CONTAINER, 'defaultBgDisabled'], { scene: 'button', fg: '.t-disabled > span', bg: '.t-disabled' }, { ...disabled, majors: [6] }),
  pair('button.disabled.v5', 'Button', 'Disabled button label', 'disabled', 'text', 'colorTextDisabled', [CONTAINER, 'colorBgContainerDisabled'], { scene: 'button', fg: '.t-disabled > span', bg: '.t-disabled' }, { ...disabled, majors: [5] }),
  pair('button.disabled.border', 'Button', 'Disabled button border', 'disabled', 'non-text', 'borderColorDisabled', CONTAINER, { scene: 'button', fg: '.t-disabled', fgProp: 'border' }, disabled),
  pair('button.primary.disabled', 'Button', 'Disabled primary button label', 'disabled', 'text', 'colorTextDisabled', [CONTAINER, 'colorBgContainerDisabled'], { scene: 'button', fg: '.t-primary-disabled > span', bg: '.t-primary-disabled' }, disabled),
  pair('button.dashed.disabled', 'Button', 'Disabled dashed button label', 'disabled', 'text', 'colorTextDisabled', [CONTAINER, 'dashedBgDisabled'], { scene: 'button', fg: '.t-dashed-disabled > span', bg: '.t-dashed-disabled' }, { ...disabled, majors: [6] }),
];

const input: Pair[] = [
  pair('input.value', 'Input', 'Input text', 'default', 'text', 'colorText', CONTAINER, { scene: 'input', fg: '.t-value', bg: '.t-value' }),
  pair('input.placeholder', 'Input', 'Input placeholder', 'default', 'placeholder', 'colorTextPlaceholder', CONTAINER, { scene: 'input', fg: '.t-outlined', fgPseudo: '::placeholder' }),
  pair('select.placeholder', 'Select', 'Select placeholder', 'default', 'placeholder', 'colorTextPlaceholder', [CONTAINER, 'selectorBg'], { scene: 'select', fg: '.t-placeholder .ant-select-placeholder', v5: { fg: '.t-placeholder .ant-select-selection-placeholder' } }),
  pair('input.border', 'Input', 'Outlined input border', 'default', 'non-text', 'colorBorder', CONTAINER, { scene: 'input', fg: '.t-outlined', fgProp: 'border' }),
  pair('input.border.hover', 'Input', 'Outlined input border', 'hover', 'non-text', 'hoverBorderColor', CONTAINER, { scene: 'input', fg: '.t-outlined', fgProp: 'border', force: 'hover' }),
  pair('input.border.focus', 'Input', 'Outlined input border', 'focus', 'non-text', 'activeBorderColor', CONTAINER, { scene: 'input', fg: '.t-outlined', fgProp: 'border', force: 'focus' }),
  pair('input.border.error', 'Input', 'Outlined input border', 'error', 'non-text', 'colorError', CONTAINER, { scene: 'input', fg: '.t-error', fgProp: 'border' }),
  pair('input.border.error.hover', 'Input', 'Outlined input border', 'error', 'non-text', 'colorErrorBorderHover', CONTAINER, { scene: 'input', fg: '.t-error', fgProp: 'border', force: 'hover' }),
  pair('input.border.warning', 'Input', 'Outlined input border', 'warning', 'non-text', 'colorWarning', CONTAINER, { scene: 'input', fg: '.t-warning', fgProp: 'border' }),
  pair('input.border.warning.hover', 'Input', 'Outlined input border', 'warning', 'non-text', 'colorWarningBorderHover', CONTAINER, { scene: 'input', fg: '.t-warning', fgProp: 'border', force: 'hover' }),
  pair('input.filled', 'Input', 'Filled input background', 'default', 'non-text', 'colorFillTertiary', CONTAINER, { scene: 'input', fg: '.t-filled', fgProp: 'background' }),
  pair('input.filled.hover', 'Input', 'Filled input background', 'hover', 'non-text', 'colorFillSecondary', CONTAINER, { scene: 'input', fg: '.t-filled', fgProp: 'background', force: 'hover' }),
  pair('input.filled.text', 'Input', 'Filled input text', 'default', 'text', 'colorText', [CONTAINER, 'colorFillTertiary'], { scene: 'input', fg: '.t-filled', bg: '.t-filled' }, { majors: [6] }),
  pair('input.addon', 'Input', 'Input addon text', 'default', 'text', 'colorText', [CONTAINER, 'addonBg'], { scene: 'input', fg: '.t-addon .ant-input-group-addon', bg: '.t-addon .ant-input-group-addon' }),
  pair('input.hover', 'Input', 'Input text', 'hover', 'text', 'colorText', [CONTAINER, 'hoverBg'], undefined),
  pair('input.focus', 'Input', 'Input text', 'focus', 'text', 'colorText', [CONTAINER, 'activeBg'], undefined),
  pair('input.disabled', 'Input', 'Disabled input text', 'disabled', 'text', 'colorTextDisabled', [CONTAINER, 'colorBgContainerDisabled'], { scene: 'input', fg: '.t-disabled', bg: '.t-disabled' }, disabled),
  pair('input.disabled.border', 'Input', 'Disabled input border', 'disabled', 'non-text', 'colorBorderDisabled', CONTAINER, { scene: 'input', fg: '.t-disabled', fgProp: 'border' }, { ...disabled, majors: [6] }),
];

const inputNumber: Pair[] = [
  pair('input-number.hover.border', 'InputNumber', 'Input number border', 'hover', 'non-text', 'hoverBorderColor', CONTAINER, { scene: 'input', fg: '.t-number', fgProp: 'border', force: 'hover' }),
  pair('input-number.focus.border', 'InputNumber', 'Input number border', 'focus', 'non-text', 'activeBorderColor', CONTAINER, { scene: 'input', fg: '.t-number', fgProp: 'border', force: 'focus' }),
  pair('input-number.hover.text', 'InputNumber', 'Input number text', 'hover', 'text', 'colorText', [CONTAINER, 'hoverBg'], { scene: 'input', fg: '.t-number input', bg: '.t-number', force: 'hover', on: '.t-number' }),
  pair('input-number.focus.text', 'InputNumber', 'Input number text', 'focus', 'text', 'colorText', [CONTAINER, 'activeBg'], { scene: 'input', fg: '.t-number input', bg: '.t-number', force: 'focus', on: '.t-number' }),
  pair('input-number.addon', 'InputNumber', 'Input number addon text', 'default', 'text', 'colorText', [CONTAINER, 'addonBg'], undefined),
  pair('input-number.handle', 'InputNumber', 'Step handle icon', 'default', 'non-text', 'colorIcon', [CONTAINER, 'handleBg'], { scene: 'input', fg: '.t-number .ant-input-number-action-up svg', fgProp: 'fill', bg: '.t-number .ant-input-number-actions', v5: { fg: '.t-number .ant-input-number-handler-up svg', bg: '.t-number .ant-input-number-handler-wrap' } }),
  pair('input-number.handle.hover', 'InputNumber', 'Step handle icon', 'hover', 'non-text', 'handleHoverColor', [CONTAINER, 'handleBg'], { scene: 'input', fg: '.t-number .ant-input-number-action-up svg', fgProp: 'fill', force: 'hover', on: '.t-number .ant-input-number-action-up', v5: { fg: '.t-number .ant-input-number-handler-up svg', on: '.t-number .ant-input-number-handler-up' } }),
];

const mentions: Pair[] = [
  pair('mentions.addon', 'Mentions', 'Mentions addon text', 'default', 'text', 'colorText', [CONTAINER, 'addonBg'], undefined),
  pair('mentions.hover.border', 'Mentions', 'Mentions border', 'hover', 'non-text', 'hoverBorderColor', CONTAINER, { scene: 'input', fg: '.t-mentions', fgProp: 'border', force: 'hover' }),
  pair('mentions.focus.border', 'Mentions', 'Mentions border', 'focus', 'non-text', 'activeBorderColor', CONTAINER, { scene: 'input', fg: '.t-mentions', fgProp: 'border', force: 'focus' }),
  pair('mentions.hover.text', 'Mentions', 'Mentions text', 'hover', 'text', 'colorText', [CONTAINER, 'hoverBg'], { scene: 'input', fg: '.t-mentions textarea', bg: '.t-mentions', force: 'hover', on: '.t-mentions' }),
  pair('mentions.focus.text', 'Mentions', 'Mentions text', 'focus', 'text', 'colorText', [CONTAINER, 'activeBg'], { scene: 'input', fg: '.t-mentions textarea', bg: '.t-mentions', force: 'focus', on: '.t-mentions' }),
];

const form: Pair[] = [
  pair('form.label', 'Form', 'Form label', 'default', 'text', 'labelColor', CONTAINER, { scene: 'form', fg: '.ant-form-item-label > label' }),
  pair('form.required-mark', 'Form', 'Required mark', 'default', 'text', 'labelRequiredMarkColor', CONTAINER, { scene: 'form', fg: '.ant-form-item-required', fgPseudo: '::before' }),
  pair('form.error', 'Form', 'Validation error message', 'error', 'text', 'colorError', CONTAINER, { scene: 'form', fg: '.ant-form-item-explain-error' }),
  pair('form.extra', 'Form', 'Help text', 'default', 'text', 'colorTextDescription', CONTAINER, { scene: 'form', fg: '.ant-form-item-extra' }),
];

const select: Pair[] = [
  pair('select.value', 'Select', 'Select value', 'default', 'text', 'colorText', [CONTAINER, 'selectorBg'], { scene: 'select', fg: '.t-select .ant-select-content', bg: '.t-select', v5: { fg: '.t-select .ant-select-selection-item', bg: '.t-select .ant-select-selector' } }),
  pair('select.border', 'Select', 'Select border', 'default', 'non-text', 'colorBorder', CONTAINER, { scene: 'select', fg: '.t-select', fgProp: 'border', v5: { fg: '.t-select .ant-select-selector' } }),
  pair('select.border.hover', 'Select', 'Select border', 'hover', 'non-text', 'hoverBorderColor', CONTAINER, { scene: 'select', fg: '.t-select', fgProp: 'border', force: 'hover', v5: { fg: '.t-select .ant-select-selector', on: '.t-select' } }),
  pair('select.border.focus', 'Select', 'Select border', 'focus', 'non-text', 'activeBorderColor', CONTAINER),
  pair('select.arrow', 'Select', 'Dropdown arrow', 'default', 'non-text', 'colorTextQuaternary', [CONTAINER, 'selectorBg'], { scene: 'select', fg: '.t-select .ant-select-suffix svg', fgProp: 'fill' }),
  pair('select.tag', 'Select', 'Selected item tag (multiple)', 'default', 'text', 'colorText', [CONTAINER, 'selectorBg', 'multipleItemBg'], { scene: 'select', fg: '.t-multiple .ant-select-selection-item-content', bg: '.t-multiple .ant-select-selection-item' }),
  pair('select.tag.remove', 'Select', 'Selected item remove icon (multiple)', 'default', 'non-text', 'colorIcon', [CONTAINER, 'selectorBg', 'multipleItemBg'], { scene: 'select', fg: '.t-multiple .ant-select-selection-item-remove svg', fgProp: 'fill' }),
  pair('select.tag.border', 'Select', 'Selected item tag border (multiple)', 'default', 'non-text', 'multipleItemBorderColor', [CONTAINER, 'selectorBg'], undefined),
  pair('select.tag.disabled', 'Select', 'Disabled selected item tag (multiple)', 'disabled', 'text', 'multipleItemColorDisabled', [CONTAINER, 'multipleSelectorBgDisabled'], undefined, disabled),
  pair('select.tag.border.disabled', 'Select', 'Disabled selected item tag border (multiple)', 'disabled', 'non-text', 'multipleItemBorderColorDisabled', CONTAINER, undefined, disabled),
  pair('select.option', 'Select', 'Dropdown option', 'default', 'text', 'colorText', ELEVATED, { scene: 'select', fg: '.ant-select-item-option:not(.ant-select-item-option-selected):not(.ant-select-item-option-disabled) .ant-select-item-option-content', bg: '.ant-select-dropdown' }),
  pair('select.option.selected', 'Select', 'Selected dropdown option', 'selected', 'text', 'optionSelectedColor', [ELEVATED, 'optionSelectedBg'], { scene: 'select', fg: '.ant-select-item-option-selected .ant-select-item-option-content' }),
  pair('select.option.active', 'Select', 'Highlighted dropdown option', 'hover', 'text', 'colorText', [ELEVATED, 'optionActiveBg'], undefined),
  pair('select.option.selected-active', 'Select', 'Selected option, highlighted', 'selected', 'text', 'optionSelectedColor', [ELEVATED, 'controlItemBgActiveHover'], { scene: 'select', fg: '.ant-select-item-option-selected .ant-select-item-option-content', bg: '.ant-select-item-option-selected' }, { majors: [6] }),
  pair('select.option.disabled', 'Select', 'Disabled dropdown option', 'disabled', 'text', 'colorTextDisabled', ELEVATED, { scene: 'select', fg: '.ant-select-item-option-disabled .ant-select-item-option-content' }, disabled),
  pair('cascader.option.active', 'Cascader', 'Highlighted cascader option', 'selected', 'text', 'optionSelectedColor', [ELEVATED, 'optionSelectedBg'], { scene: 'cascader', fg: '.ant-cascader-menu-item-active .ant-cascader-menu-item-content', bg: '.ant-cascader-menu-item-active', force: 'hover', on: '.ant-cascader-menu-item' }),
  pair('cascader.option.hover', 'Cascader', 'Cascader option', 'hover', 'text', 'colorText', [ELEVATED, 'controlItemBgHover'], { scene: 'cascader', fg: '.ant-cascader-menu-item:not(.ant-cascader-menu-item-active) .ant-cascader-menu-item-content', bg: '.ant-cascader-menu-item:not(.ant-cascader-menu-item-active)', force: 'hover', on: '.ant-cascader-menu-item' }),
  pair('tree-select.node.selected', 'TreeSelect', 'Selected tree node', 'selected', 'text', 'nodeSelectedColor', [ELEVATED, 'nodeSelectedBg'], { scene: 'treeSelect', fg: '.ant-select-tree-node-selected .ant-select-tree-title', bg: '.ant-select-tree-node-selected' }),
  pair('tree-select.node.hover', 'TreeSelect', 'Tree node', 'hover', 'text', 'nodeHoverColor', [ELEVATED, 'nodeHoverBg'], { scene: 'treeSelect', fg: '.ant-select-tree-treenode:not(.ant-select-tree-treenode-disabled):not(.ant-select-tree-treenode-selected) .ant-select-tree-title', bg: '.ant-select-tree-treenode:not(.ant-select-tree-treenode-disabled):not(.ant-select-tree-treenode-selected) .ant-select-tree-node-content-wrapper', force: 'hover', on: '.ant-select-tree-node-content-wrapper' }),
];

const picker: Pair[] = [
  pair('date-picker.header', 'DatePicker', 'Calendar header', 'default', 'text', 'colorTextHeading', ELEVATED, { scene: 'datePicker', fg: '.ant-picker-month-btn', bg: '.ant-picker-panel-container' }),
  pair('date-picker.cell', 'DatePicker', 'Date cell', 'default', 'text', 'colorText', ELEVATED, { scene: 'datePicker', fg: '.ant-picker-cell-in-view:not(.ant-picker-cell-today) .ant-picker-cell-inner' }),
  pair('date-picker.cell.outside', 'DatePicker', 'Date outside the month', 'default', 'text', 'colorTextDisabled', ELEVATED, { scene: 'datePicker', fg: '.ant-picker-cell:not(.ant-picker-cell-in-view) .ant-picker-cell-inner' }, disabled),
  pair('date-picker.cell.hover', 'DatePicker', 'Date cell', 'hover', 'text', 'colorText', [ELEVATED, 'cellHoverBg'], undefined),
  pair('date-picker.cell.selected', 'DatePicker', 'Selected date', 'selected', 'text', 'colorTextLightSolid', [ELEVATED, 'colorPrimary'], undefined),
  pair('date-picker.cell.range', 'DatePicker', 'Date in the selected range', 'selected', 'text', 'colorText', [ELEVATED, 'cellActiveWithRangeBg'], undefined),
  pair('date-picker.cell.range-hover', 'DatePicker', 'Date in the hovered range', 'hover', 'text', 'colorText', [ELEVATED, 'cellHoverWithRangeBg'], undefined),
  pair('date-picker.cell.range-border', 'DatePicker', 'Hovered range edge', 'hover', 'non-text', 'cellRangeBorderColor', ELEVATED, undefined),
  pair('date-picker.cell.disabled', 'DatePicker', 'Disabled date', 'disabled', 'text', 'colorTextDisabled', [ELEVATED, 'cellBgDisabled'], undefined, disabled),
  pair('date-picker.today', 'DatePicker', 'Today link', 'default', 'text', 'colorLink', ELEVATED, { scene: 'datePicker', fg: '.ant-picker-now-btn' }),
  pair('date-picker.border', 'DatePicker', 'Picker border', 'default', 'non-text', 'colorBorder', CONTAINER, { scene: 'datePicker', fg: '.ant-picker', fgProp: 'border' }),
  pair('date-picker.border.hover', 'DatePicker', 'Picker border', 'hover', 'non-text', 'hoverBorderColor', CONTAINER, undefined),
  pair('date-picker.border.focus', 'DatePicker', 'Picker border', 'focus', 'non-text', 'activeBorderColor', CONTAINER, undefined),
  pair('date-picker.hover', 'DatePicker', 'Picker text', 'hover', 'text', 'colorText', [CONTAINER, 'hoverBg'], undefined),
  pair('date-picker.focus', 'DatePicker', 'Picker text', 'focus', 'text', 'colorText', [CONTAINER, 'activeBg'], undefined),
  pair('date-picker.addon', 'DatePicker', 'Picker addon text', 'default', 'text', 'colorText', [CONTAINER, 'addonBg'], undefined),
  pair('date-picker.tag', 'DatePicker', 'Selected date tag (multiple)', 'default', 'text', 'colorText', [CONTAINER, 'multipleItemBg'], undefined),
  pair('date-picker.tag.border', 'DatePicker', 'Selected date tag border (multiple)', 'default', 'non-text', 'multipleItemBorderColor', CONTAINER, undefined),
  pair('date-picker.tag.disabled', 'DatePicker', 'Disabled date tag (multiple)', 'disabled', 'text', 'multipleItemColorDisabled', [CONTAINER, 'multipleSelectorBgDisabled'], undefined, disabled),
  pair('date-picker.tag.border.disabled', 'DatePicker', 'Disabled date tag border (multiple)', 'disabled', 'non-text', 'multipleItemBorderColorDisabled', CONTAINER, undefined, disabled),
  pair('calendar.cell', 'Calendar', 'Calendar date', 'default', 'text', 'colorText', [CONTAINER, 'fullBg', 'fullPanelBg'], { scene: 'calendar', fg: '.ant-picker-cell-in-view:not(.ant-picker-cell-selected) .ant-picker-calendar-date-value', bg: '.ant-picker-panel' }),
  pair('calendar.cell.selected', 'Calendar', 'Selected calendar date', 'selected', 'text', 'colorTextLightSolid', [CONTAINER, 'fullBg', 'fullPanelBg', 'colorPrimary'], { scene: 'calendar', fg: '.ant-picker-cell-selected .ant-picker-calendar-date-value', bg: '.ant-picker-cell-selected .ant-picker-cell-inner' }),
  pair('calendar.cell.hover', 'Calendar', 'Calendar date', 'hover', 'text', 'colorText', [CONTAINER, 'fullBg', 'fullPanelBg', 'cellHoverBg'], { scene: 'calendar', fg: '.ant-picker-cell-in-view:not(.ant-picker-cell-selected) .ant-picker-calendar-date-value', bg: '.ant-picker-cell-in-view:not(.ant-picker-cell-selected) .ant-picker-cell-inner', force: 'hover', on: '.ant-picker-cell-in-view' }),
  pair('calendar.cell.active', 'Calendar', 'Calendar date (full calendar)', 'selected', 'text', 'colorPrimary', [CONTAINER, 'fullBg', 'itemActiveBg'], undefined),
  pair('calendar.cell.range', 'Calendar', 'Date in the selected range', 'selected', 'text', 'colorText', [CONTAINER, 'fullBg', 'cellActiveWithRangeBg'], undefined),
  pair('calendar.cell.range-hover', 'Calendar', 'Date in the hovered range', 'hover', 'text', 'colorText', [CONTAINER, 'fullBg', 'cellHoverWithRangeBg'], undefined),
  pair('calendar.cell.range-border', 'Calendar', 'Hovered range edge', 'hover', 'non-text', 'cellRangeBorderColor', [CONTAINER, 'fullBg'], undefined),
  pair('calendar.cell.disabled', 'Calendar', 'Disabled date', 'disabled', 'text', 'colorTextDisabled', [CONTAINER, 'fullBg', 'cellBgDisabled'], undefined, disabled),
  pair('calendar.tag', 'Calendar', 'Selected date tag (multiple)', 'default', 'text', 'colorText', [CONTAINER, 'multipleItemBg'], undefined),
  pair('calendar.tag.border', 'Calendar', 'Selected date tag border (multiple)', 'default', 'non-text', 'multipleItemBorderColor', CONTAINER, undefined),
  pair('calendar.tag.disabled', 'Calendar', 'Disabled date tag (multiple)', 'disabled', 'text', 'multipleItemColorDisabled', [CONTAINER, 'multipleSelectorBgDisabled'], undefined, disabled),
  pair('calendar.tag.border.disabled', 'Calendar', 'Disabled date tag border (multiple)', 'disabled', 'non-text', 'multipleItemBorderColorDisabled', CONTAINER, undefined, disabled),
];

const choice: Pair[] = [
  pair('checkbox.border', 'Checkbox', 'Unchecked checkbox border', 'default', 'non-text', 'colorBorder', CONTAINER, { scene: 'checkboxRadio', fg: '.t-checkbox-off .ant-checkbox', fgProp: 'border', v5: { fg: '.t-checkbox-off .ant-checkbox-inner' } }),
  pair('checkbox.border.hover', 'Checkbox', 'Unchecked checkbox border', 'hover', 'non-text', 'colorPrimary', CONTAINER, { scene: 'checkboxRadio', fg: '.t-checkbox-off .ant-checkbox', fgProp: 'border', force: 'hover', on: '.t-checkbox-off', v5: { fg: '.t-checkbox-off .ant-checkbox-inner' } }),
  pair('checkbox.checked', 'Checkbox', 'Checked checkbox', 'checked', 'non-text', 'colorPrimary', CONTAINER, { scene: 'checkboxRadio', fg: '.t-checkbox .ant-checkbox', fgProp: 'background', v5: { fg: '.t-checkbox .ant-checkbox-inner' } }),
  pair('checkbox.checked.hover', 'Checkbox', 'Checked checkbox', 'hover', 'non-text', 'colorPrimaryHover', CONTAINER, { scene: 'checkboxRadio', fg: '.t-checkbox .ant-checkbox', fgProp: 'background', force: 'hover', on: '.t-checkbox', v5: { fg: '.t-checkbox .ant-checkbox-inner' } }),
  pair('checkbox.label', 'Checkbox', 'Checkbox label', 'default', 'text', 'colorText', CONTAINER, { scene: 'checkboxRadio', fg: '.t-checkbox-off .ant-checkbox-label' }),
  pair('radio.checked', 'Radio', 'Checked radio ring', 'checked', 'non-text', 'colorPrimary', CONTAINER, { scene: 'checkboxRadio', fg: '.t-radio .ant-radio', fgProp: 'border', v5: { fg: '.t-radio .ant-radio-inner' } }),
  pair('radio.checked.dot', 'Radio', 'Checked radio dot', 'checked', 'non-text', 'radioColor', [CONTAINER, 'radioBgColor'], undefined),
  pair('radio.button', 'Radio', 'Radio button label', 'default', 'text', 'buttonColor', [CONTAINER, 'buttonBg'], { scene: 'checkboxRadio', fg: '.t-radio-buttons .ant-radio-button-wrapper:not(.ant-radio-button-wrapper-checked):not(.ant-radio-button-wrapper-disabled) .ant-radio-button-label', bg: '.t-radio-buttons .ant-radio-button-wrapper:not(.ant-radio-button-wrapper-checked):not(.ant-radio-button-wrapper-disabled)' }),
  pair('radio.button.hover', 'Radio', 'Radio button label', 'hover', 'text', 'colorPrimary', [CONTAINER, 'buttonBg'], { scene: 'checkboxRadio', fg: '.t-radio-buttons .ant-radio-button-wrapper:not(.ant-radio-button-wrapper-checked):not(.ant-radio-button-wrapper-disabled) .ant-radio-button-label', force: 'hover', on: '.t-radio-buttons .ant-radio-button-wrapper' }),
  pair('radio.button.border', 'Radio', 'Radio button border', 'default', 'non-text', 'colorBorder', CONTAINER, { scene: 'checkboxRadio', fg: '.t-radio-buttons .ant-radio-button-wrapper:not(.ant-radio-button-wrapper-checked):not(.ant-radio-button-wrapper-disabled)', fgProp: 'border' }),
  pair('radio.button.checked', 'Radio', 'Selected radio button label', 'checked', 'text', 'colorPrimary', [CONTAINER, 'buttonCheckedBg'], { scene: 'checkboxRadio', fg: '.t-radio-buttons .ant-radio-button-wrapper-checked .ant-radio-button-label', bg: '.t-radio-buttons .ant-radio-button-wrapper-checked' }),
  pair('radio.button.checked.hover', 'Radio', 'Selected radio button label', 'hover', 'text', 'colorPrimaryHover', [CONTAINER, 'buttonCheckedBg'], { scene: 'checkboxRadio', fg: '.t-radio-buttons .ant-radio-button-wrapper-checked .ant-radio-button-label', force: 'hover', on: '.t-radio-buttons .ant-radio-button-wrapper' }),
  pair('radio.button.checked.active', 'Radio', 'Selected radio button label', 'active', 'text', 'colorPrimaryActive', [CONTAINER, 'buttonCheckedBg'], { scene: 'checkboxRadio', fg: '.t-radio-buttons .ant-radio-button-wrapper-checked .ant-radio-button-label', force: 'active', on: '.t-radio-buttons .ant-radio-button-wrapper' }),
  pair('radio.solid.checked', 'Radio', 'Selected solid radio button label', 'checked', 'text', 'buttonSolidCheckedColor', [CONTAINER, 'buttonSolidCheckedBg'], { scene: 'checkboxRadio', fg: '.t-radio-solid .ant-radio-button-wrapper-checked .ant-radio-button-label', bg: '.t-radio-solid .ant-radio-button-wrapper-checked' }),
  pair('radio.solid.checked.hover', 'Radio', 'Selected solid radio button label', 'hover', 'text', 'buttonSolidCheckedColor', [CONTAINER, 'buttonSolidCheckedHoverBg'], { scene: 'checkboxRadio', fg: '.t-radio-solid .ant-radio-button-wrapper-checked .ant-radio-button-label', bg: '.t-radio-solid .ant-radio-button-wrapper-checked', force: 'hover', on: '.t-radio-solid .ant-radio-button-wrapper' }),
  pair('radio.solid.checked.active', 'Radio', 'Selected solid radio button label', 'active', 'text', 'buttonSolidCheckedColor', [CONTAINER, 'buttonSolidCheckedActiveBg'], { scene: 'checkboxRadio', fg: '.t-radio-solid .ant-radio-button-wrapper-checked .ant-radio-button-label', bg: '.t-radio-solid .ant-radio-button-wrapper-checked', force: 'active', on: '.t-radio-solid .ant-radio-button-wrapper' }),
  pair('radio.button.disabled', 'Radio', 'Disabled radio button label', 'disabled', 'text', 'colorTextDisabled', [CONTAINER, 'colorBgContainerDisabled'], { scene: 'checkboxRadio', fg: '.t-radio-buttons .ant-radio-button-wrapper-disabled .ant-radio-button-label', bg: '.t-radio-buttons .ant-radio-button-wrapper-disabled' }, disabled),
  pair('radio.button.checked.disabled', 'Radio', 'Disabled selected radio button label', 'disabled', 'text', 'buttonCheckedColorDisabled', [CONTAINER, 'buttonCheckedBgDisabled'], undefined, disabled),
  pair('radio.dot.disabled', 'Radio', 'Disabled radio dot', 'disabled', 'non-text', 'dotColorDisabled', CONTAINER, undefined, disabled),
  pair('switch.on', 'Switch', 'Switch track (on)', 'checked', 'non-text', 'colorPrimary', CONTAINER, { scene: 'checkboxRadio', fg: '.t-switch-on', fgProp: 'background' }),
  pair('switch.on.hover', 'Switch', 'Switch track (on)', 'hover', 'non-text', 'colorPrimaryHover', CONTAINER, { scene: 'checkboxRadio', fg: '.t-switch-on', fgProp: 'background', force: 'hover' }),
  pair('switch.off', 'Switch', 'Switch track (off)', 'default', 'non-text', 'colorTextQuaternary', CONTAINER, { scene: 'checkboxRadio', fg: '.t-switch-off', fgProp: 'background' }),
  pair('switch.off.hover', 'Switch', 'Switch track (off)', 'hover', 'non-text', 'colorTextTertiary', CONTAINER, { scene: 'checkboxRadio', fg: '.t-switch-off', fgProp: 'background', force: 'hover' }),
  pair('switch.handle', 'Switch', 'Switch handle', 'checked', 'non-text', 'handleBg', [CONTAINER, 'colorPrimary'], { scene: 'checkboxRadio', fg: '.t-switch-on .ant-switch-handle', fgProp: 'background', fgPseudo: '::before' }),
  pair('segmented.item', 'Segmented', 'Segmented option', 'default', 'text', 'itemColor', [CONTAINER, 'trackBg'], { scene: 'rateSliderSegmented', fg: '.ant-segmented-item:not(.ant-segmented-item-selected):not(.ant-segmented-item-disabled) .ant-segmented-item-label', bg: '.ant-segmented' }),
  pair('segmented.item.hover', 'Segmented', 'Segmented option', 'hover', 'text', 'itemHoverColor', [CONTAINER, 'trackBg', 'itemHoverBg'], { scene: 'rateSliderSegmented', fg: '.ant-segmented-item:not(.ant-segmented-item-selected):not(.ant-segmented-item-disabled) .ant-segmented-item-label', force: 'hover', on: '.ant-segmented-item' }),
  pair('segmented.item.active', 'Segmented', 'Segmented option', 'active', 'text', 'itemHoverColor', [CONTAINER, 'trackBg', 'itemActiveBg'], { scene: 'rateSliderSegmented', fg: '.ant-segmented-item:not(.ant-segmented-item-selected):not(.ant-segmented-item-disabled) .ant-segmented-item-label', force: 'active', on: '.ant-segmented-item' }),
  pair('segmented.item.selected', 'Segmented', 'Selected segmented option', 'selected', 'text', 'itemSelectedColor', [CONTAINER, 'trackBg', 'itemSelectedBg'], { scene: 'rateSliderSegmented', fg: '.ant-segmented-item-selected .ant-segmented-item-label', bg: '.ant-segmented-item-selected' }),
  pair('segmented.item.disabled', 'Segmented', 'Disabled segmented option', 'disabled', 'text', 'colorTextDisabled', [CONTAINER, 'trackBg'], { scene: 'rateSliderSegmented', fg: '.ant-segmented-item-disabled .ant-segmented-item-label' }, disabled),
  pair('slider.track', 'Slider', 'Slider track (value)', 'default', 'non-text', 'trackBg', [CONTAINER, 'railBg'], { scene: 'rateSliderSegmented', fg: '.ant-slider:not(.t-disabled) .ant-slider-track', fgProp: 'background' }),
  pair('slider.track.hover', 'Slider', 'Slider track (value)', 'hover', 'non-text', 'trackHoverBg', [CONTAINER, 'railHoverBg'], { scene: 'rateSliderSegmented', fg: '.ant-slider:not(.t-disabled) .ant-slider-track', fgProp: 'background', force: 'hover', on: '.ant-slider:not(.t-disabled)' }),
  pair('slider.rail', 'Slider', 'Slider rail', 'default', 'non-text', 'railBg', CONTAINER, { scene: 'rateSliderSegmented', fg: '.ant-slider:not(.t-disabled) .ant-slider-rail', fgProp: 'background' }),
  pair('slider.rail.hover', 'Slider', 'Slider rail', 'hover', 'non-text', 'railHoverBg', CONTAINER, { scene: 'rateSliderSegmented', fg: '.ant-slider:not(.t-disabled) .ant-slider-rail', fgProp: 'background', force: 'hover', on: '.ant-slider:not(.t-disabled)' }),
  pair('slider.handle', 'Slider', 'Slider handle ring', 'default', 'non-text', 'handleColor', CONTAINER, undefined),
  pair('slider.handle.active', 'Slider', 'Slider handle ring', 'focus', 'non-text', 'handleActiveColor', CONTAINER, undefined),
  pair('slider.handle.outline', 'Slider', 'Slider handle focus ring', 'focus', 'non-text', 'handleActiveOutlineColor', CONTAINER, undefined),
  pair('slider.dot', 'Slider', 'Slider mark dot', 'default', 'non-text', 'dotBorderColor', CONTAINER, undefined),
  pair('slider.dot.active', 'Slider', 'Slider mark dot (within value)', 'selected', 'non-text', 'dotActiveBorderColor', CONTAINER, undefined),
  pair('slider.track.disabled', 'Slider', 'Disabled slider track', 'disabled', 'non-text', 'trackBgDisabled', CONTAINER, { scene: 'rateSliderSegmented', fg: '.t-disabled .ant-slider-track', fgProp: 'background' }, disabled),
  pair('slider.handle.disabled', 'Slider', 'Disabled slider handle', 'disabled', 'non-text', 'handleColorDisabled', CONTAINER, undefined, disabled),
  pair('rate.star', 'Rate', 'Filled star', 'checked', 'non-text', 'starColor', CONTAINER, { scene: 'rateSliderSegmented', fg: '.ant-rate-star-full .ant-rate-star-second svg', fgProp: 'fill' }),
  pair('rate.star.empty', 'Rate', 'Empty star', 'default', 'non-text', 'starBg', CONTAINER, { scene: 'rateSliderSegmented', fg: '.ant-rate-star-zero .ant-rate-star-second svg', fgProp: 'fill' }),
];

const navigation: Pair[] = [
  pair('menu.item', 'Menu', 'Menu item', 'default', 'text', 'itemColor', [CONTAINER, 'itemBg'], { scene: 'menu', fg: '.t-light .ant-menu-item:not(.ant-menu-item-selected):not(.ant-menu-item-danger):not(.ant-menu-item-disabled) .ant-menu-title-content', bg: '.t-light' }),
  pair('menu.item.hover', 'Menu', 'Menu item', 'hover', 'text', 'itemHoverColor', [CONTAINER, 'itemBg', 'itemHoverBg'], { scene: 'menu', fg: '.t-light .ant-menu-item:not(.ant-menu-item-selected):not(.ant-menu-item-danger):not(.ant-menu-item-disabled) .ant-menu-title-content', bg: '.t-light .ant-menu-item:not(.ant-menu-item-selected):not(.ant-menu-item-danger):not(.ant-menu-item-disabled)', force: 'hover', on: '.t-light .ant-menu-item' }),
  pair('menu.item.active', 'Menu', 'Menu item', 'active', 'text', 'itemHoverColor', [CONTAINER, 'itemBg', 'itemActiveBg'], { scene: 'menu', fg: '.t-light .ant-menu-item:not(.ant-menu-item-selected):not(.ant-menu-item-danger):not(.ant-menu-item-disabled) .ant-menu-title-content', bg: '.t-light .ant-menu-item:not(.ant-menu-item-selected):not(.ant-menu-item-danger):not(.ant-menu-item-disabled)', force: ['hover', 'active'], on: '.t-light .ant-menu-item' }),
  pair('menu.item.selected', 'Menu', 'Selected menu item', 'selected', 'text', 'itemSelectedColor', [CONTAINER, 'itemBg', 'itemSelectedBg'], { scene: 'menu', fg: '.t-light .ant-menu-item-selected .ant-menu-title-content', bg: '.t-light .ant-menu-item-selected' }),
  pair('menu.submenu.selected', 'Menu', 'Submenu title containing the selected item', 'selected', 'text', 'subMenuItemSelectedColor', [CONTAINER, 'itemBg'], undefined),
  pair('menu.submenu.bg', 'Menu', 'Inline submenu item', 'default', 'text', 'itemColor', [CONTAINER, 'itemBg', 'subMenuItemBg'], undefined),
  pair('menu.popup', 'Menu', 'Popup submenu item', 'default', 'text', 'itemColor', [ELEVATED, 'popupBg'], undefined),
  pair('menu.group', 'Menu', 'Menu group title', 'default', 'text', 'groupTitleColor', [CONTAINER, 'itemBg'], { scene: 'menu', fg: '.t-light .ant-menu-item-group-title' }),
  pair('menu.danger', 'Menu', 'Danger menu item', 'default', 'text', 'dangerItemColor', [CONTAINER, 'itemBg'], { scene: 'menu', fg: '.t-light .ant-menu-item-danger .ant-menu-title-content' }),
  pair('menu.danger.hover', 'Menu', 'Danger menu item', 'hover', 'text', 'dangerItemHoverColor', [CONTAINER, 'itemBg', 'itemHoverBg'], { scene: 'menu', fg: '.t-light .ant-menu-item-danger .ant-menu-title-content', bg: '.t-light .ant-menu-item-danger', force: 'hover', on: '.t-light .ant-menu-item' }),
  pair('menu.danger.active', 'Menu', 'Danger menu item (horizontal)', 'active', 'text', 'dangerItemColor', [CONTAINER, 'itemBg', 'dangerItemActiveBg'], { scene: 'menu', fg: '.t-horizontal .ant-menu-item-danger .ant-menu-title-content', bg: '.t-horizontal .ant-menu-item-danger', force: 'active', on: '.t-horizontal .ant-menu-item' }),
  pair('menu.danger.selected', 'Menu', 'Selected danger menu item', 'selected', 'text', 'dangerItemSelectedColor', [CONTAINER, 'itemBg', 'dangerItemSelectedBg'], undefined),
  pair('menu.disabled', 'Menu', 'Disabled menu item', 'disabled', 'text', 'itemDisabledColor', [CONTAINER, 'itemBg'], { scene: 'menu', fg: '.t-light .ant-menu-item-disabled .ant-menu-title-content' }, disabled),
  pair('menu.horizontal.selected', 'Menu', 'Selected horizontal menu item', 'selected', 'text', 'horizontalItemSelectedColor', [CONTAINER, 'itemBg', 'horizontalItemSelectedBg'], { scene: 'menu', fg: '.t-horizontal .ant-menu-item-selected .ant-menu-title-content', bg: '.t-horizontal .ant-menu-item-selected' }),
  pair('menu.horizontal.submenu.hover', 'Menu', 'Horizontal submenu title', 'hover', 'text', 'horizontalItemHoverColor', [CONTAINER, 'itemBg', 'horizontalItemHoverBg'], undefined),
  pair('menu.horizontal.hover', 'Menu', 'Horizontal menu item', 'hover', 'text', 'itemHoverColor', [CONTAINER, 'itemBg', 'horizontalItemHoverBg'], { scene: 'menu', fg: '.t-horizontal .ant-menu-item:not(.ant-menu-item-selected):not(.ant-menu-item-danger) .ant-menu-title-content', bg: '.t-horizontal .ant-menu-item:not(.ant-menu-item-selected):not(.ant-menu-item-danger)', force: 'hover', on: '.t-horizontal .ant-menu-item' }),
  pair('menu.dark.item', 'Menu', 'Dark menu item', 'default', 'text', 'darkItemColor', 'darkItemBg', { scene: 'menu', fg: '.t-dark .ant-menu-item:not(.ant-menu-item-selected):not(.ant-menu-item-danger):not(.ant-menu-item-disabled) .ant-menu-title-content', bg: '.t-dark' }),
  pair('menu.dark.item.hover', 'Menu', 'Dark menu item', 'hover', 'text', 'darkItemHoverColor', ['darkItemBg', 'darkItemHoverBg'], { scene: 'menu', fg: '.t-dark .ant-menu-item:not(.ant-menu-item-selected):not(.ant-menu-item-danger):not(.ant-menu-item-disabled) .ant-menu-title-content', bg: '.t-dark .ant-menu-item:not(.ant-menu-item-selected):not(.ant-menu-item-danger):not(.ant-menu-item-disabled)', force: 'hover', on: '.t-dark .ant-menu-item' }),
  pair('menu.dark.item.selected', 'Menu', 'Selected dark menu item', 'selected', 'text', 'darkItemSelectedColor', ['darkItemBg', 'darkItemSelectedBg'], { scene: 'menu', fg: '.t-dark .ant-menu-item-selected .ant-menu-title-content', bg: '.t-dark .ant-menu-item-selected' }),
  pair('menu.dark.group', 'Menu', 'Dark menu group title', 'default', 'text', 'darkGroupTitleColor', 'darkItemBg', { scene: 'menu', fg: '.t-dark .ant-menu-item-group-title' }),
  pair('menu.dark.danger', 'Menu', 'Dark danger menu item', 'default', 'text', 'darkDangerItemColor', 'darkItemBg', { scene: 'menu', fg: '.t-dark .ant-menu-item-danger .ant-menu-title-content' }),
  pair('menu.dark.danger.hover', 'Menu', 'Dark danger menu item', 'hover', 'text', 'darkDangerItemHoverColor', ['darkItemBg', 'darkItemHoverBg'], { scene: 'menu', fg: '.t-dark .ant-menu-item-danger .ant-menu-title-content', force: 'hover', on: '.t-dark .ant-menu-item' }),
  pair('menu.dark.danger.active', 'Menu', 'Dark danger menu item', 'active', 'text', 'darkDangerItemHoverColor', ['darkItemBg', 'darkDangerItemActiveBg'], undefined),
  pair('menu.dark.danger.selected', 'Menu', 'Selected dark danger menu item', 'selected', 'text', 'darkDangerItemSelectedColor', ['darkItemBg', 'darkDangerItemSelectedBg'], undefined),
  pair('menu.dark.disabled', 'Menu', 'Disabled dark menu item', 'disabled', 'text', 'darkItemDisabledColor', 'darkItemBg', { scene: 'menu', fg: '.t-dark .ant-menu-item-disabled .ant-menu-title-content' }, disabled),
  pair('menu.dark.submenu', 'Menu', 'Dark inline submenu item', 'default', 'text', 'darkItemColor', ['darkItemBg', 'darkSubMenuItemBg'], undefined),
  pair('menu.dark.popup', 'Menu', 'Dark popup submenu item', 'default', 'text', 'darkItemColor', ['darkPopupBg'], undefined),
  pair('dropdown.item', 'Dropdown', 'Dropdown item', 'default', 'text', 'colorText', ELEVATED, { scene: 'dropdown', fg: '.ant-dropdown-menu-item:not(.ant-dropdown-menu-item-danger):not(.ant-dropdown-menu-item-disabled) .ant-dropdown-menu-title-content', bg: '.ant-dropdown-menu' }),
  pair('dropdown.item.hover', 'Dropdown', 'Dropdown item', 'hover', 'text', 'colorText', [ELEVATED, 'controlItemBgHover'], { scene: 'dropdown', fg: '.ant-dropdown-menu-item:not(.ant-dropdown-menu-item-danger):not(.ant-dropdown-menu-item-disabled) .ant-dropdown-menu-title-content', bg: '.ant-dropdown-menu-item:not(.ant-dropdown-menu-item-danger):not(.ant-dropdown-menu-item-disabled)', force: 'hover', on: '.ant-dropdown-menu-item' }),
  pair('dropdown.item.selected', 'Dropdown', 'Selected dropdown item', 'selected', 'text', 'colorPrimary', [ELEVATED, 'controlItemBgActive'], undefined),
  pair('dropdown.item.selected.hover', 'Dropdown', 'Selected dropdown item', 'hover', 'text', 'colorPrimary', [ELEVATED, 'controlItemBgActiveHover'], undefined),
  pair('dropdown.danger', 'Dropdown', 'Danger dropdown item', 'default', 'text', 'colorError', ELEVATED, { scene: 'dropdown', fg: '.ant-dropdown-menu-item-danger .ant-dropdown-menu-title-content' }),
  pair('dropdown.danger.hover', 'Dropdown', 'Danger dropdown item', 'hover', 'text', 'colorTextLightSolid', [ELEVATED, 'colorError'], { scene: 'dropdown', fg: '.ant-dropdown-menu-item-danger .ant-dropdown-menu-title-content', bg: '.ant-dropdown-menu-item-danger', force: 'hover', on: '.ant-dropdown-menu-item' }),
  pair('dropdown.group', 'Dropdown', 'Dropdown group title', 'default', 'text', 'colorTextDescription', ELEVATED, { scene: 'dropdown', fg: '.ant-dropdown-menu-item-group-title' }),
  pair('dropdown.disabled', 'Dropdown', 'Disabled dropdown item', 'disabled', 'text', 'colorTextDisabled', ELEVATED, { scene: 'dropdown', fg: '.ant-dropdown-menu-item-disabled .ant-dropdown-menu-title-content' }, disabled),
  pair('tabs.item', 'Tabs', 'Tab', 'default', 'text', 'itemColor', CONTAINER, { scene: 'tabs', fg: '.t-line .ant-tabs-tab:not(.ant-tabs-tab-active):not(.ant-tabs-tab-disabled) .ant-tabs-tab-btn' }),
  pair('tabs.item.hover', 'Tabs', 'Tab', 'hover', 'text', 'itemHoverColor', CONTAINER, { scene: 'tabs', fg: '.t-line .ant-tabs-tab:not(.ant-tabs-tab-active):not(.ant-tabs-tab-disabled) .ant-tabs-tab-btn', force: 'hover', on: '.t-line .ant-tabs-tab' }),
  pair('tabs.item.active', 'Tabs', 'Tab', 'active', 'text', 'itemActiveColor', CONTAINER, { scene: 'tabs', fg: '.t-line .ant-tabs-tab:not(.ant-tabs-tab-active):not(.ant-tabs-tab-disabled) .ant-tabs-tab-btn', force: 'active' }),
  pair('tabs.item.selected', 'Tabs', 'Selected tab', 'selected', 'text', 'itemSelectedColor', CONTAINER, { scene: 'tabs', fg: '.t-line .ant-tabs-tab-active .ant-tabs-tab-btn' }),
  pair('tabs.ink-bar', 'Tabs', 'Selected tab indicator', 'selected', 'non-text', 'inkBarColor', CONTAINER, { scene: 'tabs', fg: '.t-line .ant-tabs-ink-bar', fgProp: 'background' }),
  pair('tabs.card', 'Tabs', 'Card tab', 'default', 'text', 'itemColor', [CONTAINER, 'cardBg'], { scene: 'tabs', fg: '.t-card .ant-tabs-tab:not(.ant-tabs-tab-active) .ant-tabs-tab-btn', bg: '.t-card .ant-tabs-tab:not(.ant-tabs-tab-active)' }),
  pair('tabs.disabled', 'Tabs', 'Disabled tab', 'disabled', 'text', 'colorTextDisabled', CONTAINER, { scene: 'tabs', fg: '.t-line .ant-tabs-tab-disabled .ant-tabs-tab-btn' }, disabled),
  pair('breadcrumb.link', 'Breadcrumb', 'Breadcrumb link', 'default', 'text', 'linkColor', CONTAINER, { scene: 'breadcrumb', fg: '.ant-breadcrumb a' }),
  pair('breadcrumb.link.hover', 'Breadcrumb', 'Breadcrumb link', 'hover', 'text', 'linkHoverColor', [CONTAINER, 'colorBgTextHover'], { scene: 'breadcrumb', fg: '.ant-breadcrumb a', bg: '.ant-breadcrumb a', force: 'hover' }),
  pair('breadcrumb.item', 'Breadcrumb', 'Breadcrumb item', 'default', 'text', 'itemColor', CONTAINER, undefined),
  pair('breadcrumb.last', 'Breadcrumb', 'Current page', 'default', 'text', 'lastItemColor', CONTAINER, { scene: 'breadcrumb', fg: '.ant-breadcrumb-item:last-child .ant-breadcrumb-link' }),
  pair('breadcrumb.separator', 'Breadcrumb', 'Separator', 'default', 'text', 'separatorColor', CONTAINER, { scene: 'breadcrumb', fg: '.ant-breadcrumb-separator' }),
  pair('pagination.item', 'Pagination', 'Page number', 'default', 'text', 'colorText', [CONTAINER, 'itemBg'], { scene: 'pagination', fg: '.t-pagination .ant-pagination-item-1 a', bg: '.t-pagination .ant-pagination-item-1' }),
  pair('pagination.item.hover', 'Pagination', 'Page number', 'hover', 'text', 'colorText', [CONTAINER, 'colorBgTextHover'], { scene: 'pagination', fg: '.t-pagination .ant-pagination-item-1 a', bg: '.t-pagination .ant-pagination-item-1', force: 'hover' }),
  pair('pagination.item.active', 'Pagination', 'Current page number', 'selected', 'text', 'itemActiveColor', [CONTAINER, 'itemActiveBg'], { scene: 'pagination', fg: '.t-pagination .ant-pagination-item-active a', bg: '.t-pagination .ant-pagination-item-active' }),
  pair('pagination.item.active.hover', 'Pagination', 'Current page number', 'hover', 'text', 'itemActiveColorHover', [CONTAINER, 'itemActiveBg'], { scene: 'pagination', fg: '.t-pagination .ant-pagination-item-active a', force: 'hover', on: '.t-pagination .ant-pagination-item' }),
  pair('pagination.item.active.border', 'Pagination', 'Current page border', 'selected', 'non-text', 'colorPrimary', CONTAINER, { scene: 'pagination', fg: '.t-pagination .ant-pagination-item-active', fgProp: 'border' }),
  pair('pagination.link', 'Pagination', 'Previous and next icons', 'default', 'non-text', 'colorText', [CONTAINER, 'itemLinkBg'], { scene: 'pagination', fg: '.t-pagination .ant-pagination-next svg', fgProp: 'fill' }),
  pair('pagination.input', 'Pagination', 'Quick jumper text', 'default', 'text', 'colorText', [CONTAINER, 'itemInputBg'], undefined),
  pair('pagination.jumper.hover.border', 'Pagination', 'Quick jumper border', 'hover', 'non-text', 'hoverBorderColor', CONTAINER, undefined),
  pair('pagination.jumper.focus.border', 'Pagination', 'Quick jumper border', 'focus', 'non-text', 'activeBorderColor', CONTAINER, undefined),
  pair('pagination.jumper.hover', 'Pagination', 'Quick jumper text', 'hover', 'text', 'colorText', [CONTAINER, 'hoverBg'], undefined),
  pair('pagination.jumper.focus', 'Pagination', 'Quick jumper text', 'focus', 'text', 'colorText', [CONTAINER, 'activeBg'], undefined),
  pair('pagination.jumper.addon', 'Pagination', 'Quick jumper addon', 'default', 'text', 'colorText', [CONTAINER, 'addonBg'], undefined),
  pair('pagination.disabled', 'Pagination', 'Disabled page number', 'disabled', 'text', 'colorTextDisabled', CONTAINER, { scene: 'pagination', fg: '.t-disabled .ant-pagination-item-1 a' }, disabled),
  pair('pagination.active.disabled', 'Pagination', 'Disabled current page number', 'disabled', 'text', 'itemActiveColorDisabled', [CONTAINER, 'itemActiveBgDisabled'], { scene: 'pagination', fg: '.t-disabled .ant-pagination-item-active a', bg: '.t-disabled .ant-pagination-item-active' }, disabled),
  pair('steps.title', 'Steps', 'Step title', 'default', 'text', 'colorText', CONTAINER, { scene: 'progressSteps', fg: '.ant-steps-item-process .ant-steps-item-title' }),
  pair('steps.title.wait', 'Steps', 'Waiting step title', 'default', 'text', 'colorTextDescription', CONTAINER, { scene: 'progressSteps', fg: '.ant-steps-item-wait .ant-steps-item-title' }),
  pair('steps.icon.process', 'Steps', 'Current step number', 'selected', 'text', 'colorTextLightSolid', [CONTAINER, 'colorPrimary'], { scene: 'progressSteps', fg: '.ant-steps:not(.t-nav) .ant-steps-item-process .ant-steps-item-icon-number', bg: '.ant-steps:not(.t-nav) .ant-steps-item-process .ant-steps-item-icon', v5: { fg: '.ant-steps:not(.t-nav) .ant-steps-item-process .ant-steps-icon' } }),
  pair('steps.icon.finish', 'Steps', 'Finished step icon', 'default', 'non-text', 'colorPrimary', [CONTAINER, 'finishIconBgColor'], undefined),
  pair('steps.icon.finish.border', 'Steps', 'Finished step icon border', 'default', 'non-text', 'finishIconBorderColor', CONTAINER, undefined),
  pair('steps.icon.wait', 'Steps', 'Waiting step number', 'default', 'text', 'waitIconColor', [CONTAINER, 'waitIconBgColor'], { scene: 'progressSteps', fg: '.ant-steps-item-wait .ant-steps-icon', bg: '.ant-steps-item-wait .ant-steps-item-icon' }, { majors: [5] }),
  pair('steps.icon.wait.v6', 'Steps', 'Waiting step number', 'default', 'text', 'waitIconColor', [CONTAINER, 'waitIconBgColor'], undefined, { majors: [6] }),
  pair('steps.icon.wait.border', 'Steps', 'Waiting step icon border', 'default', 'non-text', 'waitIconBorderColor', CONTAINER, undefined),
  pair('steps.nav-arrow', 'Steps', 'Navigation arrow', 'default', 'non-text', 'navArrowColor', CONTAINER, undefined),
];

const data: Pair[] = [
  pair('table.header', 'Table', 'Table header', 'default', 'text', 'headerColor', [CONTAINER, 'headerBg'], { scene: 'table', fg: 'th.ant-table-cell:not(.ant-table-selection-column):not(.ant-table-column-has-sorters)', bg: 'th.ant-table-cell:not(.ant-table-selection-column):not(.ant-table-column-has-sorters)' }),
  pair('table.header.sort-hover', 'Table', 'Sortable header', 'hover', 'text', 'headerColor', [CONTAINER, 'headerSortHoverBg'], { scene: 'table', fg: 'th.ant-table-column-has-sorters .ant-table-column-title .ant-table-column-title', bg: 'th.ant-table-column-has-sorters', force: 'hover' }),
  pair('table.header.sort-active', 'Table', 'Sorted header', 'selected', 'text', 'headerColor', [CONTAINER, 'headerSortActiveBg'], undefined),
  pair('table.header.sort-fixed', 'Table', 'Sorted fixed header', 'selected', 'text', 'headerColor', [CONTAINER, 'fixedHeaderSortActiveBg'], undefined),
  pair('table.header.icon', 'Table', 'Sort and filter icons', 'default', 'non-text', 'headerIconColor', [CONTAINER, 'headerBg'], { scene: 'table', fg: '.ant-table-filter-trigger svg', fgProp: 'fill' }),
  pair('table.header.icon.hover', 'Table', 'Sort and filter icons', 'hover', 'non-text', 'headerIconHoverColor', [CONTAINER, 'headerBg', 'headerFilterHoverBg'], undefined),
  pair('table.header.filter-hover', 'Table', 'Filter trigger', 'hover', 'non-text', 'colorIcon', [CONTAINER, 'headerBg', 'headerFilterHoverBg'], { scene: 'table', fg: '.ant-table-filter-trigger svg', fgProp: 'fill', bg: '.ant-table-filter-trigger', force: 'hover', on: '.ant-table-filter-trigger' }),
  pair('table.cell', 'Table', 'Table cell', 'default', 'text', 'colorText', CONTAINER, { scene: 'table', fg: 'tr:not(.ant-table-row-selected) > td.ant-table-cell:not(.ant-table-selection-column)', bg: '.ant-table' }),
  pair('table.cell.sorted', 'Table', 'Cell in the sorted column', 'selected', 'text', 'colorText', [CONTAINER, 'bodySortBg'], undefined),
  pair('table.row.hover', 'Table', 'Hovered row', 'hover', 'text', 'colorText', [CONTAINER, 'rowHoverBg'], undefined),
  pair('table.row.selected', 'Table', 'Selected row', 'selected', 'text', 'colorText', [CONTAINER, 'rowSelectedBg'], { scene: 'table', fg: 'tr.ant-table-row-selected > td.ant-table-cell:not(.ant-table-selection-column)', bg: 'tr.ant-table-row-selected > td.ant-table-cell:not(.ant-table-selection-column)' }),
  pair('table.row.selected.hover', 'Table', 'Selected row, hovered', 'hover', 'text', 'colorText', [CONTAINER, 'rowSelectedHoverBg'], undefined),
  pair('table.row.expanded', 'Table', 'Expanded row content', 'default', 'text', 'colorText', [CONTAINER, 'rowExpandedBg'], undefined),
  pair('table.footer', 'Table', 'Table footer', 'default', 'text', 'footerColor', [CONTAINER, 'footerBg'], { scene: 'table', fg: '.ant-table-footer', bg: '.ant-table-footer' }),
  pair('table.filter', 'Table', 'Filter dropdown item', 'default', 'text', 'colorText', [ELEVATED, 'filterDropdownBg'], undefined),
  pair('table.filter.menu', 'Table', 'Filter menu item', 'default', 'text', 'colorText', [ELEVATED, 'filterDropdownMenuBg'], undefined),
  pair('table.expand-icon', 'Table', 'Row expand button', 'default', 'non-text', 'colorText', [CONTAINER, 'expandIconBg'], undefined),
  pair('tree.node', 'Tree', 'Tree node', 'default', 'text', 'colorText', CONTAINER, { scene: 'tree', fg: '.ant-tree:not(.ant-tree-directory) .ant-tree-treenode:not(.ant-tree-treenode-disabled):not(.ant-tree-treenode-selected) .ant-tree-title', bg: '.ant-tree:not(.ant-tree-directory)' }),
  pair('tree.node.hover', 'Tree', 'Tree node', 'hover', 'text', 'nodeHoverColor', [CONTAINER, 'nodeHoverBg'], { scene: 'tree', fg: '.ant-tree:not(.ant-tree-directory) .ant-tree-treenode:not(.ant-tree-treenode-disabled):not(.ant-tree-treenode-selected) .ant-tree-title', bg: '.ant-tree:not(.ant-tree-directory) .ant-tree-treenode:not(.ant-tree-treenode-disabled):not(.ant-tree-treenode-selected) .ant-tree-node-content-wrapper', force: 'hover', on: '.ant-tree:not(.ant-tree-directory) .ant-tree-node-content-wrapper' }),
  pair('tree.node.selected', 'Tree', 'Selected tree node', 'selected', 'text', 'nodeSelectedColor', [CONTAINER, 'nodeSelectedBg'], { scene: 'tree', fg: '.ant-tree:not(.ant-tree-directory) .ant-tree-node-selected .ant-tree-title', bg: '.ant-tree:not(.ant-tree-directory) .ant-tree-node-selected' }),
  pair('tree.directory.selected', 'Tree', 'Selected directory tree node', 'selected', 'text', 'directoryNodeSelectedColor', [CONTAINER, 'directoryNodeSelectedBg'], { scene: 'tree', fg: '.ant-tree-directory .ant-tree-node-selected .ant-tree-title', bg: '.ant-tree-directory .ant-tree-treenode-selected' }),
  pair('tree.disabled', 'Tree', 'Disabled tree node', 'disabled', 'text', 'colorTextDisabled', CONTAINER, { scene: 'tree', fg: '.ant-tree:not(.ant-tree-directory) .ant-tree-treenode-disabled .ant-tree-title' }, disabled),
  pair('list.header', 'List', 'List header', 'default', 'text', 'colorText', [CONTAINER, 'headerBg'], { scene: 'list', fg: '.ant-list-header', bg: '.ant-list-header' }),
  pair('list.footer', 'List', 'List footer', 'default', 'text', 'colorText', [CONTAINER, 'footerBg'], { scene: 'list', fg: '.ant-list-footer', bg: '.ant-list-footer' }),
  pair('descriptions.title', 'Descriptions', 'Descriptions title', 'default', 'text', 'titleColor', CONTAINER, { scene: 'descriptions', fg: '.ant-descriptions-title' }, { fontSize: 'fontSizeLG', fontWeight: 'fontWeightStrong' }),
  pair('descriptions.extra', 'Descriptions', 'Descriptions extra', 'default', 'text', 'extraColor', CONTAINER, { scene: 'descriptions', fg: '.ant-descriptions-extra' }),
  pair('descriptions.label', 'Descriptions', 'Descriptions label (unbordered)', 'default', 'text', 'labelColor', CONTAINER, undefined),
  pair('descriptions.label.bordered', 'Descriptions', 'Descriptions label (bordered)', 'default', 'text', 'colorTextSecondary', [CONTAINER, 'labelBg'], { scene: 'descriptions', fg: '.ant-descriptions-item-label > span', bg: '.ant-descriptions-item-label', v5: { fg: '.ant-descriptions-item-label' } }),
  pair('descriptions.content', 'Descriptions', 'Descriptions content', 'default', 'text', 'contentColor', CONTAINER, { scene: 'descriptions', fg: '.ant-descriptions-item-content > span' }),
  pair('tag.default', 'Tag', 'Tag', 'default', 'text', 'defaultColor', [CONTAINER, 'defaultBg'], { scene: 'tag', fg: '.t-default', bg: '.t-default' }),
  pair('tag.success', 'Tag', 'Success tag', 'default', 'text', 'colorSuccess', [CONTAINER, 'colorSuccessBg'], { scene: 'tag', fg: '.t-success', bg: '.t-success' }),
  pair('tag.error', 'Tag', 'Error tag', 'default', 'text', 'colorError', [CONTAINER, 'colorErrorBg'], { scene: 'tag', fg: '.t-error', bg: '.t-error' }),
  pair('tag.warning', 'Tag', 'Warning tag', 'default', 'text', 'colorWarning', [CONTAINER, 'colorWarningBg'], { scene: 'tag', fg: '.t-warning', bg: '.t-warning' }),
  pair('tag.processing', 'Tag', 'Processing tag', 'default', 'text', 'colorInfo', [CONTAINER, 'colorInfoBg'], { scene: 'tag', fg: '.t-processing', bg: '.t-processing' }),
  pair('tag.checkable', 'Tag', 'Checked checkable tag', 'checked', 'text', 'colorTextLightSolid', [CONTAINER, 'colorPrimary'], { scene: 'tag', fg: '.t-checkable', bg: '.t-checkable' }),
  pair('tag.checkable.hover', 'Tag', 'Checked checkable tag', 'hover', 'text', 'colorTextLightSolid', [CONTAINER, 'colorPrimaryHover'], { scene: 'tag', fg: '.t-checkable', bg: '.t-checkable', force: 'hover' }),
  pair('tag.solid', 'Tag', 'Solid tag', 'default', 'text', 'solidTextColor', [CONTAINER, 'colorPrimary'], undefined, { majors: [6] }),
  pair('badge.count', 'Badge', 'Badge count', 'default', 'text', 'colorTextLightSolid', [CONTAINER, 'colorError'], { scene: 'badge', fg: '.ant-scroll-number-only-unit', bg: '.ant-badge-count' }),
  pair('badge.status', 'Badge', 'Status dot', 'default', 'non-text', 'colorSuccess', CONTAINER, { scene: 'badge', fg: '.ant-badge-status-success', fgProp: 'background' }),
  pair('avatar', 'Avatar', 'Avatar initials', 'default', 'text', 'colorTextLightSolid', [CONTAINER, 'colorTextPlaceholder'], { scene: 'badge', fg: '.ant-avatar-square .ant-avatar-string', bg: '.ant-avatar-square' }),
  pair('card.title', 'Card', 'Card title', 'default', 'text', 'colorTextHeading', [CONTAINER, 'headerBg'], { scene: 'card', fg: '.ant-card-head-title', bg: '.ant-card-head' }, { fontSize: 'fontSizeLG', fontWeight: 'fontWeightStrong' }),
  pair('card.extra', 'Card', 'Card extra', 'default', 'text', 'extraColor', [CONTAINER, 'headerBg'], undefined),
  pair('card.body', 'Card', 'Card content', 'default', 'text', 'colorText', CONTAINER, { scene: 'card', fg: '.ant-card-body', bg: '.ant-card' }),
  pair('card.actions', 'Card', 'Card action', 'default', 'text', 'colorTextDescription', [CONTAINER, 'actionsBg'], { scene: 'card', fg: '.ant-card-actions li span span', bg: '.ant-card-actions' }),
  pair('collapse.header', 'Collapse', 'Panel header', 'default', 'text', 'colorTextHeading', [CONTAINER, 'headerBg'], { scene: 'collapse', fg: '.ant-collapse:not(.t-borderless) .ant-collapse-title', bg: '.ant-collapse:not(.t-borderless)', v5: { fg: '.ant-collapse:not(.t-borderless) .ant-collapse-header-text' } }),
  pair('collapse.content', 'Collapse', 'Panel content', 'default', 'text', 'colorText', [CONTAINER, 'headerBg', 'contentBg'], { scene: 'collapse', fg: '.ant-collapse:not(.t-borderless) .ant-collapse-body', v5: { fg: '.ant-collapse:not(.t-borderless) .ant-collapse-content-box' } }),
  pair('collapse.content.borderless', 'Collapse', 'Borderless panel content', 'default', 'text', 'colorText', [CONTAINER, 'headerBg', 'borderlessContentBg'], undefined),
  pair('statistic.title', 'Statistic', 'Statistic title', 'default', 'text', 'colorTextDescription', CONTAINER, { scene: 'misc', fg: '.ant-statistic-title' }),
  pair('statistic.value', 'Statistic', 'Statistic value', 'default', 'text', 'colorTextHeading', CONTAINER, { scene: 'misc', fg: '.ant-statistic-content-value-int' }, { fontSize: 'fontSizeHeading3' }),
  pair('empty.description', 'Empty', 'Empty-state text', 'default', 'text', 'colorTextDescription', CONTAINER, { scene: 'misc', fg: '.ant-empty-description' }),
  pair('result.title', 'Result', 'Result title', 'default', 'text', 'colorTextHeading', CONTAINER, { scene: 'misc', fg: '.ant-result-title' }, { fontSize: 'fontSizeHeading3' }),
  pair('result.subtitle', 'Result', 'Result subtitle', 'default', 'text', 'colorTextDescription', CONTAINER, { scene: 'misc', fg: '.ant-result-subtitle' }),
  pair('progress.text', 'Progress', 'Progress percentage', 'default', 'text', 'colorText', CONTAINER, { scene: 'progressSteps', fg: '.t-line .ant-progress-indicator', v5: { fg: '.t-line .ant-progress-text' } }),
  pair('progress.circle-text', 'Progress', 'Circle progress percentage', 'default', 'text', 'circleTextColor', CONTAINER, { scene: 'progressSteps', fg: '.t-circle .ant-progress-indicator', v5: { fg: '.t-circle .ant-progress-text' } }),
  pair('progress.bar', 'Progress', 'Progress bar', 'default', 'non-text', 'defaultColor', [CONTAINER, 'remainingColor'], { scene: 'progressSteps', fg: '.t-line .ant-progress-track', fgProp: 'background', v5: { fg: '.t-line .ant-progress-bg' } }),
  pair('progress.rail', 'Progress', 'Progress rail', 'default', 'non-text', 'remainingColor', CONTAINER, { scene: 'progressSteps', fg: '.t-line .ant-progress-rail', fgProp: 'background', v5: { fg: '.t-line .ant-progress-inner' } }),
  pair('timeline.dot', 'Timeline', 'Timeline dot', 'default', 'non-text', 'colorPrimary', CONTAINER, undefined),
  pair('timeline.dot.bg', 'Timeline', 'Timeline dot', 'default', 'non-text', 'colorPrimary', [CONTAINER, 'dotBg'], undefined, { majors: [5] }),
  pair('upload.item', 'Upload', 'Uploaded file name', 'default', 'text', 'colorText', CONTAINER, { scene: 'upload', fg: '.ant-upload-list-item-done .ant-upload-list-item-name' }),
  pair('upload.item.hover', 'Upload', 'Uploaded file name', 'hover', 'text', 'colorText', [CONTAINER, 'controlItemBgHover'], { scene: 'upload', fg: '.ant-upload-list-item-done .ant-upload-list-item-name', bg: '.ant-upload-list-item-done', force: 'hover', on: '.ant-upload-list-item' }),
  pair('upload.item.error', 'Upload', 'Failed file name', 'error', 'text', 'colorError', CONTAINER, { scene: 'upload', fg: '.ant-upload-list-item-error .ant-upload-list-item-name' }),
  pair('upload.action', 'Upload', 'Remove file button', 'default', 'non-text', 'actionsColor', CONTAINER, { scene: 'upload', fg: '.ant-upload-list-item-done .anticon-delete svg', fgProp: 'fill' }),
  pair('image.preview', 'Image', 'Preview toolbar icon', 'default', 'non-text', 'previewOperationColor', 'colorBgMask', undefined),
  pair('image.preview.hover', 'Image', 'Preview toolbar icon', 'hover', 'non-text', 'previewOperationHoverColor', 'colorBgMask', undefined),
  pair('image.preview.disabled', 'Image', 'Disabled preview toolbar icon', 'disabled', 'non-text', 'previewOperationColorDisabled', 'colorBgMask', undefined, disabled),
  pair('qrcode.cover', 'QRCode', 'Expired QR code message', 'default', 'text', 'colorText', [CONTAINER, 'QRCodeCoverBackgroundColor'], undefined, { majors: [6] }),
  pair('qrcode.mask', 'QRCode', 'Expired QR code message', 'default', 'text', 'colorText', [CONTAINER, 'QRCodeMaskBackgroundColor'], undefined, { majors: [5] }),
  pair('skeleton', 'Skeleton', 'Skeleton block', 'default', 'non-text', 'color', CONTAINER, undefined),
];

const feedback: Pair[] = [
  pair('alert.success', 'Alert', 'Success alert text', 'default', 'text', 'colorText', [CONTAINER, 'colorSuccessBg'], { scene: 'alert', fg: '.t-success .ant-alert-description', bg: '.t-success' }),
  pair('alert.success.title', 'Alert', 'Success alert title', 'default', 'text', 'colorTextHeading', [CONTAINER, 'colorSuccessBg'], { scene: 'alert', fg: '.t-success .ant-alert-title', v5: { fg: '.t-success .ant-alert-message' } }),
  pair('alert.success.icon', 'Alert', 'Success alert icon', 'default', 'non-text', 'colorSuccess', [CONTAINER, 'colorSuccessBg'], { scene: 'alert', fg: '.t-success .ant-alert-icon svg', fgProp: 'fill' }),
  pair('alert.info', 'Alert', 'Info alert text', 'default', 'text', 'colorText', [CONTAINER, 'colorInfoBg'], { scene: 'alert', fg: '.t-info .ant-alert-title', bg: '.t-info', v5: { fg: '.t-info .ant-alert-message' } }),
  pair('alert.info.icon', 'Alert', 'Info alert icon', 'default', 'non-text', 'colorInfo', [CONTAINER, 'colorInfoBg'], { scene: 'alert', fg: '.t-info .ant-alert-icon svg', fgProp: 'fill' }),
  pair('alert.warning', 'Alert', 'Warning alert text', 'default', 'text', 'colorText', [CONTAINER, 'colorWarningBg'], { scene: 'alert', fg: '.t-warning .ant-alert-title', bg: '.t-warning', v5: { fg: '.t-warning .ant-alert-message' } }),
  pair('alert.warning.icon', 'Alert', 'Warning alert icon', 'default', 'non-text', 'colorWarning', [CONTAINER, 'colorWarningBg'], { scene: 'alert', fg: '.t-warning .ant-alert-icon svg', fgProp: 'fill' }),
  pair('alert.error', 'Alert', 'Error alert text', 'default', 'text', 'colorText', [CONTAINER, 'colorErrorBg'], { scene: 'alert', fg: '.t-error .ant-alert-title', bg: '.t-error', v5: { fg: '.t-error .ant-alert-message' } }),
  pair('alert.error.icon', 'Alert', 'Error alert icon', 'default', 'non-text', 'colorError', [CONTAINER, 'colorErrorBg'], { scene: 'alert', fg: '.t-error .ant-alert-icon svg', fgProp: 'fill' }),
  pair('tooltip', 'Tooltip', 'Tooltip text', 'default', 'text', 'colorTextLightSolid', [CONTAINER, 'colorBgSpotlight'], { scene: 'popups', fg: '.ant-tooltip-container', bg: '.ant-tooltip-container', v5: { fg: '.ant-tooltip-inner', bg: '.ant-tooltip-inner' } }),
  pair('popover.title', 'Popover', 'Popover title', 'default', 'text', 'colorTextHeading', ELEVATED, { scene: 'popups', fg: '.ant-popover-title' }),
  pair('popconfirm.icon', 'Popconfirm', 'Popconfirm warning icon', 'default', 'non-text', 'colorWarning', ELEVATED, { scene: 'popups', fg: '.ant-popconfirm-message-icon svg', fgProp: 'fill' }),
  pair('modal.title', 'Modal', 'Modal title', 'default', 'text', 'titleColor', [CONTAINER, 'contentBg', 'headerBg'], { scene: 'modal', fg: '.ant-modal-title', bg: '.ant-modal-header' }, { fontSize: 'fontSizeLG', fontWeight: 'fontWeightStrong' }),
  pair('modal.body', 'Modal', 'Modal content', 'default', 'text', 'colorText', [CONTAINER, 'contentBg'], { scene: 'modal', fg: '.ant-modal-body', bg: '.ant-modal-container', v5: { bg: '.ant-modal-content' } }),
  pair('modal.footer', 'Modal', 'Modal footer text', 'default', 'text', 'colorText', [CONTAINER, 'contentBg', 'footerBg'], { scene: 'modal', fg: '.ant-modal-footer', bg: '.ant-modal-footer' }),
  pair('modal.close', 'Modal', 'Close button', 'default', 'non-text', 'colorIcon', [CONTAINER, 'contentBg'], { scene: 'modal', fg: '.ant-modal-close svg', fgProp: 'fill' }),
  pair('modal.close.hover', 'Modal', 'Close button', 'hover', 'non-text', 'colorIconHover', [CONTAINER, 'contentBg', 'colorBgTextHover'], { scene: 'modal', fg: '.ant-modal-close svg', fgProp: 'fill', bg: '.ant-modal-close', force: 'hover', on: '.ant-modal-close' }),
  pair('modal.close.active', 'Modal', 'Close button', 'active', 'non-text', 'colorIconHover', [CONTAINER, 'contentBg', 'colorBgTextActive'], undefined),
  pair('message', 'Message', 'Message text', 'default', 'text', 'colorTextHeading', [CONTAINER, 'contentBg'], { scene: 'messageNotification', fg: '.ant-message-notice-title', bg: '.ant-message-notice' }, { majors: [6] }),
  // antd 5's message text sets no colour of its own, so it inherits the page's.
  pair('message.v5', 'Message', 'Message text', 'default', 'text', 'colorText', [CONTAINER, 'contentBg'], undefined, { majors: [5] }),
  pair('notification.title', 'Notification', 'Notification title', 'default', 'text', 'colorTextHeading', ELEVATED, { scene: 'messageNotification', fg: '.ant-notification-notice-title', bg: '.ant-notification-notice', v5: { fg: '.ant-notification-notice-message', bg: '.ant-notification-notice-pure-panel' } }),
  pair('notification.description', 'Notification', 'Notification description', 'default', 'text', 'colorText', ELEVATED, { scene: 'messageNotification', fg: '.ant-notification-notice-description' }),
  pair('tour.text', 'Tour', 'Primary tour text', 'default', 'text', 'colorTextLightSolid', [CONTAINER, 'colorPrimary'], { scene: 'tour', fg: '.ant-tour-description', bg: '.ant-tour-section', v5: { bg: '.ant-tour-inner' } }),
  pair('tour.prev', 'Tour', 'Primary tour "Previous" button', 'default', 'text', 'colorTextLightSolid', [CONTAINER, 'colorPrimary'], { scene: 'tour', fg: '.ant-tour-actions .ant-btn:first-child > span', bg: '.ant-tour-actions .ant-btn:first-child', v5: { fg: '.ant-tour-buttons .ant-btn:first-child > span', bg: '.ant-tour-buttons .ant-btn:first-child' } }),
  pair('tour.prev.hover', 'Tour', 'Primary tour "Previous" button', 'hover', 'text', 'colorTextLightSolid', [CONTAINER, 'colorPrimary', 'primaryPrevBtnBg'], { scene: 'tour', fg: '.ant-tour-actions .ant-btn:first-child > span', bg: '.ant-tour-actions .ant-btn:first-child', force: 'hover', v5: { fg: '.ant-tour-buttons .ant-btn:first-child > span', bg: '.ant-tour-buttons .ant-btn:first-child' } }),
  pair('tour.next', 'Tour', 'Primary tour "Next" button', 'default', 'text', 'colorPrimary', [CONTAINER, 'colorPrimary', 'colorWhite'], { scene: 'tour', fg: '.ant-tour-actions .ant-btn:last-child > span', bg: '.ant-tour-actions .ant-btn:last-child', v5: { fg: '.ant-tour-buttons .ant-btn:last-child > span', bg: '.ant-tour-buttons .ant-btn:last-child' } }),
  pair('tour.next.hover', 'Tour', 'Primary tour "Next" button', 'hover', 'text', 'colorPrimary', [CONTAINER, 'colorPrimary', 'primaryNextBtnHoverBg'], { scene: 'tour', fg: '.ant-tour-actions .ant-btn:last-child > span', bg: '.ant-tour-actions .ant-btn:last-child', force: 'hover', v5: { fg: '.ant-tour-buttons .ant-btn:last-child > span', bg: '.ant-tour-buttons .ant-btn:last-child' } }),
  pair('layout.header', 'Layout', 'Header text', 'default', 'text', 'headerColor', 'headerBg', { scene: 'layout', fg: 'header.ant-layout-header', bg: 'header.ant-layout-header' }),
  pair('layout.body', 'Layout', 'Content on the layout body', 'default', 'text', 'colorText', 'bodyBg', { scene: 'layout', fg: 'main.ant-layout-content', bg: '.ant-layout' }),
  pair('layout.footer', 'Layout', 'Footer text', 'default', 'text', 'colorText', ['bodyBg', 'footerBg'], { scene: 'layout', fg: 'footer.ant-layout-footer', bg: 'footer.ant-layout-footer' }),
  pair('layout.sider', 'Layout', 'Dark sider menu text', 'default', 'text', 'colorTextLightSolid', 'siderBg', undefined),
  pair('layout.trigger', 'Layout', 'Sider collapse button', 'default', 'non-text', 'triggerColor', 'triggerBg', { scene: 'layout', fg: '.ant-layout-sider-dark .ant-layout-sider-trigger svg', fgProp: 'fill', bg: '.ant-layout-sider-dark .ant-layout-sider-trigger' }),
  pair('layout.light-sider', 'Layout', 'Light sider text', 'default', 'text', 'colorText', 'lightSiderBg', undefined),
  pair('layout.light-trigger', 'Layout', 'Light sider collapse button', 'default', 'non-text', 'lightTriggerColor', 'lightTriggerBg', { scene: 'layout', fg: '.t-light-sider .ant-layout-sider-trigger svg', fgProp: 'fill', bg: '.t-light-sider .ant-layout-sider-trigger' }),
  pair('focus.outline', 'Button', 'Focus ring', 'focus', 'non-text', 'colorPrimaryBorder', CONTAINER, undefined),
];

const presets = ['blue', 'purple', 'cyan', 'green', 'magenta', 'pink', 'red', 'orange', 'yellow', 'volcano', 'geekblue', 'lime', 'gold'];
const presetTags: Pair[] = presets.map((color) =>
  pair(`tag.preset.${color}`, 'Tag', `Tag color="${color}"`, 'default', 'text', `${color}7`, [CONTAINER, `${color}1`], color === 'blue' ? { scene: 'tag', fg: '.t-blue', bg: '.t-blue' } : undefined),
);

export const PAIRS: readonly Pair[] = [
  ...tokenPairs,
  ...typography,
  ...button,
  ...input,
  ...inputNumber,
  ...mentions,
  ...form,
  ...select,
  ...picker,
  ...choice,
  ...navigation,
  ...data,
  ...feedback,
  ...presetTags,
];

/** Pairs that apply to an antd major. */
export function pairsFor(major: number): Pair[] {
  return PAIRS.filter((p) => !p.majors || p.majors.includes(major));
}
