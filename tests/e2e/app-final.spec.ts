import { test, expect } from '@playwright/test';

test.describe('QuickCorrect App Tests', () => {
  test('should load without errors', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#root', { timeout: 30000 });
    
    // Check no console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('React does not recognize')) {
        errors.push(msg.text());
      }
    });
    
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });

  test('should have settings panel', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#root', { timeout: 30000 });
    
    // Open settings
    await page.click('[aria-label="Settings"]');
    
    // Settings panel should be visible
    const settingsPanel = await page.waitForSelector('[data-testid="settings-panel"]', { 
      state: 'visible',
      timeout: 5000 
    });
    expect(settingsPanel).toBeTruthy();
  });

  test('should have functional theme selector', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#root', { timeout: 30000 });
    
    // Open settings
    await page.click('[aria-label="Settings"]');
    await page.waitForSelector('[data-testid="settings-panel"]');
    
    // Theme selector should exist
    const themeSelector = await page.$('[data-testid="theme-selector"]');
    expect(themeSelector).toBeTruthy();
    
    // Test changing theme values
    const themes = ['light', 'dark', 'system'];
    for (const theme of themes) {
      await page.selectOption('[data-testid="theme-selector"]', theme);
      await page.waitForTimeout(200);
      
      const currentValue = await page.$eval('[data-testid="theme-selector"]', 
        (el: HTMLSelectElement) => el.value
      );
      expect(currentValue).toBe(theme);
    }
  });

  test('should have text input area', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#root', { timeout: 30000 });
    
    // Find textarea
    const textArea = await page.$('textarea');
    expect(textArea).toBeTruthy();
    
    // Type some text
    await page.fill('textarea', 'テスト文章です。');
    
    // Verify text was entered
    const value = await page.$eval('textarea', (el: HTMLTextAreaElement) => el.value);
    expect(value).toBe('テスト文章です。');
  });

  test('should display app correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#root', { timeout: 30000 });
    
    // Take screenshot for visual verification
    await page.screenshot({ path: 'test-results/app-display.png' });
    
    // Check main container exists
    const mainContainer = await page.$('#root > div');
    expect(mainContainer).toBeTruthy();
    
    // Check it has background color (theme is applied)
    const bgColor = await page.evaluate(() => {
      const app = document.querySelector('#root > div');
      return app ? window.getComputedStyle(app).backgroundColor : null;
    });
    expect(bgColor).toBeTruthy();
    expect(bgColor).not.toBe('rgba(0, 0, 0, 0)'); // Should not be transparent
  });
});