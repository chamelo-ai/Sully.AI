export class HomeHelper {
  /** @param {import('../1_pages/HomePage.js').HomePage} homePage */
  constructor(homePage) {
    this.homePage = homePage;
  }

  async waitForLoad() {
    await this.homePage.page.waitForURL('**/app.sully.ai/**', { timeout: 15000 }).catch(() => {});
    await this.homePage.page.waitForTimeout(2000);
  }

  /**
   * Dismisses the CookieYes consent banner and the star-rating feedback bar.
   * Safe to call multiple times.
   */
  async dismissOverlays() {
    const { cookieAcceptBtn, starRatingBtn, page } = this.homePage;

    // Cookie consent — retry up to 3x and wait for it to disappear
    for (let i = 0; i < 3; i++) {
      if (await cookieAcceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cookieAcceptBtn.click().catch(() => {});
        await page.waitForSelector('button[data-cky-tag="accept-button"]', {
          state: 'hidden', timeout: 5000
        }).catch(() => {});
      } else break;
    }

    // Star-rating bar — click first star
    if (await starRatingBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await starRatingBtn.click().catch(() => {});
      await page.waitForTimeout(500);
    }
  }

  /**
   * Types the patient name into the search dropdown and selects the matching result.
   * @param {string} patientName
   */
  async selectExistingPatient(patientName) {
    await this.homePage.patientSearchInput.fill(patientName);
    await this.homePage.patientDropdownResults
      .filter({ hasText: patientName })
      .first()
      .click({ timeout: 15000 });
    await this.homePage.page.waitForTimeout(1500);
  }
}
