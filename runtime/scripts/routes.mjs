// Builds the list of routes to crawl: the `routes` input plus, in Next mode,
// static App Router pages discovered from app/**/page.*.
import fs from "node:fs";
import fg from "fast-glob";
import { isMain, lines } from "./lib.mjs";

/** Static App Router routes; skips dynamic, catch-all, parallel, intercepting and private segments. */
export async function discoverNextRoutes(cwd) {
  const pages = await fg(["app/**/page.{js,jsx,ts,tsx,mdx}", "src/app/**/page.{js,jsx,ts,tsx,mdx}"], { cwd });
  return pages
    .map((file) => file.replace(/^(src\/)?app/, "").replace(/\/?page\.\w+$/, ""))
    .filter((route) => !/[[@]|\(\.|(^|\/)_/.test(route))
    .map((route) => "/" + route.split("/").filter((s) => s && !/^\(.*\)$/.test(s)).join("/"));
}

export async function buildRoutes({ cwd, mode, extra, exclude, discover, max }) {
  const found = mode === "next" && discover ? await discoverNextRoutes(cwd) : [];
  let routes = [...new Set([...extra, ...found])];
  if (routes.length === 0) routes = ["/"];
  const patterns = exclude.map((s) => new RegExp(s));
  return routes
    .map((r) => (r.startsWith("/") ? r : `/${r}`))
    .filter((r) => !patterns.some((re) => re.test(r)))
    .sort()
    .slice(0, max);
}

async function main() {
  const max = Number(process.env.IN_MAX_ROUTES || 50);
  const routes = await buildRoutes({
    cwd: process.env.A11Y_CWD,
    mode: process.env.A11Y_MODE,
    extra: lines(process.env.IN_ROUTES),
    exclude: lines(process.env.IN_EXCLUDE_ROUTES),
    discover: process.env.IN_DISCOVER !== "false",
    max: Number.isInteger(max) && max > 0 ? max : 50,
  });
  fs.writeFileSync(process.env.A11Y_ROUTES_FILE, JSON.stringify(routes, null, 2));
  console.log(`a11y runtime: ${routes.length} route(s)\n${routes.map((r) => `  ${r}`).join("\n")}`);
}

if (isMain(import.meta.url)) await main();
