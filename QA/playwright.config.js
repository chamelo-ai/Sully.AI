// playwright.config.js
import { defineConfig } from '@playwright/test';

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

export default defineConfig({
  testDir: './3_tests',
  timeout: 300000,
  // Add these properties for one-by-one execution
  workers: 1,           // Run tests with just 1 worker (sequentially)
  fullyParallel: false, // Disable parallel execution
  retries: 0,           // Optional: Setting retries to 0 makes debugging clearer
  
  use: {
    headless: process.env.CI === 'true' || process.env.PLAYWRIGHT_HEADLESS === 'true',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    channel: 'chrome'
  },
  projects: [
    {
      name: 'chrome',
      use: { 
        browserName: 'chromium',
        channel: 'chrome'
      },
    }
  ],
  reporter: [
    ['html', { 
      outputFolder: `./automation-results/${timestamp}`,
      open: 'never' 
    }],
    ['list'],
    ['./4_utils/testHistoryReporter.js', {}] // Custom reporter
  ],
  outputDir: `./automation-results/${timestamp}`,
  preserveOutput: 'always'
});