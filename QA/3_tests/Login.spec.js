// 3_tests/Login.spec.js
import { test, expect } from '../fixtures/test.js';
import { testData } from '../data/testData.js';
import { shouldRunTest } from '../4_utils/testHistory.js';

test.beforeEach(async ({}, testInfo) => {
  if (!(await shouldRunTest(testInfo.title))) {
    testInfo.skip();
  }
});

test('User can login with email/password and navigate between nav bar', async ({ loginHelper, loginPage }) => {
  await loginHelper.navigate();
  await loginHelper.login(testData.validLogin.username, testData.validLogin.password);
  await expect(loginPage.profileHeader).toBeVisible({ timeout: 10000 });
  console.log('Login successful using credentials from testData!');
});
