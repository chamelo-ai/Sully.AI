import { test, expect } from '@playwright/test';
import { testData } from '../data/testData.js';
import { LoginPage } from '../1_pages/LoginPage.js';
import { ScribePage } from '../1_pages/ScribePage.js';
import { sideNavBar, common } from '../1_pages/1_locators.js';
import { shouldRunTest } from '../utils/testHistory.js';

// test.beforeEach(async ({ }, testInfo) => {
//   if (!(await shouldRunTest(testInfo.title))) {
//     testInfo.skip();
//   }
// });

test('Scribe Transcript Flow: Send report after selecting an existing patient', async ({ page }) => {
  // Step 1: Login
  const loginPage = new LoginPage(page);
  await loginPage.navigate();
  await loginPage.login(testData.validLogin.username, testData.validLogin.password);
  await expect(loginPage.profileHeader).toBeVisible({ timeout: 10000 });
  console.log('Login successful using credentials from testData!');

  // Step 2: Navigate to the Scribe tab from the side navbar
  await page.click(sideNavBar.scribeTab);
  console.log('Clicked on Scribe tab');

  // Step 3: Input "Patient" in the search box
  await page.fill(common.patientSearchBox, 'Patient 1');
  console.log('Entered "Patient" in the search box');

  // Step 4: Click on the first search result (Patient 1) using .nth(0)
  const selectedPatient = await page.locator(common.patientResult).nth(0).textContent();
  await page.locator(common.patientResult).nth(0).click();
  console.log('Clicked on the first patient result (Patient 1) with text:', selectedPatient);


  // Step 5: Click on the Send button
  await page.click(common.sendButton);
  console.log('Clicked on Send button');

  // Step 6: Input the provider address into the designated field
  await page.fill(common.providerAddressInput, testData.providerAddress.email);
  console.log('Entered provider address');

  // Step 7: Click on the Send Report button
  await page.click(common.sendReportButton);
  console.log('Clicked on Send Report button');

  // Step 8: Click the OK button to confirm sending the report
  await page.click(common.okButton);
  console.log('Clicked OK to confirm send');

  // Step 9: Verify that the notes contain Patient name selected in Step 4
  await expect(page.locator(common.patientNotes)).toContainText(selectedPatient);
  console.log('Report sent successfully confirmed with patient:', selectedPatient);
});


test('Scribe Flow: Select existing patient from dropdown and record visit', async ({ browser }) => {
  // Create a new context with microphone permissions
  const context = await browser.newContext({
    permissions: ['microphone'],
    baseURL: 'https://app.sully.ai'
  });

  // Create a page from this context
  const page = await context.newPage();
  console.log('Microphone permission granted');

  // Step 1: Login
  const scribePage = new ScribePage(page);
  const loginPage = new LoginPage(page);
  await loginPage.navigate();
  await loginPage.login(testData.validLogin.username, testData.validLogin.password);
  await expect(loginPage.profileHeader).toBeVisible({ timeout: 10000 });
  console.log('Login successful using credentials from testData!');

  // Step 3: Click on the Existing Patient dropdown
  await page.click(common.existingPatientDropdown);
  console.log('Clicked on Existing Patient dropdown');

  // Step 4: Print out the list of names in the dropdown
  const dropdownItems = page.locator(common.patientDropdownResults);
  const count = await dropdownItems.count();
  console.log('Number of patients in dropdown:', count);
  for (let i = 0; i < count; i++) {
    const name = await dropdownItems.nth(i).textContent();
    console.log(`Patient ${i + 1}: ${name}`);
  }

  // Step 5: Select the patient with text "ScribeE2E"
  const patientOption = page.locator(common.patientDropdownResults).filter({ hasText: 'ScribeE2E' });
  await patientOption.click();
  console.log('Selected patient "ScribeE2E"');

  // Step 6: Click "Start Recording"
  await scribePage.startRecording();
  console.log('Clicked on Start Recording button');

  // Step 7: Wait for 10 seconds to simulate recording duration
  await page.waitForTimeout(10000);
  console.log('Waited for 10 seconds');

  // Step 8: Click on "Finish Visit"
  await scribePage.stopRecording();
  console.log('Clicked on Finish Visit button');
});


test('Scribe Flow: Select existing patient from dropdown and record visit under mininum threshold', async ({ browser }) => {
  const context = await browser.newContext({
    permissions: ['microphone'],
    baseURL: 'https://app.sully.ai'
  });

  // Create a page from this context
  const page = await context.newPage();
  console.log('Microphone permission granted');

  // Step 1: Login
  const scribePage = new ScribePage(page);
  const loginPage = new LoginPage(page);
  const errorModal = page.locator(common.shortRecordingErrorModal);
  const patientOption = page.locator(common.patientDropdownResults).filter({ hasText: 'ScribeE2E' });
  const dropdownItems = page.locator(common.patientDropdownResults);

  await loginPage.navigate();
  await loginPage.login(testData.validLogin.username, testData.validLogin.password);
  await expect(loginPage.profileHeader).toBeVisible({ timeout: 10000 });
  console.log('Login successful using credentials from testData!');

  // Step 3: Click on the Existing Patient dropdown
  await page.click(common.existingPatientDropdown);
  console.log('Clicked on Existing Patient dropdown');

  // Step 4: Print out the list of names in the dropdown
  const count = await dropdownItems.count();
  console.log('Number of patients in dropdown:', count);
  for (let i = 0; i < count; i++) {
    const name = await dropdownItems.nth(i).textContent();
    console.log(`Patient ${i + 1}: ${name}`);
  }

  // Step 5: Select the patient with text "ScribeE2E"
  await patientOption.click();
  console.log('Selected patient "ScribeE2E"');

  // Step 6: Click "Start Recording"
  await scribePage.startRecording();
  console.log('Clicked on Start Recording button');

  // Step 7: Wait for 10 seconds to simulate recording duration
  await page.waitForTimeout(3000);
  console.log('Waited for 10 seconds');

  // Step 8: Click on "Finish Visit"
  await scribePage.stopRecording();
  console.log('Clicked on Finish Visit button');

  await expect(errorModal).toBeVisible({ timeout: 10000 });
  await expect(errorModal).toContainText('Cannot generate transcript. Recording is too short.');


});

test('Scribe Flow: Select existing patient from dropdown and record visit without microphone permission', async ({ browser }) => {
  // Create a new context WITHOUT granting microphone permission
  const context = await browser.newContext({
    permissions: [], // No microphone permission granted
    baseURL: 'https://app.sully.ai'
  });

  // Create a page from this context
  const page = await context.newPage();
  console.log('Microphone permission NOT granted');

  // Step 1: Login
  const scribePage = new ScribePage(page);
  const loginPage = new LoginPage(page);
  await loginPage.navigate();
  await loginPage.login(testData.validLogin.username, testData.validLogin.password);
  await expect(loginPage.profileHeader).toBeVisible({ timeout: 10000 });
  console.log('Login successful using credentials from testData!');

  // Step 3: Click on the Existing Patient dropdown
  await page.click(common.existingPatientDropdown);
  console.log('Clicked on Existing Patient dropdown');

  // Step 4: Print out the list of names in the dropdown
  const dropdownItems = page.locator(common.patientDropdownResults);
  const count = await dropdownItems.count();
  console.log('Number of patients in dropdown:', count);
  for (let i = 0; i < count; i++) {
    const name = await dropdownItems.nth(i).textContent();
    console.log(`Patient ${i + 1}: ${name}`);
  }

  // Step 5: Select the patient with text "ScribeE2E"
  const patientOption = page.locator(common.patientDropdownResults).filter({ hasText: 'ScribeE2E' });
  await patientOption.click();
  console.log('Selected patient "ScribeE2E"');

  // Step 6: Click "Start Recording"
  await scribePage.startRecording();
  console.log('Clicked on Start Recording button');

  await page.click(common.closeButton);


  await expect(page.locator(common.micDeniedMessage)).toBeVisible({ timeout: 10000 });
  await expect(page.locator(common.micDeniedMessage)).toContainText('Microphone access required');
  console.log('Microphone permission error message is visible and correct.');




});
