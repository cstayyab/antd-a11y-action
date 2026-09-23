// Vendored from the next-a11y implementation guide §6, with the CI additions from the
// runtime-check guide §2a (interception stats, raw stack in reports), plus one change:
// each report carries both the creation call stack and React's owner stack. The owner
// stack names the JSX that created the *owning component* (right for elements rendered
// inside antd), but never the line of a host element written directly in app code; the
// creation stack covers that case.
import * as React from "react";
import { computeAccessibleName } from "dom-accessibility-api";

const DEV = process.env.NODE_ENV !== "production";
const BROWSER = typeof window !== "undefined";
export const ACTIVE = DEV && BROWSER;

export const settings = {
  level: "warn", // "warn" | "error"  ("error" shows in Next's dev overlay)
  ignoreRules: [], // e.g. ["click-events-have-key-events"]
  ignoreSites: [], // RegExp[] matched against the blamed callsite
};

// How many elements the guard saw; CI uses this to tell "no issues" from "not running".
export const stats = { createElement: 0, jsx: 0, wraps: 0 };

// ---------- rule data ----------
const INTERACTIVE_ROLES = new Set([
  "button", "link", "checkbox", "radio", "switch", "tab", "menuitem",
  "menuitemcheckbox", "menuitemradio", "option", "slider", "spinbutton",
  "textbox", "combobox", "searchbox", "treeitem", "gridcell",
]);
const NON_INTERACTIVE_TAGS = new Set([
  "div", "span", "li", "p", "section", "article", "header", "footer",
  "main", "td", "tr", "ul", "ol", "img", "svg",
]);
const NATIVELY_FOCUSABLE = new Set(["button", "a", "input", "select", "textarea", "summary"]);

// ---------- reporting ----------
const seen = new Set();
const FRAMEWORK = /[\\/]next[\\/]dist[\\/]/;

function frames(stack) {
  return (stack || "").split("\n").map((l) => l.trim()).filter(Boolean);
}

function callsite(stack) {
  const f = frames(stack);
  return (
    f.find((l) => !/node_modules|next-a11y|\.a11y-guard/.test(l)) ?? // first frame in YOUR code
    f[0]
  );
}

export function report(rule, message, { el, stack, createdStack } = {}) {
  if (settings.ignoreRules.includes(rule)) return;
  const f = frames(stack);
  if (f.length && f.every((l) => FRAMEWORK.test(l))) return; // pure Next internals
  const site = callsite(stack);
  if (site && settings.ignoreSites.some((re) => re.test(site))) return;

  // Owner stacks repeat for every element a component renders, so key on both stacks.
  const key = `${rule}|${createdStack ?? ""}|${stack ?? site ?? message}`;
  if (seen.has(key)) return;
  seen.add(key);

  const log = settings.level === "error" ? console.error : console.warn;
  log(`[a11y] ${rule}: ${message}${site ? `\n    at ${site}` : ""}`, el ?? "");

  const detail = { rule, message, site, stack, createdStack, selector: el ? cssPath(el) : undefined };
  (window.__A11Y_VIOLATIONS__ ??= []).push(detail); // collected by CI
  window.dispatchEvent(new CustomEvent("a11y:violation", { detail }));
}

function cssPath(el) {
  const parts = [];
  while (el && el.nodeType === 1 && parts.length < 5) {
    let p = el.tagName.toLowerCase();
    if (el.id) { parts.unshift(`${p}#${el.id}`); break; }
    if (el.classList.length) p += "." + [...el.classList].slice(0, 2).join(".");
    parts.unshift(p);
    el = el.parentElement;
  }
  return parts.join(" > ");
}

// ---------- post-render DOM checks (batched) ----------
const pending = new Map();
let scheduled = false;

function schedule(el, meta) {
  pending.set(el, meta);
  if (!scheduled) {
    scheduled = true;
    setTimeout(flush, 0); // let labels/aria-labelledby targets mount
  }
}

function flush() {
  scheduled = false;
  for (const [el, meta] of pending) domChecks(el, meta);
  pending.clear();
}

function isHidden(el) {
  if (!el.isConnected) return true;
  if (el.getRootNode() !== document) return true; // shadow roots (Next dev overlay)
  if (el.closest("[hidden],[aria-hidden='true'],[inert]")) return true;
  if (el.tagName === "INPUT" && el.type === "hidden") return true;
  return false;
}

function domChecks(el, { tag, stack, createdStack }) {
  if (isHidden(el)) return;
  const name = computeAccessibleName(el).trim();
  if (!name) {
    const role = el.getAttribute("role");
    report("accessible-name", `<${tag}${role ? ` role="${role}"` : ""}> has no accessible name (WCAG 4.1.2)`, { el, stack, createdStack });
  }
}

// ---------- ref composition (React 19: ref is a prop) ----------
function composeRef(userRef, onMount) {
  return (el) => {
    let userCleanup;
    if (typeof userRef === "function") userCleanup = userRef(el);
    else if (userRef) userRef.current = el;
    if (el) onMount(el);
    // Returning a cleanup means React won't call us with null — emulate it.
    return () => {
      if (typeof userCleanup === "function") userCleanup();
      else if (typeof userRef === "function") userRef(null);
      else if (userRef) userRef.current = null;
    };
  };
}

function needsNameCheck(type, props) {
  if (type === "button" || type === "select" || type === "textarea" || type === "summary") return true;
  if (type === "a") return props.href != null;
  if (type === "input") return props.type !== "hidden";
  return INTERACTIVE_ROLES.has(props.role);
}

// ---------- the interceptor ----------
const WRAPPED = new WeakSet(); // prevents double-wrapping

export function wrap(type, props) {
  if (!ACTIVE || typeof type !== "string" || props == null || WRAPPED.has(props)) return props;
  stats.wraps++;

  let stack;
  let createdStack;
  const getStack = () => {
    // Drop the "Error" line; the guard's own frames are filtered out when source-mapped.
    createdStack ??= (new Error().stack ?? "").split("\n").slice(1).join("\n");
    return (stack ??= typeof React.captureOwnerStack === "function" ? React.captureOwnerStack() ?? "" : "");
  };
  const at = () => ({ stack: getStack(), createdStack });

  // --- creation-time (props-only) checks ---
  if (type === "img" && props.alt === undefined && props.role !== "presentation" && props.role !== "none") {
    report("image-alt", '<img> missing alt (WCAG 1.1.1). Use alt="" for decorative images.', at());
  }
  if (type === "iframe" && !props.title) {
    report("frame-title", "<iframe> missing title (WCAG 4.1.2)", at());
  }
  if (typeof props.tabIndex === "number" && props.tabIndex > 0) {
    report("no-positive-tabindex", `tabIndex=${props.tabIndex} breaks focus order (WCAG 2.4.3)`, at());
  }
  if (props.onClick && NON_INTERACTIVE_TAGS.has(type)) {
    if (!INTERACTIVE_ROLES.has(props.role)) {
      report("click-events-need-role", `<${type} onClick> without an interactive role — use <button> (WCAG 2.1.1, 4.1.2)`, at());
    } else {
      if (props.tabIndex == null && !NATIVELY_FOCUSABLE.has(type)) {
        report("interactive-role-focusable", `<${type} role="${props.role}"> is not focusable — add tabIndex={0} (WCAG 2.1.1)`, at());
      }
      if (!props.onKeyDown && !props.onKeyUp) {
        report("click-events-have-key-events", `<${type} role="${props.role}" onClick> has no keyboard handler (WCAG 2.1.1)`, at());
      }
    }
  }

  // --- post-render checks ---
  if (!needsNameCheck(type, props)) return props;

  const s = at(); // must be captured during render, not in the ref
  const next = { ...props, ref: composeRef(props.ref, (el) => schedule(el, { tag: type, ...s })) };
  WRAPPED.add(next);
  return next;
}
