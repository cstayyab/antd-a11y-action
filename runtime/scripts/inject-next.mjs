// Copies the guard into the app and loads it from instrumentation-client (Next 15.3+).
// Working tree only: nothing is committed and the lockfile is not touched.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib.mjs";

const EXTENSIONS = ["ts", "tsx", "js", "jsx", "mjs"];
const MARK = "injected by antd A11y Guard";

/** Writes instrumentation-client.* and returns its path. Separated from main() for tests. */
export function writeInstrumentation(cwd, guardDir) {
  // Next looks for instrumentation-client in the project root, or in src/ when the app lives there.
  const useSrc = fs.existsSync(path.join(cwd, "src/app")) || fs.existsSync(path.join(cwd, "src/pages"));
  const dir = useSrc ? path.join(cwd, "src") : cwd;
  // Match the project's language; a .ts file in a JS project makes Next try to set up TypeScript.
  const ext = fs.existsSync(path.join(cwd, "tsconfig.json")) ? "ts" : "js";

  // Keep an existing instrumentation-client working by importing it first.
  let preserve = "";
  for (const e of EXTENSIONS) {
    if (fs.existsSync(path.join(dir, `instrumentation-client.a11y-original.${e}`))) {
      preserve = `import "./instrumentation-client.a11y-original";\n`; // injected before in this job
    }
    const file = path.join(dir, `instrumentation-client.${e}`);
    if (!fs.existsSync(file)) continue;
    if (fs.readFileSync(file, "utf8").includes(MARK)) {
      fs.rmSync(file); // our own earlier injection
    } else {
      fs.renameSync(file, path.join(dir, `instrumentation-client.a11y-original.${e}`));
      preserve = `import "./instrumentation-client.a11y-original";\n`;
    }
  }

  let spec = path.relative(dir, path.join(guardDir, "src/client.js")).split(path.sep).join("/");
  // ".a11y-guard/…" starts with a dot but is not relative; only "./" and "../" are.
  if (!spec.startsWith("./") && !spec.startsWith("../")) spec = `./${spec}`;

  const target = path.join(dir, `instrumentation-client.${ext}`);
  fs.writeFileSync(
    target,
    `// @ts-nocheck — ${MARK} (CI only, never commit)
${preserve}import { installA11yGuard } from "${spec}";
installA11yGuard({ level: "warn", axe: false, patchCreateElement: true, patchJsxRuntime: true });
`,
  );
  return target;
}

function main() {
  const cwd = process.env.A11Y_CWD;
  const actionPath = process.env.GITHUB_ACTION_PATH ?? path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  // Inside the project root so the bundler compiles it like app code.
  const guardDir = path.join(cwd, ".a11y-guard", "next-a11y");
  fs.cpSync(path.join(actionPath, "guard"), guardDir, { recursive: true });
  execFileSync(
    "npm",
    [
      "install", "--no-save", "--no-package-lock", "--legacy-peer-deps", "--no-audit", "--no-fund",
      "axe-core@^4.10", "dom-accessibility-api@^0.7",
    ],
    { cwd: guardDir, stdio: "inherit" },
  );
  const target = writeInstrumentation(cwd, guardDir);
  console.log(`a11y runtime: injected guard into ${path.relative(cwd, target)}`);
}

if (isMain(import.meta.url)) main();
