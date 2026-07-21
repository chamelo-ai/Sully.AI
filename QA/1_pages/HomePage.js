import { common } from './1_locators.js';

export class HomePage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page                  = page;
    this.cookieAcceptBtn       = page.locator('button[data-cky-tag="accept-button"]');
    this.starRatingBtn         = page.locator('[data-testid*="star_rating__star--1"], [data-testid*="star-rating__star--1"]').first();
    this.patientSearchInput    = page.locator(common.existingPatientDropdown);
    this.patientDropdownResults = page.locator(common.patientDropdownResults);
  }
}
