import { LoginLocators, HeaderLocators } from './1_locators.js';

export class LoginPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page          = page;
    this.emailField    = page.locator(LoginLocators.emailField);
    this.passwordField = page.locator(LoginLocators.passwordField);
    this.continueBtn   = page.locator(LoginLocators.continueButton);
    this.submitBtn     = page.locator(LoginLocators.submitButton);
    this.profileHeader = page.locator(HeaderLocators.profileHeader);
  }
}
