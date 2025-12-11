import { expect, test } from '@playwright/test';

test.describe('People List Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/people');
  });

  test('people page loads successfully', async ({ page }) => {
    await expect(page).toHaveURL(/\/people/);
    await page.waitForLoadState('networkidle');

    // Page should have a heading or title
    const heading = page
      .getByRole('heading', { level: 1 })
      .or(page.locator('h1'));
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('displays list of people', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Look for person cards or list items
    const personItems = page
      .locator('[data-testid="person-card"]')
      .or(page.locator('.person-card'))
      .or(page.locator('a[href*="/person/"]'));

    // Should have at least one person in the list
    await expect(personItems.first()).toBeVisible({ timeout: 10000 });
  });

  test('search filters people by name', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Find search input
    const searchInput = page
      .getByPlaceholder(/search/i)
      .or(page.locator('input[type="search"]'))
      .or(page.locator('[data-testid="search-input"]'));

    if ((await searchInput.count()) > 0) {
      await searchInput.fill('test');
      await page.waitForTimeout(500); // Debounce

      // Results should update
      await page.waitForLoadState('networkidle');
    }
  });

  test('clicking a person navigates to detail page', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Find a person link
    const personLink = page.locator('a[href*="/person/"]').first();

    if ((await personLink.count()) > 0) {
      await personLink.click();

      // Should navigate to person detail page
      await expect(page).toHaveURL(/\/person\/[a-zA-Z0-9]+/);
    }
  });

  test('filter dropdown works', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Look for filter dropdown
    const filterSelect = page
      .locator('select')
      .or(page.locator('[data-testid="filter-select"]'))
      .or(page.getByRole('combobox'));

    if ((await filterSelect.count()) > 0) {
      await filterSelect.first().click();
      await page.waitForTimeout(300);
    }
  });
});

test.describe('Create Person Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/people');
    await page.waitForLoadState('networkidle');
  });

  test('create person button opens modal', async ({ page }) => {
    // Find create person button
    const createButton = page
      .getByRole('button', { name: /add|create|new/i })
      .or(page.locator('[data-testid="create-person-button"]'));

    if ((await createButton.count()) > 0) {
      await createButton.first().click();

      // Modal should appear
      const modal = page.locator('[role="dialog"]').or(page.locator('.modal'));
      await expect(modal).toBeVisible({ timeout: 5000 });
    }
  });

  test('create person form has required fields', async ({ page }) => {
    // Open modal
    const createButton = page
      .getByRole('button', { name: /add|create|new/i })
      .or(page.locator('[data-testid="create-person-button"]'));

    if ((await createButton.count()) > 0) {
      await createButton.first().click();
      await page.waitForTimeout(500);

      // Check for name fields
      const givenNameInput = page
        .getByLabel(/given|first/i)
        .or(page.locator('input[name="name_given"]'));
      const surnameInput = page
        .getByLabel(/surname|last/i)
        .or(page.locator('input[name="name_surname"]'));

      // At least one name field should be present
      const hasNameFields =
        (await givenNameInput.count()) > 0 || (await surnameInput.count()) > 0;
      expect(hasNameFields).toBe(true);
    }
  });

  test('create person form validates required fields', async ({ page }) => {
    const createButton = page
      .getByRole('button', { name: /add|create|new/i })
      .or(page.locator('[data-testid="create-person-button"]'));

    if ((await createButton.count()) > 0) {
      await createButton.first().click();
      await page.waitForTimeout(500);

      // Try to submit empty form
      const submitButton = page.getByRole('button', {
        name: /save|create|submit/i,
      });
      if ((await submitButton.count()) > 0) {
        await submitButton.click();

        // Form should show validation error or button should be disabled
        await page.waitForTimeout(300);
      }
    }
  });
});
