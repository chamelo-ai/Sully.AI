// 1_pages/LoginPage.js
import { LoginLocators, HeaderLocators } from './1_locators.js';

export class LoginPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.emailField = page.locator(LoginLocators.emailField);
    this.passwordField = page.locator(LoginLocators.passwordField);
    this.loginButton = page.locator(LoginLocators.loginButton);
    this.profileHeader = page.locator(HeaderLocators.profileHeader);
  }

  async navigate() {
    await this.page.goto('https://app.sully.ai');
  }

  async login(email, password) {
    await this.emailField.fill(email);
    await this.passwordField.fill(password);
    await this.loginButton.click();
  }

  // If needed, include your Google sign-in method here.
}
