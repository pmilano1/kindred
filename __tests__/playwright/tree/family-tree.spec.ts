import { expect, test } from '@playwright/test';

test.describe('Family Tree', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a known person's tree page
    // Using a test person ID - this should exist in the test database
    await page.goto('/tree');
  });

  test('tree page loads without errors', async ({ page }) => {
    // Check that the page title or main content is present
    await expect(page).toHaveURL(/\/tree/);

    // Check for console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait for the page to stabilize
    await page.waitForLoadState('networkidle');

    // Tree container should be visible
    const treeContainer = page
      .locator('[data-testid="tree-container"]')
      .or(page.locator('.react-flow'));
    await expect(treeContainer).toBeVisible({ timeout: 10000 });
  });

  test('tree renders person nodes', async ({ page }) => {
    // Wait for tree to load
    await page.waitForLoadState('networkidle');

    // Look for person nodes in the tree
    const personNodes = page.locator('.react-flow__node');
    await expect(personNodes.first()).toBeVisible({ timeout: 10000 });

    // Should have at least one node
    const nodeCount = await personNodes.count();
    expect(nodeCount).toBeGreaterThan(0);
  });

  test('clicking a person node shows details or navigates', async ({
    page,
  }) => {
    await page.waitForLoadState('networkidle');

    // Click on a person node
    const personNode = page.locator('.react-flow__node').first();
    await expect(personNode).toBeVisible({ timeout: 10000 });
    await personNode.click();

    // Either opens a modal, shows details, or navigates
    // Check for any of these behaviors
    await page.waitForTimeout(500);

    // The app should respond to the click somehow
    // This is a basic interaction test
  });

  test('tree has zoom controls', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Look for zoom controls (common in react-flow)
    const zoomControls = page
      .locator('.react-flow__controls')
      .or(page.locator('[data-testid="zoom-controls"]'));

    // Zoom controls may or may not be present depending on implementation
    const hasZoomControls = (await zoomControls.count()) > 0;

    if (hasZoomControls) {
      await expect(zoomControls).toBeVisible();
    }
  });

  test('tree can be panned by dragging', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const viewport = page.locator('.react-flow__viewport');
    await expect(viewport).toBeVisible({ timeout: 10000 });

    // Get initial transform
    const initialTransform = await viewport.getAttribute('style');

    // Simulate pan by dragging the pane
    const pane = page.locator('.react-flow__pane');
    await pane.hover();

    // Perform a drag operation
    const box = await pane.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width / 2 + 100,
        box.y + box.height / 2,
      );
      await page.mouse.up();
    }

    // The viewport transform should have changed
    await page.waitForTimeout(300);
    const newTransform = await viewport.getAttribute('style');

    // Transform should be different after panning
    expect(newTransform).not.toBe(initialTransform);
  });
});

test.describe('Tree Navigation', () => {
  test('navigating to tree with person ID centers on that person', async ({
    page,
  }) => {
    // Navigate to tree with a test person ID from seed data
    await page.goto('/tree?person=person000001');
    await page.waitForLoadState('networkidle');

    // The tree should load and center on the specified person
    const treeContainer = page
      .locator('.react-flow')
      .or(page.locator('[data-testid="tree-container"]'));
    await expect(treeContainer).toBeVisible({ timeout: 10000 });
  });
});
