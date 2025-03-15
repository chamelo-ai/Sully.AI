// utils/testHistoryReporter.js
import { existsSync, readFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import path from 'path';

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
