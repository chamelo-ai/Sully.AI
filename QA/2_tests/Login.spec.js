// 2_tests/Login.spec.js
import { test, expect } from '@playwright/test';
import { shouldRunTest } from '../utils/testHistory.js'; // Import from testHistory.js
import { testData } from '../data/testData.js';
import { LoginPage } from '../1_pages/LoginPage.js';
import { common, sideNavBar } from '../1_pages/1_locators.js';

test.beforeEach(async ({}, testInfo) => {
  if (!(await shouldRunTest(testInfo.title))) {
    testInfo.skip();
  }
});

test('User can login with email/password and navigate between nav bar', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.navigate();
  await loginPage.login(testData.validLogin.username, testData.validLogin.password);
  await expect(loginPage.profileHeader).toBeVisible({ timeout: 10000 });
  console.log('Login successful using credentials from testData!');
});

test('User can navigate side navbar tabs', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.navigate();
  await loginPage.login(testData.validLogin.username, testData.validLogin.password);
  
  await expect(loginPage.profileHeader).toBeVisible({ timeout: 10000 });
  await page.click(sideNavBar.homeTab);
  console.log("Clicked Home tab");
  await page.click(sideNavBar.searchTab);
  console.log("Clicked Search tab");
  await page.click(sideNavBar.visitsTab);
  console.log("Clicked Visits tab");
  await page.click(sideNavBar.patientsTab);
  console.log("Clicked Patients tab");
  await page.click(sideNavBar.scribeTab);
  console.log("Clicked Scribe tab");
});
