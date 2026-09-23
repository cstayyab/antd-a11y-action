// Decides between Next mode (inject the guard, run `next dev`) and generic mode
// (start the app with start-command, axe only) and exports the settings as env vars.
import fs from "node:fs";
import path from "node:path";
import { atLeast, exportEnv, installedVersion, isMain } from "./lib.mjs";

export function resolveConfig(env, cwdExists = fs.existsSync) {
  const workspace = env.GITHUB_WORKSPACE ?? process.cwd();
  const wd = env.IN_WD || ".";
  if (path.isAbsolute(wd) || path.normalize(wd).startsWith("..")) {
    throw new Error("working-directory must be a relative path inside the repository.");
  }
  const cwd = path.resolve(workspace, wd);
  if (!cwdExists(cwd)) throw new Error(`working-directory ${wd} does not exist.`);

  const framework = (env.IN_FRAMEWORK || "auto").toLowerCase();
  if (!["auto", "next", "generic"].includes(framework)) {
    throw new Error(`framework must be auto, next or generic, got "${framework}".`);
  }
  const warnings = [];
  const nextVersion = installedVersion(cwd, "next");
  const reactVersion = installedVersion(cwd, "react");

  let mode = framework;
  if (framework === "auto") mode = nextVersion && !env.IN_START_COMMAND ? "next" : "generic";
  if (mode === "next") {
    if (!nextVersion) throw new Error("framework is next, but next is not installed. Run npm ci before this action.");
    if (!atLeast(nextVersion, [15, 3])) {
      warnings.push(`next ${nextVersion} has no instrumentation-client (needs 15.3+); running axe only.`);
      mode = "generic";
    } else if (atLeast(nextVersion, [17, 0])) {
      warnings.push(`next ${nextVersion} is untested; the guard was verified on Next 15.5 and 16.3.`);
    }
  }
  if (mode === "next" && reactVersion && !atLeast(reactVersion, [19, 1])) {
    warnings.push(`react ${reactVersion} has no captureOwnerStack (needs 19.1+); runtime findings will not point at source lines.`);
  }

  const port = Number(env.IN_PORT || 3100);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`port must be a TCP port, got "${env.IN_PORT}".`);

  let devCommand;
  let baseUrl;
  if (mode === "next") {
    devCommand = env.IN_START_COMMAND || `npx next dev --turbopack -p ${port}`;
    baseUrl = `http://localhost:${port}`;
  } else {
    if (!env.IN_START_COMMAND && !env.IN_TARGET_URL) {
      throw new Error("Generic mode needs start-command (to start the app) or target-url (an app that is already running).");
    }
    devCommand = env.IN_START_COMMAND || "";
    baseUrl = env.IN_TARGET_URL || "http://localhost:3000";
  }

  const out = path.join(env.RUNNER_TEMP ?? path.join(cwd, ".a11y-guard"), "a11y-runtime");
  const rel = (p) => (p ? path.resolve(cwd, p) : "");
  return {
    warnings,
    vars: {
      A11Y_MODE: mode,
      A11Y_CWD: cwd,
      A11Y_OUT: path.join(out, "results"),
      A11Y_ROUTES_FILE: path.join(out, "routes.json"),
      A11Y_DEV_CMD: devCommand,
      A11Y_BASE_URL: baseUrl,
      A11Y_STORAGE_STATE: rel(env.IN_STORAGE),
      A11Y_INTERACTIONS: rel(env.IN_INTERACTIONS),
      A11Y_SETUP: rel(env.IN_SETUP),
      // Outside results/: the saved session holds cookies and must never land in the artifact.
      A11Y_AUTH_STATE: env.IN_SETUP ? path.join(out, "auth-state.json") : "",
      A11Y_SETUP_STATUS: env.IN_SETUP ? path.join(out, "setup-status.json") : "",
      A11Y_NEXT_VERSION: nextVersion ?? "",
      A11Y_REACT_VERSION: reactVersion ?? "",
    },
  };
}

function main() {
  const { vars, warnings } = resolveConfig(process.env);
  for (const w of warnings) console.log(`::warning::a11y runtime: ${w}`);
  // Start clean so a second run in the same job doesn't report the first run's pages.
  fs.rmSync(vars.A11Y_OUT, { recursive: true, force: true });
  for (const file of [vars.A11Y_AUTH_STATE, vars.A11Y_SETUP_STATUS]) if (file) fs.rmSync(file, { force: true });
  if (vars.A11Y_SETUP && !fs.existsSync(vars.A11Y_SETUP)) throw new Error(`setup module ${vars.A11Y_SETUP} does not exist.`);
  fs.mkdirSync(vars.A11Y_OUT, { recursive: true });
  exportEnv(vars);
  console.log(`a11y runtime: ${vars.A11Y_MODE} mode in ${vars.A11Y_CWD} (${vars.A11Y_BASE_URL})`);
}

if (isMain(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.log(`::error::a11y runtime: ${error.message}`);
    process.exit(1);
  }
}
