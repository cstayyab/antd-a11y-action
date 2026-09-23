// Vendored from the next-a11y implementation guide §8 and §13, with the CI additions from
// the runtime-check guide §2b (JSX runtime patch counters, window.__A11Y_GUARD__).
import ReactDefault from "react"; // CJS module.exports (mutable), not the frozen ESM namespace
import JsxRuntime from "react/jsx-runtime";
import JsxDevRuntime from "react/jsx-dev-runtime";
import { wrap, settings, report, stats } from "./core.js";

let installed = false;

/**
 * @param {{
 *   level?: "warn" | "error",
 *   ignoreRules?: string[],
 *   ignoreSites?: RegExp[],
 *   patchCreateElement?: boolean,
 *   patchJsxRuntime?: boolean,
 *   axe?: boolean | { tags?: string[], debounceMs?: number },
 * }} opts
 */
export function installA11yGuard(opts = {}) {
  if (installed || typeof window === "undefined") return;
  installed = true;
  Object.assign(settings, {
    level: opts.level ?? settings.level,
    ignoreRules: opts.ignoreRules ?? settings.ignoreRules,
    ignoreSites: opts.ignoreSites ?? settings.ignoreSites,
  });

  // Classic JSX (React.createElement): this is what covers antd v6 and @rc-component/*.
  if (opts.patchCreateElement !== false) {
    const original = ReactDefault.createElement;
    ReactDefault.createElement = function (type, config, ...children) {
      stats.createElement++;
      return original.call(this, type, wrap(type, config), ...children);
    };

    // rc-components clone elements; a clone can replace our injected ref
    // or add alt / aria-label after the fact → re-wrap the merged props.
    const originalClone = ReactDefault.cloneElement;
    ReactDefault.cloneElement = function (element, config, ...children) {
      const out = originalClone.call(this, element, config, ...children);
      if (!config || typeof out.type !== "string") return out;
      return originalClone.call(this, out, wrap(out.type, { ...out.props }));
    };
  }

  // Automatic JSX runtime: app code compiled without a custom jsxImportSource.
  if (opts.patchJsxRuntime) {
    const { jsx, jsxs } = JsxRuntime;
    JsxRuntime.jsx = (t, p, k) => (stats.jsx++, jsx(t, wrap(t, p), k));
    JsxRuntime.jsxs = (t, p, k) => (stats.jsx++, jsxs(t, wrap(t, p), k));
    const { jsxDEV } = JsxDevRuntime;
    JsxDevRuntime.jsxDEV = (t, p, k, s, src, self) => (stats.jsx++, jsxDEV(t, wrap(t, p), k, s, src, self));
  }

  window.__A11Y_GUARD__ = stats;

  // In-page axe on the live DOM. CI turns this off and runs axe through Playwright instead.
  if (opts.axe !== false) startAxe(typeof opts.axe === "object" ? opts.axe : {});
}

function startAxe({ tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"], debounceMs = 800 }) {
  import("axe-core").then(({ default: axe }) => {
    let timer, running = false, again = false;

    const run = async () => {
      if (running) { again = true; return; }
      running = true;
      try {
        const res = await axe.run(
          { include: [document], exclude: [["nextjs-portal"]] },
          { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] }
        );
        for (const v of res.violations) {
          for (const node of v.nodes) {
            const el = document.querySelector(node.target.join(" "));
            report(`axe:${v.id}`, `${v.help} [${v.impact}] — ${node.target.join(" ")}\n    ${v.helpUrl}`, { el });
          }
        }
      } finally {
        running = false;
        if (again) { again = false; schedule(); }
      }
    };

    const schedule = () => { clearTimeout(timer); timer = setTimeout(run, debounceMs); };

    new MutationObserver(schedule).observe(document.body, {
      subtree: true, childList: true, attributes: true, characterData: true,
    });
    schedule();
  });
}
