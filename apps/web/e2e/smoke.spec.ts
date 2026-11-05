import { expect, type Page, test } from '@playwright/test';

/** Fails the test on uncaught errors and on server errors from the BFF. */
function watchForErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`page error: ${error.message}`));
  page.on('response', (response) => {
    if (response.url().includes('/bff/') && response.status() >= 500) {
      errors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  return errors;
}

test('guests can browse and are sent to sign-in for private pages', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Every movie you love, in one place.' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trending this week' })).toBeVisible();

  await page.goto('/watchlist');
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fwatchlist/);
  expect(errors).toEqual([]);
});

test('the demo family flow works end to end', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.goto('/sign-in');
  await page.getByRole('button', { name: /Create a demo family/ }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Demo Family' })).toBeVisible();

  // The movie night from the demo is in the voting phase.
  await page.getByRole('tab', { name: /Movie nights/ }).click();
  await page
    .getByRole('link', { name: /Friday Movie Night/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: /Vote \(\d of 3 voted\)/ })).toBeVisible();

  // Change a movie's status from its page and back.
  await page.goto('/discover');
  await page.locator('main a[href^="/movies/"]').first().click();
  const watching = page.getByRole('button', { name: 'Watching', exact: true });
  const before = await watching.getAttribute('aria-pressed');
  await watching.click();
  await expect(watching).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');
  await watching.click();
  await expect(watching).toHaveAttribute('aria-pressed', before ?? 'false');

  for (const [path, heading] of [
    ['/my-movies', 'My movies'],
    ['/stats', 'Stats'],
    ['/calendar', 'Calendar'],
    ['/collections', 'Collections'],
    ['/settings', 'Settings'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }

  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' }).first()).toBeVisible();
  expect(errors).toEqual([]);
});
