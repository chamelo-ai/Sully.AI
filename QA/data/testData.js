// data/testData.js

export const testData = {
  validLogin: {
    username: 'nathancha33@gmail.com',
    password: 'Testing1234',
  },

  /**
   * Medical scenarios available for transcript scoring tests.
   * Each string becomes the OpenAI prompt keyword AND the cache file prefix.
   *
   * Run a single scenario:  SCENARIO=headache npx playwright test Transcriptscore.spec.js
   * Run all scenarios:      npx playwright test Transcriptscore.spec.js
   */
  dialogueScenarios: [
    'cough',
    'headache',
    'diabetes',
    'hypertension',
    'backpain',
    'anxiety',
    'asthma',
  ],
};
