// 1_pages/ScribePage.js
import { common } from './1_locators.js';

export class ScribePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // You can also add other scribe-related locators here if needed.
  }

  async navigateToScribe() {
    await this.page.goto('https://app.sully.ai/scribe');
  }

  async startRecording() {
    await this.page.click(common.startRecordingButton);
  }

  async stopRecording() {
    await this.page.click(common.stopRecordingButton);
  }

  /**
   * Selects a patient from the search results by name.
   * @param {string} patientName The name of the patient to select.
   */
  async selectPatient(patientName) {
    // Build a dynamic locator using the patient name.
    const patientOption = this.page.locator(`ul#patient-search-dropdown li:has-text("${patientName}")`);
    await patientOption.click();
    console.log(`Selected patient: ${patientName}`);
  }
}
