// Runs once before the crawl (the runtime action's `setup` input): sign in through the form.
// A real app would read credentials from secrets passed as env on the action step.
export default async function setup({ page }) {
  await page.goto('/login');
  await page.getByLabel('Username').fill(process.env.A11Y_USER ?? 'ci-user');
  await page.getByLabel('Password').fill(process.env.A11Y_PASS ?? 'ci-pass');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/account');
}
