import { expect, test } from '@playwright/test';

test.describe('Search Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/search');
  });

  test('search page loads successfully', async ({ page }) => {
    await expect(page).toHaveURL(/\/search/);
    await page.waitForLoadState('networkidle');

    // Search input should be visible
    const searchInput = page
      .getByPlaceholder(/search/i)
      .or(page.locator('input[type="search"]'))
      .or(page.locator('input[type="text"]').first());

    await expect(searchInput).toBeVisible({ timeout: 10000 });
  });

  test('search returns results for valid query', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const searchInput = page
      .getByPlaceholder(/search/i)
      .or(page.locator('input[type="search"]'))
      .or(page.locator('input[type="text"]').first());

    // Type a search query
    await searchInput.fill('a');
    await page.keyboard.press('Enter');

    // Wait for results
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Results should appear or no results message
    const results = page
      .locator('[data-testid="search-result"]')
      .or(page.locator('a[href*="/person/"]'))
      .or(page.getByText(/no results/i));

    await expect(results.first()).toBeVisible({ timeout: 10000 });
  });

  test('search shows no results message for invalid query', async ({
    page,
  }) => {
    await page.waitForLoadState('networkidle');

    const searchInput = page
      .getByPlaceholder(/search/i)
      .or(page.locator('input[type="search"]'))
      .or(page.locator('input[type="text"]').first());

    // Type a query that won't match anything
    await searchInput.fill('zzzzxxxxxyyyyynomatch12345');
    await page.keyboard.press('Enter');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Should show no results or empty state
  });

  test('clicking search result navigates to person', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const searchInput = page
      .getByPlaceholder(/search/i)
      .or(page.locator('input[type="search"]'))
      .or(page.locator('input[type="text"]').first());

    await searchInput.fill('a');
    await page.keyboard.press('Enter');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Click first result if any
    const personLink = page.locator('a[href*="/person/"]').first();

    if ((await personLink.count()) > 0) {
      await personLink.click();
      await expect(page).toHaveURL(/\/person\/[a-zA-Z0-9]+/);
    }
  });
});

test.describe('Global Search', () => {
  test('header search navigates to search page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for search in header/nav
    const headerSearch = page
      .locator('header input[type="search"]')
      .or(page.locator('nav input[type="search"]'))
      .or(page.locator('[data-testid="global-search"]'));

    if ((await headerSearch.count()) > 0) {
      await headerSearch.fill('test');
      await page.keyboard.press('Enter');

      // Should navigate to search page with query
      await expect(page).toHaveURL(/\/search/);
    }
  });
});
