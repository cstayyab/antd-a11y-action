// Runs the user's setup module once, after the app is up and before any route is crawled,
// and saves the browser session (cookies, localStorage) for the crawl to reuse.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { test } from "@playwright/test";

test("a11y setup", async ({ page, baseURL }) => {
  test.setTimeout(240_000); // may be the first request, which compiles the app
  const status = process.env.A11Y_SETUP_STATUS!;
  try {
    const mod = await import(pathToFileURL(process.env.A11Y_SETUP!).href);
    if (typeof mod.default !== "function") {
      throw new Error("the setup module must export a default async function ({ page, baseURL }) => {}");
    }
    await mod.default({ page, baseURL });
    await page.context().storageState({ path: process.env.A11Y_AUTH_STATE! });
    fs.writeFileSync(status, JSON.stringify({ ok: true }));
  } catch (error) {
    fs.writeFileSync(status, JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    throw error;
  }
});
