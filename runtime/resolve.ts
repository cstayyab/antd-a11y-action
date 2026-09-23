// Maps stack frames that point at compiled dev-server chunks back to source files.
// Runs inside the spec while the dev server is still up to serve the .map files.
import path from "node:path";
import { SourceMapConsumer } from "source-map-js";

const cache = new Map<string, SourceMapConsumer | null>();
const IGNORE = /node_modules|\.a11y-guard|next[\\/]dist/;

async function consumer(url: string): Promise<SourceMapConsumer | null> {
  const base = url.split("?")[0];
  if (!cache.has(base)) {
    try {
      const res = await fetch(`${base}.map`);
      cache.set(base, res.ok ? new SourceMapConsumer(await res.json()) : null);
    } catch {
      cache.set(base, null);
    }
  }
  return cache.get(base) ?? null;
}

/** Source path from a map → repo path relative to the app directory. */
export function normalizeSource(source: string, cwd: string): string {
  let s = source
    .replace(/^.*\[project\]\//, "") // turbopack:///[project]/app/x.tsx
    .replace(/^webpack:\/\/[^/]*\/\.\//, "") // webpack://_N_E/./app/x.tsx
    .replace(/^file:\/\//, "")
    .replace(/\?.*$/, "");
  s = decodeURIComponent(s);
  if (path.isAbsolute(s)) s = path.relative(cwd, s);
  return s.split(path.sep).join("/");
}

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
}

/** The first frame that maps to the app's own code wins. */
export async function resolveStack(stack: string | undefined, cwd: string): Promise<SourceLocation | null> {
  for (const frame of (stack ?? "").split("\n")) {
    const m = frame.match(/(https?:\/\/[^\s)]+?):(\d+):(\d+)/);
    if (!m) continue;
    const c = await consumer(m[1]);
    if (!c) continue;
    const pos = c.originalPositionFor({ line: Number(m[2]), column: Number(m[3]) - 1 });
    if (!pos.source) continue;
    const file = normalizeSource(pos.source, cwd);
    if (IGNORE.test(file) || file.startsWith("../")) continue;
    return { file, line: pos.line ?? 1, column: (pos.column ?? 0) + 1 };
  }
  return null;
}
