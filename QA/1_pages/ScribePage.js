import { common } from './1_locators.js';

export class ScribePage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page                 = page;
    this.startRecordingBtn    = page.locator(common.startRecordingButton);
    this.stopRecordingBtn     = page.locator(common.stopRecordingButton);
    this.micErrorModal        = page.locator('div.popup-body, [role="dialog"]').filter({ hasText: 'Microphone' });
    this.shortRecordingModal  = page.locator(common.shortRecordingErrorModal);
  }
}
