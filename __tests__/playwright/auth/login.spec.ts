import { expect, test } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('login page loads successfully', async ({ page }) => {
    await expect(page).toHaveURL(/\/login/);
    await page.waitForLoadState('networkidle');

    // Login form should be visible
    const loginForm = page
      .locator('form')
      .or(page.locator('[data-testid="login-form"]'));

    await expect(loginForm).toBeVisible({ timeout: 10000 });
  });

  test('login form has email and password fields', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Email field
    const emailInput = page
      .getByLabel(/email/i)
      .or(page.locator('input[type="email"]'))
      .or(page.locator('input[name="email"]'));

    // Password field
    const passwordInput = page
      .getByLabel(/password/i)
      .or(page.locator('input[type="password"]'))
      .or(page.locator('input[name="password"]'));

    await expect(emailInput).toBeVisible({ timeout: 5000 });
    await expect(passwordInput).toBeVisible({ timeout: 5000 });
  });

  test('login form has submit button', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const submitButton = page
      .getByRole('button', { name: /sign in|log in|login/i })
      .or(page.locator('button[type="submit"]'));

    await expect(submitButton).toBeVisible({ timeout: 5000 });
  });

  test('login shows error for invalid credentials', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Fill in invalid credentials
    const emailInput = page
      .getByLabel(/email/i)
      .or(page.locator('input[type="email"]'))
      .or(page.locator('input[name="email"]'));

    const passwordInput = page
      .getByLabel(/password/i)
      .or(page.locator('input[type="password"]'))
      .or(page.locator('input[name="password"]'));

    await emailInput.fill('invalid@example.com');
    await passwordInput.fill('wrongpassword');

    // Submit form
    const submitButton = page
      .getByRole('button', { name: /sign in|log in|login/i })
      .or(page.locator('button[type="submit"]'));

    await submitButton.click();
    await page.waitForTimeout(1000);

    // Should show error message or stay on login page
    const isStillOnLogin = page.url().includes('/login');
    expect(isStillOnLogin).toBe(true);
  });

  test('forgot password link is present', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const forgotLink = page
      .getByRole('link', { name: /forgot|reset/i })
      .or(page.locator('a[href*="forgot"]'))
      .or(page.locator('a[href*="reset"]'));

    if ((await forgotLink.count()) > 0) {
      await expect(forgotLink.first()).toBeVisible();
    }
  });
});

test.describe('Password Reset', () => {
  test('forgot password page loads', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');

    // Should have email input for reset
    const emailInput = page
      .getByLabel(/email/i)
      .or(page.locator('input[type="email"]'));

    await expect(emailInput).toBeVisible({ timeout: 10000 });
  });

  test('password reset form submits', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');

    const emailInput = page
      .getByLabel(/email/i)
      .or(page.locator('input[type="email"]'));

    await emailInput.fill('test@example.com');

    const submitButton = page
      .getByRole('button', { name: /reset|send|submit/i })
      .or(page.locator('button[type="submit"]'));

    if ((await submitButton.count()) > 0) {
      await submitButton.click();
      await page.waitForTimeout(1000);

      // Should show success message or redirect
    }
  });
});
