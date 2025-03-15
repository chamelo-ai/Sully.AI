// utils/testHistory.js
import { promises as fs } from 'fs';
import path from 'path';

const HISTORY_PATH = path.join(process.cwd(), 'testHistory.json');

export async function loadHistoricalResults() {
  try {
    const data = await fs.readFile(HISTORY_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading historical test data:', error);
    return {};
  }
}

/**
 * Decide whether a test should run based on historical failure rate.
 * @param {string} testName - Unique test name.
 * @returns {Promise<boolean>} - True if test should run.
 */
export async function shouldRunTest(testName) {
  const results = await loadHistoricalResults();
  const testResult = results[testName];
  if (!testResult) return true; // Run test if no history exists.
  
  const failureRate = testResult.fails / testResult.totalRuns;
  // Only run the test if the failure rate is above 20%.
  return failureRate > 0.2;
}
