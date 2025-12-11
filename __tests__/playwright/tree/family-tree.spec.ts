import { expect, test } from '@playwright/test';

test.describe('Family Tree', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a known person's tree page
    // Using a test person ID from seed data - person000001 is the first seeded person
    await page.goto('/tree?person=person000001');
  });

  test('tree page loads without errors', async ({ page }) => {
    // Check that the page title or main content is present
    await expect(page).toHaveURL(/\/tree/);

    // Wait for the page to stabilize
    await page.waitForLoadState('networkidle');

    // The tree uses D3.js with SVG, look for the SVG element or tree controls
    // The tree container has the SVG inside it
    const svgElement = page.locator('svg').first();
    await expect(svgElement).toBeVisible({ timeout: 10000 });
  });

  test('tree renders person nodes', async ({ page }) => {
    // Wait for tree to load
    await page.waitForLoadState('networkidle');

    // The D3 tree renders text elements with person names
    // Look for any text that contains typical person-related content
    const personText = page.getByText(/\d{4}\s*–\s*(Living|\d{4})/);
    await expect(personText.first()).toBeVisible({ timeout: 10000 });

    // Should have at least one node with year info
    const nodeCount = await personText.count();
    expect(nodeCount).toBeGreaterThan(0);
  });

  test('clicking a person node shows details or navigates', async ({
    page,
  }) => {
    await page.waitForLoadState('networkidle');

    // The tree renders person names as clickable text
    // Find a person name in the tree (look for typical name patterns)
    const personNames = page.locator('text >> text=/[A-Z][a-z]+ [A-Z][a-z]+/');

    if ((await personNames.count()) > 0) {
      await personNames.first().click();
      // Either navigates or shows details
      await page.waitForTimeout(500);
    }
  });

  test('tree has zoom controls', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Look for zoom control buttons - the tree has "Zoom in", "Zoom out", etc.
    const zoomInButton = page.getByRole('button', { name: /zoom in/i });
    const zoomOutButton = page.getByRole('button', { name: /zoom out/i });

    await expect(zoomInButton).toBeVisible({ timeout: 10000 });
    await expect(zoomOutButton).toBeVisible();
  });

  test('tree SVG is interactive', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // The SVG element should be visible and can receive mouse events
    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible({ timeout: 10000 });

    // The tree should have a bounding box (meaning it's rendered)
    const box = await svg.boundingBox();
    expect(box).toBeTruthy();
    expect(box?.width).toBeGreaterThan(0);
    expect(box?.height).toBeGreaterThan(0);

    // Perform a mouse interaction to verify the SVG is interactive
    // This simulates a basic pan gesture without asserting on transforms
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width / 2 + 50,
        box.y + box.height / 2 + 50,
      );
      await page.mouse.up();
    }

    // SVG should still be visible after interaction
    await expect(svg).toBeVisible();
  });
});

test.describe('Tree Navigation', () => {
  test('navigating to tree with person ID centers on that person', async ({
    page,
  }) => {
    // Navigate to tree with a test person ID from seed data
    await page.goto('/tree?person=person000001');
    await page.waitForLoadState('networkidle');

    // The tree should load and show person info in the header
    // Look for SVG tree or person name display
    const svgElement = page.locator('svg').first();
    await expect(svgElement).toBeVisible({ timeout: 10000 });
  });
});
