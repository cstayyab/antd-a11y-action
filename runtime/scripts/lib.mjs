import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** True when the module at `url` is the script node was started with. */
export function isMain(url) {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(url);
}

/** Newline-separated input → trimmed, non-empty lines. */
export function lines(value) {
  return (value ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

/** "15.5.2" → [15, 5, 2]; null when unparsable. */
export function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v ?? "");
  return m ? m.slice(1).map(Number) : null;
}

export function atLeast(version, [major, minor = 0]) {
  const v = parseVersion(version);
  if (!v) return false;
  return v[0] > major || (v[0] === major && v[1] >= minor);
}

/** Version of a package as installed for the app in `cwd` (walks up node_modules), or null. */
export function installedVersion(cwd, name) {
  let dir = path.resolve(cwd);
  for (;;) {
    const file = path.join(dir, "node_modules", name, "package.json");
    if (fs.existsSync(file)) {
      try {
        return JSON.parse(fs.readFileSync(file, "utf8")).version ?? null;
      } catch {
        return null;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Appends KEY=value lines to $GITHUB_ENV (or logs them when run locally). */
export function exportEnv(vars) {
  const body = Object.entries(vars)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    // A newline would let a value inject extra variables.
    .map(([k, v]) => `${k}=${String(v).replace(/[\r\n]+/g, " ")}`)
    .join("\n");
  if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, body + "\n");
  else console.log(body);
}
