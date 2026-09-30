// Stands in for @typescript-eslint/typescript-estree in the runtime reporter's bundle. Only baseline
// fingerprints of static findings parse source, and the runtime reporter has none, so this keeps the
// TypeScript compiler (about 4 MB) out of dist/runtime-report.mjs.
export function parse() {
  throw new Error('Source parsing is not available in the runtime reporter.');
}
