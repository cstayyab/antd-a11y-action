// Finds the app's antd themes without running its code: `<ConfigProvider theme={…}>` props and
// objects typed or checked as `ThemeConfig`, evaluated only when they are literal (values, antd's
// algorithms, and constants in the same file). A conditional (`dark ? darkAlgorithm : …`) becomes
// one configuration per branch. Anything else is reported as skipped, with the reason.
import { parse } from '@typescript-eslint/parser';
import type { TSESTree } from '@typescript-eslint/types';
import { ALGORITHMS, type AlgorithmName, type ThemeInput } from './tokens.js';

type Node = TSESTree.Node;

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
}

export interface DiscoveredTheme {
  /** e.g. "src/App.tsx:12 (dark)" */
  name: string;
  file: string;
  line: number;
  input: ThemeInput;
  /** Where each value was set: "token.colorPrimary", "components.Button.primaryColor", "algorithm". */
  locations: Map<string, SourceLocation>;
}

export interface SkippedTheme {
  file: string;
  line: number;
  reason: string;
}

export interface Discovery {
  themes: DiscoveredTheme[];
  skipped: SkippedTheme[];
}

/** Variants beyond this many per theme are dropped, with a note; each conditional doubles them. */
const MAX_VARIANTS = 8;

class Skip extends Error {
  constructor(
    readonly node: Node,
    reason: string,
  ) {
    super(reason);
  }
}

interface Algo {
  algorithm: AlgorithmName;
}
type Value = string | number | boolean | null | undefined | Algo | Value[] | { [key: string]: Value };

interface Variant {
  value: Value;
  locations: Map<string, TSESTree.SourceLocation>;
  /** Branch conditions taken, e.g. "isDark", "!isDark". */
  labels: string[];
}

const isAlgo = (v: unknown): v is Algo => !!v && typeof v === 'object' && 'algorithm' in v && ALGORITHMS.includes((v as Algo).algorithm) && Object.keys(v).length === 1;

/** Quick filter so only candidate files are parsed. */
export function mayContainTheme(code: string): boolean {
  return /\bConfigProvider\b|\bThemeConfig\b/.test(code);
}

export function discoverInFile(file: string, code: string): Discovery {
  const out: Discovery = { themes: [], skipped: [] };
  if (!mayContainTheme(code)) return out;
  let ast: TSESTree.Program;
  try {
    ast = parse(code, { jsx: true, loc: true, range: true, ecmaVersion: 'latest', sourceType: 'module' }) as TSESTree.Program;
  } catch (error) {
    out.skipped.push({ file, line: 1, reason: `could not parse the file (${(error as Error).message.split('\n')[0]})` });
    return out;
  }

  // antd imports: ConfigProvider, the theme namespace, algorithms destructured from it, ThemeConfig.
  const configProviders = new Set<string>();
  const themeNamespaces = new Set<string>();
  const themeConfigTypes = new Set<string>();
  const antdNamespaces = new Set<string>();
  for (const stmt of ast.body) {
    if (stmt.type !== 'ImportDeclaration' || stmt.source.value !== 'antd') continue;
    for (const spec of stmt.specifiers) {
      if (spec.type === 'ImportNamespaceSpecifier' || spec.type === 'ImportDefaultSpecifier') antdNamespaces.add(spec.local.name);
      else if (spec.type === 'ImportSpecifier') {
        const imported = spec.imported.type === 'Identifier' ? spec.imported.name : spec.imported.value;
        if (imported === 'ConfigProvider') configProviders.add(spec.local.name);
        if (imported === 'theme') themeNamespaces.add(spec.local.name);
        if (imported === 'ThemeConfig') themeConfigTypes.add(spec.local.name);
      }
    }
  }
  if (!configProviders.size && !themeConfigTypes.size && !antdNamespaces.size) return out;

  // Constants anywhere in the file, by name; a name declared twice is ambiguous and not resolved.
  const consts = new Map<string, TSESTree.Expression | null>();
  const algorithmNames = new Map<string, AlgorithmName>();
  const visit = (node: Node, fn: (n: Node, parents: Node[]) => void, parents: Node[] = []) => {
    fn(node, parents);
    for (const key of Object.keys(node) as (keyof typeof node)[]) {
      if (key === 'parent') continue;
      const child = node[key] as unknown;
      const next = [...parents, node];
      const isNode = (c: unknown): c is Node => !!c && typeof (c as Node).type === 'string';
      for (const c of Array.isArray(child) ? child : [child]) if (isNode(c)) visit(c, fn, next);
    }
  };
  const isThemeNamespace = (node: Node): boolean =>
    (node.type === 'Identifier' && themeNamespaces.has(node.name)) ||
    (node.type === 'MemberExpression' && node.object.type === 'Identifier' && antdNamespaces.has(node.object.name) &&
      node.property.type === 'Identifier' && node.property.name === 'theme');
  visit(ast, (node, parents) => {
    if (node.type !== 'VariableDeclarator') return;
    const decl = parents.at(-1);
    if (decl?.type !== 'VariableDeclaration' || decl.kind !== 'const') return;
    if (node.id.type === 'Identifier') {
      consts.set(node.id.name, consts.has(node.id.name) ? null : node.init);
    } else if (node.id.type === 'ObjectPattern' && node.init && isThemeNamespace(node.init)) {
      for (const prop of node.id.properties) {
        if (prop.type !== 'Property' || prop.key.type !== 'Identifier' || prop.value.type !== 'Identifier') continue;
        if ((ALGORITHMS as readonly string[]).includes(prop.key.name)) algorithmNames.set(prop.value.name, prop.key.name as AlgorithmName);
      }
    }
  });

  const describe = (node: Node) => `${node.type.replace(/Expression$/, ' expression')} at line ${node.loc.start.line}`;
  const resolving = new Set<string>();

  /** All variants of a value: one unless a conditional sits somewhere inside. */
  const evaluate = (node: Node, path: string): Variant[] => {
    const one = (value: Value): Variant[] => [{ value, locations: new Map(), labels: [] }];
    switch (node.type) {
      case 'Literal':
        if (node.value instanceof RegExp || typeof node.value === 'bigint') throw new Skip(node, `a ${typeof node.value} is not a theme value`);
        return one(node.value as Value);
      case 'TemplateLiteral':
        if (node.expressions.length) throw new Skip(node, `a template string with \${…} at line ${node.loc.start.line}`);
        return one(node.quasis[0].value.cooked ?? '');
      case 'UnaryExpression':
        if (node.operator === '-' && node.argument.type === 'Literal' && typeof node.argument.value === 'number') return one(-node.argument.value);
        throw new Skip(node, describe(node));
      case 'TSAsExpression':
      case 'TSSatisfiesExpression':
      case 'TSNonNullExpression':
        return evaluate(node.expression, path);
      case 'Identifier': {
        if (node.name === 'undefined') return one(undefined);
        const algo = algorithmNames.get(node.name);
        if (algo) return one({ algorithm: algo });
        if (!consts.has(node.name)) throw new Skip(node, `\`${node.name}\` is not a constant defined in this file`);
        const init = consts.get(node.name);
        if (!init) throw new Skip(node, `\`${node.name}\` is declared more than once in this file`);
        if (resolving.has(node.name)) throw new Skip(node, `\`${node.name}\` refers to itself`);
        resolving.add(node.name);
        try {
          return evaluate(init, path);
        } finally {
          resolving.delete(node.name);
        }
      }
      case 'MemberExpression': {
        if (!node.computed && node.property.type === 'Identifier' && isThemeNamespace(node.object)) {
          const name = node.property.name;
          if ((ALGORITHMS as readonly string[]).includes(name)) return one({ algorithm: name as AlgorithmName });
        }
        throw new Skip(node, `\`${code.slice(node.range[0], node.range[1])}\` at line ${node.loc.start.line} needs code to run`);
      }
      case 'ConditionalExpression': {
        const test = code.slice(node.test.range[0], node.test.range[1]);
        const yes = evaluate(node.consequent, path).map((v) => ({ ...v, labels: [...v.labels, test] }));
        const no = evaluate(node.alternate, path).map((v) => ({ ...v, labels: [...v.labels, `!${test}`] }));
        return [...yes, ...no];
      }
      case 'ArrayExpression': {
        let variants: Variant[] = one([]);
        for (const el of node.elements) {
          if (!el) continue;
          if (el.type === 'SpreadElement') throw new Skip(el, `an array spread at line ${el.loc.start.line}`);
          variants = product(variants, evaluate(el, path), (arr, v) => [...(arr as Value[]), v]);
        }
        return variants;
      }
      case 'ObjectExpression': {
        let variants: Variant[] = one({});
        for (const prop of node.properties) {
          if (prop.type === 'SpreadElement') {
            const spread = evaluate(prop.argument, path);
            variants = product(variants, spread, (obj, v) => {
              if (v === undefined || v === null) return obj;
              if (typeof v !== 'object' || Array.isArray(v)) throw new Skip(prop, `a spread of a non-object at line ${prop.loc.start.line}`);
              return { ...(obj as Record<string, Value>), ...(v as Record<string, Value>) };
            });
            continue;
          }
          if (prop.computed || prop.kind !== 'init' || prop.method) throw new Skip(prop, `a computed or method property at line ${prop.loc.start.line}`);
          const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.type === 'Literal' ? String(prop.key.value) : undefined;
          if (key === undefined) throw new Skip(prop, describe(prop));
          const childPath = path ? `${path}.${key}` : key;
          const values = evaluate(prop.value, childPath).map((v) => {
            const locations = new Map(v.locations);
            if (!locations.has(childPath)) locations.set(childPath, prop.key.loc);
            return { ...v, locations };
          });
          variants = product(variants, values, (obj, v) => ({ ...(obj as Record<string, Value>), [key]: v }));
        }
        return variants;
      }
      default:
        throw new Skip(node, `${describe(node)} needs code to run`);
    }
  };

  const product = (a: Variant[], b: Variant[], merge: (acc: Value, v: Value) => Value): Variant[] => {
    const result: Variant[] = [];
    for (const x of a) {
      for (const y of b) {
        result.push({ value: merge(x.value, y.value), locations: new Map([...x.locations, ...y.locations]), labels: [...x.labels, ...y.labels] });
      }
    }
    if (result.length > MAX_VARIANTS * 4) throw new Skip(ast, `more than ${MAX_VARIANTS} variants`);
    return result;
  };

  // ConfigProvider elements with a theme prop, with their ConfigProvider ancestors for nesting.
  interface Provider {
    node: TSESTree.JSXElement;
    expr: TSESTree.Expression;
    parent?: Provider;
  }
  const providers: Provider[] = [];
  const isProvider = (name: TSESTree.JSXTagNameExpression) =>
    (name.type === 'JSXIdentifier' && configProviders.has(name.name)) ||
    (name.type === 'JSXMemberExpression' && name.object.type === 'JSXIdentifier' && antdNamespaces.has(name.object.name) && name.property.name === 'ConfigProvider');
  const byNode = new Map<Node, Provider>();
  visit(ast, (node, parents) => {
    if (node.type !== 'JSXElement' || !isProvider(node.openingElement.name)) return;
    const attr = node.openingElement.attributes.find(
      (a): a is TSESTree.JSXAttribute => a.type === 'JSXAttribute' && a.name.type === 'JSXIdentifier' && a.name.name === 'theme',
    );
    if (!attr) return;
    if (attr.value?.type !== 'JSXExpressionContainer' || attr.value.expression.type === 'JSXEmptyExpression') {
      out.skipped.push({ file, line: attr.loc.start.line, reason: 'the theme prop is not an expression' });
      return;
    }
    const parentNode = [...parents].reverse().find((p) => byNode.has(p));
    const provider: Provider = { node, expr: attr.value.expression, parent: parentNode ? byNode.get(parentNode) : undefined };
    byNode.set(node, provider);
    providers.push(provider);
  });

  const usedConsts = new Set<string>();
  const variantsOf = (provider: Provider): Variant[] => {
    const own = evaluate(provider.expr, '');
    if (!provider.parent) return own;
    const parents = variantsOf(provider.parent);
    return product(parents, own, (parent, child) => mergeThemes((parent ?? {}) as Record<string, Value>, (child ?? {}) as Record<string, Value>));
  };

  const record = (line: number, node: Node, variants: () => Variant[]) => {
    let list: Variant[];
    try {
      list = variants();
    } catch (error) {
      if (error instanceof Skip) {
        out.skipped.push({ file, line, reason: error.message });
        return;
      }
      throw error;
    }
    const kept = list.slice(0, MAX_VARIANTS);
    if (list.length > kept.length) out.skipped.push({ file, line, reason: `${list.length - kept.length} more variants beyond the first ${MAX_VARIANTS} were not audited` });
    const seen = new Set<string>();
    const names = new Set<string>();
    for (const variant of kept) {
      try {
        const input = toThemeInput(variant.value, node);
        const key = JSON.stringify(input);
        if (seen.has(key)) continue;
        seen.add(key);
        let label = variantLabel(input, kept.length > 1);
        // Branches that differ in tokens but not algorithm: number them in source order.
        for (let n = 2; names.has(label); n += 1) label = `${variantLabel(input, true)} #${n}`;
        names.add(label);
        const locations = new Map<string, SourceLocation>();
        for (const [k, loc] of variant.locations) locations.set(k, { file, line: loc.start.line, column: loc.start.column + 1 });
        out.themes.push({ name: `${file}:${line}${label ? ` (${label})` : ''}`, file, line, input, locations });
      } catch (error) {
        if (!(error instanceof Skip)) throw error;
        out.skipped.push({ file, line, reason: error.message });
      }
    }
  };

  // Every provider is audited, merged with its ancestors: an outer one can render content of its own.
  for (const provider of providers) {
    if (provider.expr.type === 'Identifier') usedConsts.add(provider.expr.name);
    record(provider.node.loc.start.line, provider.expr, () => variantsOf(provider));
  }

  // `const x: ThemeConfig = {…}`, `{…} satisfies ThemeConfig`, `{…} as ThemeConfig` not already audited through a provider.
  const isThemeConfigType = (t: TSESTree.TypeNode | undefined): boolean =>
    !!t && t.type === 'TSTypeReference' && (
      (t.typeName.type === 'Identifier' && themeConfigTypes.has(t.typeName.name)) ||
      (t.typeName.type === 'TSQualifiedName' && t.typeName.right.name === 'ThemeConfig' && t.typeName.left.type === 'Identifier' && antdNamespaces.has(t.typeName.left.name))
    );
  visit(ast, (node) => {
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init) {
      const typed = isThemeConfigType(node.id.typeAnnotation?.typeAnnotation) ||
        ((node.init.type === 'TSSatisfiesExpression' || node.init.type === 'TSAsExpression') && isThemeConfigType(node.init.typeAnnotation));
      if (typed && !usedConsts.has(node.id.name)) record(node.loc.start.line, node.init, () => evaluate(node.init!, ''));
    } else if (node.type === 'ExportDefaultDeclaration' && (node.declaration.type === 'TSSatisfiesExpression' || node.declaration.type === 'TSAsExpression') && isThemeConfigType(node.declaration.typeAnnotation)) {
      record(node.loc.start.line, node.declaration, () => evaluate(node.declaration as Node, ''));
    }
  });
  return out;
}

/** Nested ConfigProvider: the child's theme over its parent's, unless the child sets inherit: false. */
function mergeThemes(parent: Record<string, Value>, child: Record<string, Value>): Record<string, Value> {
  if (child.inherit === false) return child;
  const parentComponents = (parent.components ?? {}) as Record<string, Record<string, Value>>;
  const childComponents = (child.components ?? {}) as Record<string, Record<string, Value>>;
  const components: Record<string, Record<string, Value>> = { ...parentComponents };
  for (const [name, tokens] of Object.entries(childComponents)) components[name] = { ...components[name], ...tokens };
  return {
    ...parent,
    ...child,
    token: { ...(parent.token as object), ...(child.token as object) },
    components,
  };
}

function algorithmList(value: Value, node: Node): AlgorithmName[] | undefined {
  if (value === undefined) return undefined;
  const list = Array.isArray(value) ? value : [value];
  return list.map((v) => {
    if (!isAlgo(v)) throw new Skip(node, 'algorithm is not one of antd\'s (defaultAlgorithm, darkAlgorithm, compactAlgorithm)');
    return v.algorithm;
  });
}

function toThemeInput(value: Value, node: Node): ThemeInput {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value) || isAlgo(value)) throw new Skip(node, 'the theme is not an object');
  const input: ThemeInput = {};
  const algos = algorithmList(value.algorithm, node);
  if (algos?.length) input.algorithm = algos.length === 1 ? algos[0] : algos;
  if (value.token !== undefined) {
    if (!value.token || typeof value.token !== 'object' || Array.isArray(value.token)) throw new Skip(node, 'theme.token is not an object');
    input.token = value.token as Record<string, unknown>;
  }
  if (value.components !== undefined) {
    if (!value.components || typeof value.components !== 'object' || Array.isArray(value.components)) throw new Skip(node, 'theme.components is not an object');
    input.components = {};
    for (const [name, tokens] of Object.entries(value.components as Record<string, Value>)) {
      if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) throw new Skip(node, `theme.components.${name} is not an object`);
      const { algorithm, ...rest } = tokens as Record<string, Value>;
      const entry: Record<string, unknown> & { algorithm?: boolean | AlgorithmName | AlgorithmName[] } = { ...rest };
      if (algorithm === true || algorithm === false) entry.algorithm = algorithm;
      else if (algorithm !== undefined) {
        const list = algorithmList(algorithm, node)!;
        entry.algorithm = list.length === 1 ? list[0] : list;
      }
      input.components[name] = entry;
    }
  }
  if (value.inherit === false) input.inherit = false;
  return input;
}

/** "dark", "dark, compact", or "light" for the non-dark branch of a conditional theme. */
function variantLabel(input: ThemeInput, multiple: boolean): string {
  const algos = input.algorithm === undefined ? [] : [input.algorithm].flat();
  const names = algos.filter((a) => a !== 'defaultAlgorithm').map((a) => a.replace('Algorithm', ''));
  if (names.length) return names.join(', ');
  return multiple ? 'light' : '';
}
