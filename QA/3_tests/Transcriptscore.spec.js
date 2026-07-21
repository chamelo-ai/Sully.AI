import { test } from '../fixtures/test.js';
import { testData } from '../data/testData.js';

test.describe('verify transcript score for dialogue Scenarios', () => {
  test.setTimeout(300000);

  test.beforeEach(async ({ loginHelper, homeHelper }) => {
    await loginHelper.navigate();
    await loginHelper.login(testData.validLogin.username, testData.validLogin.password);
    await homeHelper.waitForLoad();
    await homeHelper.dismissOverlays();
  });

  test.only('verify transcript score for dialogue Scenarios - Cough',                  async ({ transcriptScoreHelper }) => {
    await transcriptScoreHelper.verifyTranscriptScore('cough');
  });

  test('verify transcript score for dialogue Scenarios - Cough (sample dialogue)', async ({ transcriptScoreHelper }) => {
    await transcriptScoreHelper.verifyTranscriptScoreWithSampleDialogue('cough');
  });

  test.only('verify transcript score for dialogue Scenarios - Cough (local analyzer)', async ({ transcriptScoreHelper }) => {
    await transcriptScoreHelper.verifyTranscriptScoreWithLocalAnalyzer('cough');
  });

  test('verify transcript score for dialogue Scenarios - Headache',          async ({ transcriptScoreHelper }) => {
    await transcriptScoreHelper.verifyTranscriptScore('headache');
  });

  test('verify transcript score for dialogue Scenarios - Diabetes',          async ({ transcriptScoreHelper }) => {
    await transcriptScoreHelper.verifyTranscriptScore('diabetes');
  });

  test('verify transcript score for dialogue Scenarios - Hypertension',      async ({ transcriptScoreHelper }) => {
    await transcriptScoreHelper.verifyTranscriptScore('hypertension');
  });

  test('verify transcript score for dialogue Scenarios - Back Pain',         async ({ transcriptScoreHelper }) => {
    await transcriptScoreHelper.verifyTranscriptScore('backpain');
  });

  test('verify transcript score for dialogue Scenarios - Anxiety',           async ({ transcriptScoreHelper }) => {
    await transcriptScoreHelper.verifyTranscriptScore('anxiety');
  });

  test('verify transcript score for dialogue Scenarios - Asthma',            async ({ transcriptScoreHelper }) => {
    await transcriptScoreHelper.verifyTranscriptScore('asthma');
  });

});
