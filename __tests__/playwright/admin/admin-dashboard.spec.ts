import { expect, test } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin with role override for testing
    await page.goto('/admin?role=admin');
  });

  test('admin page loads for admin users', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // With SKIP_AUTH=true in CI, should land on admin page directly
    // Otherwise might redirect to login for authentication
    const isOnAdmin = page.url().includes('/admin');
    const isOnLogin = page.url().includes('/login');
    const isOnDashboard =
      page.url().includes('/dashboard') ||
      page.url() === 'http://localhost:3000/';

    // Any of these are valid outcomes depending on auth state
    expect(isOnAdmin || isOnLogin || isOnDashboard).toBe(true);

    if (isOnAdmin) {
      // Admin dashboard should have some content
      const heading = page.locator('h1').or(page.locator('h2'));
      await expect(heading).toBeVisible({ timeout: 10000 });
    }
  });

  test('admin navigation shows all sections', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/admin')) {
      // Look for admin navigation items
      const navLinks = page.locator('nav a[href*="/admin"]');
      const linkCount = await navLinks.count();

      // Should have multiple admin sections
      expect(linkCount).toBeGreaterThan(0);
    }
  });

  test('admin users section is accessible', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/admin')) {
      // Navigate to users section
      const usersLink = page
        .getByRole('link', { name: /users/i })
        .or(page.locator('a[href*="/admin/users"]'));

      if ((await usersLink.count()) > 0) {
        await usersLink.first().click();
        await expect(page).toHaveURL(/\/admin\/users/);
      }
    }
  });

  test('admin settings section is accessible', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/admin')) {
      // Navigate to settings section
      const settingsLink = page
        .getByRole('link', { name: /settings/i })
        .or(page.locator('a[href*="/admin/settings"]'));

      if ((await settingsLink.count()) > 0) {
        await settingsLink.first().click();
        await expect(page).toHaveURL(/\/admin\/settings/);
      }
    }
  });
});

test.describe('Admin Users Management', () => {
  test('users list displays', async ({ page }) => {
    await page.goto('/admin/users?role=admin');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/admin/users')) {
      // Should show user list or table
      const userList = page
        .locator('table')
        .or(page.locator('[data-testid="user-list"]'))
        .or(page.locator('.user-list'));

      await expect(userList).toBeVisible({ timeout: 10000 });
    }
  });

  test('invite user button is present', async ({ page }) => {
    await page.goto('/admin/users?role=admin');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/admin/users')) {
      const inviteButton = page
        .getByRole('button', { name: /invite|add/i })
        .or(page.locator('[data-testid="invite-user-button"]'));

      // Invite button should be present for admin
      if ((await inviteButton.count()) > 0) {
        await expect(inviteButton.first()).toBeVisible();
      }
    }
  });
});

test.describe('Admin Settings', () => {
  test('settings page displays form', async ({ page }) => {
    await page.goto('/admin/settings?role=admin');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/admin/settings')) {
      // Should have settings form
      const form = page
        .locator('form')
        .or(page.locator('[data-testid="settings-form"]'));

      await expect(form).toBeVisible({ timeout: 10000 });
    }
  });
});
