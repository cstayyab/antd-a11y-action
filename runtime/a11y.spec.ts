import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { test } from "@playwright/test";
import { resolveStack } from "./resolve";

const routes: string[] = JSON.parse(fs.readFileSync(process.env.A11Y_ROUTES_FILE!, "utf8"));
const OUT = process.env.A11Y_OUT!;
const CWD = process.env.A11Y_CWD!;
const TAGS = (process.env.IN_TAGS || "wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa").split(",").map((t) => t.trim());
const slug = (r: string) => (r === "/" ? "root" : r.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, ""));

interface GuardViolation {
  rule: string;
  message: string;
  site?: string;
  stack?: string;
  createdStack?: string;
  selector?: string;
  location?: unknown;
  origin?: "app" | "library" | null;
}

for (const route of routes) {
  test(`a11y ${route}`, async ({ page }) => {
    test.setTimeout(240_000); // the first hit compiles the route

    const res = await page.goto(route, { waitUntil: "load", timeout: 200_000 });
    await page.waitForLoadState("networkidle").catch(() => {});

    if (process.env.A11Y_INTERACTIONS) {
      const mod = await import(pathToFileURL(process.env.A11Y_INTERACTIONS).href);
      await mod.default?.({ page, route });
    }
    await page.waitForTimeout(1500); // flush the guard's batched post-render checks

    const guard = await page.evaluate(() => (window as unknown as { __A11Y_GUARD__?: unknown }).__A11Y_GUARD__ ?? null);
    const runtime = await page.evaluate(
      () => (window as unknown as { __A11Y_VIOLATIONS__?: GuardViolation[] }).__A11Y_VIOLATIONS__ ?? [],
    );
    for (const v of runtime) {
      // Created directly in app code → that line. Otherwise it was rendered inside a library
      // component, and the owner stack points at the app line that used the component.
      const created = await resolveStack(v.createdStack, CWD);
      const owner = created ? null : await resolveStack(v.stack, CWD);
      v.location = created ?? owner;
      v.origin = created ? "app" : owner ? "library" : null;
      delete v.stack; // keep the artifact small
      delete v.createdStack;
    }
    // Re-renders report the same element again with a slightly different stack.
    const seen = new Set<string>();
    const unique = runtime.filter((v) => {
      const loc = v.location as { file: string; line: number } | null;
      const key = `${v.rule}|${v.origin}|${loc ? `${loc.file}:${loc.line}` : (v.selector ?? v.site ?? v.message)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const axe = await new AxeBuilder({ page }).withTags(TAGS).exclude("nextjs-portal").analyze();

    fs.writeFileSync(
      path.join(OUT, `${slug(route)}.json`),
      JSON.stringify(
        {
          route,
          status: res?.status() ?? null,
          guard,
          runtime: unique,
          axe: axe.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            helpUrl: v.helpUrl,
            targets: v.nodes.map((n) => n.target.join(" ")),
          })),
        },
        null,
        2,
      ),
    );
  });
}
