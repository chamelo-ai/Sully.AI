export class LoginHelper {
  /** @param {import('../1_pages/LoginPage.js').LoginPage} loginPage */
  constructor(loginPage) {
    this.loginPage = loginPage;
  }

  async navigate() {
    await this.loginPage.page.goto('https://app.sully.ai');
  }

  async login(email, password) {
    await this.loginPage.emailField.fill(email);
    await this.loginPage.continueBtn.click();
    await this.loginPage.passwordField.waitFor({ state: 'visible', timeout: 15000 });
    await this.loginPage.passwordField.fill(password);
    await this.loginPage.submitBtn.click();
  }
}
