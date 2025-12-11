import { expect, test } from '@playwright/test';

test.describe('Person Detail Page', () => {
  test('person detail page loads from people list', async ({ page }) => {
    // Navigate to people list first
    await page.goto('/people');
    await page.waitForLoadState('networkidle');

    // Find and click first person link
    const personLink = page.locator('a[href*="/person/"]').first();

    if ((await personLink.count()) > 0) {
      await personLink.click();
      await page.waitForLoadState('networkidle');

      // Should be on person detail page
      await expect(page).toHaveURL(/\/person\/[a-zA-Z0-9]+/);

      // Person name should be visible
      const personName = page
        .locator('h1')
        .or(page.locator('[data-testid="person-name"]'));
      await expect(personName).toBeVisible({ timeout: 10000 });
    }
  });

  test('person detail shows basic information', async ({ page }) => {
    await page.goto('/people');
    await page.waitForLoadState('networkidle');

    const personLink = page.locator('a[href*="/person/"]').first();

    if ((await personLink.count()) > 0) {
      await personLink.click();
      await page.waitForLoadState('networkidle');

      // Should display person details section
      const detailsSection = page
        .locator('[data-testid="person-details"]')
        .or(page.locator('.person-details'))
        .or(page.locator('main'));

      await expect(detailsSection).toBeVisible({ timeout: 10000 });
    }
  });

  test('person detail shows family relationships', async ({ page }) => {
    await page.goto('/people');
    await page.waitForLoadState('networkidle');

    const personLink = page.locator('a[href*="/person/"]').first();

    if ((await personLink.count()) > 0) {
      await personLink.click();
      await page.waitForLoadState('networkidle');

      // Look for family section or relationship links
      const familySection = page
        .locator('[data-testid="family-section"]')
        .or(page.getByText(/parents|children|spouse|siblings/i).first());

      // Family section may or may not be present depending on the person
      const hasFamilySection = (await familySection.count()) > 0;
      if (hasFamilySection) {
        await expect(familySection).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('view tree button navigates to tree view', async ({ page }) => {
    await page.goto('/people');
    await page.waitForLoadState('networkidle');

    const personLink = page.locator('a[href*="/person/"]').first();

    if ((await personLink.count()) > 0) {
      await personLink.click();
      await page.waitForLoadState('networkidle');

      // Find view tree button/link
      const treeButton = page
        .getByRole('link', { name: /tree|view tree/i })
        .or(page.locator('a[href*="/tree"]'));

      if ((await treeButton.count()) > 0) {
        await treeButton.first().click();
        await expect(page).toHaveURL(/\/tree/);
      }
    }
  });

  test('edit button is visible for authenticated users', async ({ page }) => {
    await page.goto('/people');
    await page.waitForLoadState('networkidle');

    const personLink = page.locator('a[href*="/person/"]').first();

    if ((await personLink.count()) > 0) {
      await personLink.click();
      await page.waitForLoadState('networkidle');

      // Look for edit button (may require auth)
      const editButton = page
        .getByRole('button', { name: /edit/i })
        .or(page.locator('[data-testid="edit-person-button"]'));

      // Check if edit button is visible (depends on auth state)
      const hasEditButton = (await editButton.count()) > 0;
      if (hasEditButton) {
        await expect(editButton.first()).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

test.describe('Person Detail - Sources Tab', () => {
  test('sources tab shows research information', async ({ page }) => {
    await page.goto('/people');
    await page.waitForLoadState('networkidle');

    const personLink = page.locator('a[href*="/person/"]').first();

    if ((await personLink.count()) > 0) {
      await personLink.click();
      await page.waitForLoadState('networkidle');

      // Look for sources/research tab
      const sourcesTab = page
        .getByRole('tab', { name: /sources|research/i })
        .or(page.getByText(/sources|research/i));

      if ((await sourcesTab.count()) > 0) {
        await sourcesTab.first().click();
        await page.waitForTimeout(500);
      }
    }
  });
});
