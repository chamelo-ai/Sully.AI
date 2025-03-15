// playwright.config.js
import { defineConfig } from '@playwright/test';

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

export default defineConfig({
  testDir: './2_tests',
  timeout: 30000,
  use: {
    headless: false,
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
      open: 'always' 
    }],
    ['list'],
    ['./utils/testHistoryReporter.js', {}] // Custom reporter
  ],
  outputDir: `./automation-results/${timestamp}`,
  preserveOutput: 'always'
});
