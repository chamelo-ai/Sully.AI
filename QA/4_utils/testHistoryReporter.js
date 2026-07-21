// 4_utils/testHistoryReporter.js
import { existsSync, readFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';

/**
 * Open a file in the OS default browser/app. Runs synchronously so it's
 * guaranteed to fire before the Playwright process exits — an async spawn can
 * be killed on exit (notably for the last/failing test), which is why some
 * reports never opened.
 */
function openInBrowser(filePath) {
  const cmd = process.platform === 'darwin' ? 'open'
            : process.platform === 'win32'  ? 'start ""'
            : 'xdg-open';
  try {
    execSync(`${cmd} "${filePath}"`, { stdio: 'ignore' });
  } catch (err) {
    console.error('Could not auto-open report:', err.message);
  }
}

class TestHistoryReporter {
  constructor(options) {
    this.testHistory = {};
    this.historyPath = path.join(process.cwd(), 'testHistory.json');
    if (existsSync(this.historyPath)) {
      try {
        const data = readFileSync(this.historyPath, 'utf8');
        this.testHistory = JSON.parse(data);
      } catch (error) {
        console.error('Error reading test history file:', error);
      }
    }
  }

  onTestEnd(test, result) {
    const testName = test.title;
    if (!this.testHistory[testName]) {
      this.testHistory[testName] = { totalRuns: 0, fails: 0 };
    }
    this.testHistory[testName].totalRuns += 1;
    if (result.status !== 'passed') {
      this.testHistory[testName].fails += 1;
    }

    // Print a link and open the HTML transcript report in the browser once the test finishes.
    const report = result.attachments.find(a => a.name === 'transcript-html-report');
    if (report?.path) {
      console.log(`\nHTML report for "${testName}":\n  file://${report.path}\n`);
      openInBrowser(report.path);
    }
  }

  async onEnd() {
    try {
      await writeFile(this.historyPath, JSON.stringify(this.testHistory, null, 2));
      console.log('Test history updated at:', this.historyPath);
    } catch (error) {
      console.error('Error writing test history file:', error);
    }
  }
}

export default TestHistoryReporter;
