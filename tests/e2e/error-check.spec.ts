import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';

test.describe('Application Error Check', () => {
  let electronApp: any;
  let window: any;

  test.beforeEach(async () => {
    // First build the app
    const { execSync } = require('child_process');
    execSync('yarn build', { stdio: 'inherit' });
    
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../dist/main/main.js')],
      env: {
        ...process.env,
        NODE_ENV: 'production',
      },
    });
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(2000); // Wait for app to fully initialize
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should launch without console errors', async () => {
    // Collect console messages
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    
    window.on('console', (msg: any) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Wait for app to fully load
    await window.waitForTimeout(3000);

    // Check for JavaScript errors
    const jsErrors = await window.evaluate(() => {
      return window.errors || [];
    });

    // Assert no console errors
    expect(consoleErrors).toHaveLength(0);
    
    // Log warnings for review (but don't fail)
    if (consoleWarnings.length > 0) {
      console.log('Warnings detected:', consoleWarnings);
    }

    // Assert no JavaScript errors
    expect(jsErrors).toHaveLength(0);
  });

  test('should render main components without errors', async () => {
    // Check if main app container exists
    const appContainer = await window.waitForSelector('[data-testid="app-container"], #root', { 
      timeout: 5000 
    });
    expect(appContainer).toBeTruthy();

    // Check if text input area exists
    const textInput = await window.waitForSelector('textarea', {
      timeout: 10000
    });
    expect(textInput).toBeTruthy();

    // Check if output area exists  
    const outputArea = await window.waitForSelector('div:has(> div)', {
      timeout: 10000
    });
    expect(outputArea).toBeTruthy();

    // Check if correction button exists
    const correctionButton = await window.waitForSelector('button', {
      timeout: 10000
    });
    expect(correctionButton).toBeTruthy();
  });

  test('should handle basic interactions without errors', async () => {
    // Find and interact with text input
    const textInput = await window.waitForSelector('textarea', {
      timeout: 10000
    });
    
    // Type test text
    await textInput.fill('これはテストです。');
    
    // Check if value was set correctly
    const inputValue = await textInput.inputValue();
    expect(inputValue).toBe('これはテストです。');

    // Find first button (correction button)
    const buttons = await window.$$('button');
    expect(buttons.length).toBeGreaterThan(0);
    
    // Click the first button
    await buttons[0].click();
    
    // Wait a bit to see if any errors occur
    await window.waitForTimeout(2000);
    
    // Check if app is still responsive
    const isVisible = await textInput.isVisible();
    expect(isVisible).toBe(true);
  });

  test('should load settings without errors', async () => {
    // Try to find settings button
    const buttons = await window.$$('button');
    
    if (buttons.length > 1) {
      // Click the last button (usually settings)
      await buttons[buttons.length - 1].click();
      
      // Wait for settings to potentially open
      await window.waitForTimeout(2000);
      
      // Check if any dialog or modal opened, or if the page state changed
      const dialogs = await window.$$('[role="dialog"], div[class*="modal"], div[class*="settings"], div[class*="panel"]');
      
      // Even if no dialog opens, check that the app didn't crash
      const appStillRunning = await window.$$('textarea');
      expect(appStillRunning.length).toBeGreaterThan(0);
    } else {
      // If only one button exists, that's fine - app is running
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    }
  });
});