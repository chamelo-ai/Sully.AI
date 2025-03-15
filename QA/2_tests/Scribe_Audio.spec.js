import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { ScribePage } from '../1_pages/ScribePage.js';
import { LoginPage } from '../1_pages/LoginPage.js';
import { sideNavBar, common } from '../1_pages/1_locators.js';
import { testData } from '../data/testData.js';
import { getDialogue } from '../utils/openAIdialogueGenerator.js';
import { createSpeechScript } from '../utils/webSpeechSynthesis.js';
import { createContextWithMicPermission, setupAudioInfrastructure, injectSpeechSynthesis } from '../utils/browserUtils.js';
import { shouldRunTest } from '../utils/testHistory.js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Get current file's directory (ES Module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// test.beforeEach(async ({}, testInfo) => {
//     if (!(await shouldRunTest(testInfo.title))) {
//       testInfo.skip();
//     }
//   });
  

test('Scribe Flow: Test with AI-generated dialogue and Web Speech Synthesis', async ({ browser }) => {
  // Extended timeout for this test since it involves API calls and audio generation
  test.setTimeout(240000); // 4 minutes
  
  // Control whether audio should be audibly played (set to true to hear it)
  const playAudibly = true;
  
  // Get dialogue for a specific medical scenario
  console.log('Generating dialogue for test...');
  const scenario = 'cough'; // You can use other scenarios: 'headache', 'diabetes', etc.
  const forceRefresh = process.env.FORCE_REFRESH_DIALOGUE === 'true';
  const dialogue = await getDialogue(scenario, forceRefresh);
  console.log('Generated dialogue with', dialogue.length, 'entries');
  
  // Print the dialogue that will be converted to audio
  console.log('========== AI-GENERATED DIALOGUE ==========');
  console.log(JSON.stringify(dialogue, null, 2));
  console.log('==========================================');
  
  // Generate speech script file path
  const scriptFilePath = path.join(__dirname, '../temp', `speech_script_${scenario}.json`);
  
  // Create the speech script file
  console.log('Creating speech script from dialogue...');
  const scriptGenerated = await createSpeechScript(dialogue, scriptFilePath);
  
  if (!scriptGenerated) {
    console.error('Failed to generate speech script. Skipping test.');
    test.skip();
    return;
  }
  
  console.log('Speech script generated successfully at:', scriptFilePath);
  
  // Read the script file
  const speechScript = await import('fs').then(fs => fs.readFileSync(scriptFilePath, 'utf8'));
  
  // Create context with explicit permissions
  const context = await browser.newContext({
    permissions: ['microphone'],
    baseURL: 'https://app.sully.ai'
  });
  
  // Also explicitly grant permissions for the specific origin
  await context.grantPermissions(['microphone'], { origin: 'https://app.sully.ai' });
  
  // Create a page from this context
  const page = await context.newPage();
  console.log('Microphone permission granted');
  
  // Setup audio infrastructure without activating it yet
  await setupAudioInfrastructure(page);
  console.log('Audio injection infrastructure prepared');

  // Step 1: Login
  const scribePage = new ScribePage(page);
  const loginPage = new LoginPage(page);
  const errorModal = page.locator(common.shortRecordingErrorModal);

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
  const patientOption = dropdownItems.filter({ hasText: 'ScribeE2E' });
  await patientOption.click();
  console.log('Selected patient "ScribeE2E"');

  // Before starting recording, ensure audio infrastructure is ready
  console.log('Double-checking audio infrastructure...');
  await page.evaluate(() => {
    console.log('Audio infrastructure status:', 
      window._audioInjection ? 'Set up correctly' : 'Not initialized');
      
    console.log('Current permission state:', 
      navigator.permissions ? 'Permission API available' : 'Permission API not available');
      
    // Check speech synthesis
    if (window.speechSynthesis) {
      console.log('Speech synthesis available');
      const voices = window.speechSynthesis.getVoices();
      console.log(`Found ${voices.length} speech synthesis voices`);
      if (voices.length > 0) {
        voices.forEach((voice, i) => {
          if (i < 5) { // Just log first 5 to avoid flooding the console
            console.log(`Voice ${i+1}: ${voice.name} (${voice.lang})`);
          }
        });
        if (voices.length > 5) {
          console.log(`...and ${voices.length - 5} more voices`);
        }
      }
    } else {
      console.log('Speech synthesis not available in this browser');
    }
  });

  // Step 6: Click "Start Recording" BEFORE injecting audio
  await scribePage.startRecording();
  console.log('Clicked on Start Recording button');
  
  // Wait a short moment for recording to initialize
  await page.waitForTimeout(1000);
  
  // NOW inject the speech synthesis AFTER recording has started
  console.log('Now injecting web speech synthesis into the active recording...');
  const injectionSuccess = await injectSpeechSynthesis(page, speechScript, playAudibly);
  
  if (injectionSuccess) {
    console.log('✅ Speech synthesis successfully injected into the recording!');
  } else {
    console.log('❌ Failed to inject speech synthesis. Recording may be silent.');
  }

  // Step 7: Wait for the full dialogue duration
  // Each line takes roughly 4-5 seconds to speak
  const recordingDuration = dialogue.length * 5000 + 5000; // 5 seconds per line plus buffer
  console.log(`Waiting for ${recordingDuration/1000} seconds while speech plays...`);
  await page.waitForTimeout(recordingDuration);
  console.log('Speech playback should now be complete');

  // Step 8: Click on "Finish Visit"
  await scribePage.stopRecording();
  console.log('Clicked on Finish Visit button');

//   // Check if we see the error modal (we shouldn't now with longer audio)
//   const isErrorVisible = await errorModal.isVisible({ timeout: 5000 }).catch(() => false);
  
//   if (isErrorVisible) {
//     console.log('Error modal is visible - recording might still be too short');
//     await expect(errorModal).toContainText('Cannot generate transcript. Recording is too short.');
//   } else {
//     console.log('No error modal - recording was processed successfully');
//     // Wait for transcript to appear if this element exists
//     if (common.patientNotes) {
//       await expect(page.locator(common.patientNotes)).toBeVisible({ timeout: 10000 });
//       const scribeNotes = await page.locator(common.patientNotes).textContent();
//       console.log('Patient notes text:', scribeNotes);
//     } else {
//       console.log('Note: patientNotes selector not defined, skipping transcript verification');
//     }
//   }

  await expect(page.locator(common.viewNoteButton)).toBeVisible({ timeout: 10000 });






  
});