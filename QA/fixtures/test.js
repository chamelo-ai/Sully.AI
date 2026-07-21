import { test as base } from '@playwright/test';

// Pages (locators)
import { LoginPage }  from '../1_pages/LoginPage.js';
import { HomePage }   from '../1_pages/HomePage.js';
import { ScribePage } from '../1_pages/ScribePage.js';

// Helpers (actions)
import { LoginHelper }           from '../2_pagesHelpers/LoginHelper.js';
import { HomeHelper }            from '../2_pagesHelpers/HomeHelper.js';
import { ScribeHelper }          from '../2_pagesHelpers/ScribeHelper.js';
import { TranscriptScoreHelper } from '../2_pagesHelpers/TranscriptScoreHelper.js';


// Browser utilities
import { createContextWithMicPermission, setupAudioInfrastructure } from '../4_utils/browserUtils.js';

/**
 * Fixture shape for this test suite. Declaring it explicitly (rather than
 * relying on `base.extend` inference, which widens to `any` in plain JS)
 * gives editors working autocomplete + "Go to Definition" on every fixture.
 *
 * @typedef {object} POMFixtures
 * @property {LoginPage}             loginPage
 * @property {HomePage}              homePage
 * @property {ScribePage}            scribePage
 * @property {LoginHelper}           loginHelper
 * @property {HomeHelper}            homeHelper
 * @property {ScribeHelper}          scribeHelper
 * @property {TranscriptScoreHelper} transcriptScoreHelper
 *
 * @typedef {import('@playwright/test').PlaywrightTestArgs
 *   & import('@playwright/test').PlaywrightTestOptions
 *   & POMFixtures} TestArgs
 * @typedef {import('@playwright/test').PlaywrightWorkerArgs
 *   & import('@playwright/test').PlaywrightWorkerOptions} WorkerArgs
 */

/**
 * Extended Playwright test exposing the full 3-layer POM as fixtures:
 *
 *  Layer 1 — Pages (locators only):
 *    loginPage, homePage, scribePage
 *
 *  Layer 2 — Helpers (actions, waits, assertions):
 *    loginHelper, homeHelper, scribeHelper, transcriptScoreHelper
 *
 * @type {import('@playwright/test').TestType<TestArgs, WorkerArgs>}
 */
export const test = base.extend({

  // ── Browser context with mic permissions ──────────────────────────────────
  context: async ({ browser }, use) => {
    const context = await createContextWithMicPermission(browser);
    await use(context);
    await context.close();
  },

  // ── Page with audio infrastructure injected ───────────────────────────────
  page: async ({ context }, use) => {
    const page = await context.newPage();
    await setupAudioInfrastructure(page);
    await use(page);
  },

  // ── Layer 1: Pages ────────────────────────────────────────────────────────
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },

  scribePage: async ({ page }, use) => {
    await use(new ScribePage(page));
  },

  // ── Layer 2: Helpers ──────────────────────────────────────────────────────
  loginHelper: async ({ loginPage }, use) => {
    await use(new LoginHelper(loginPage));
  },

  homeHelper: async ({ homePage }, use) => {
    await use(new HomeHelper(homePage));
  },

  scribeHelper: async ({ scribePage }, use) => {
    await use(new ScribeHelper(scribePage));
  },

  transcriptScoreHelper: async ({ page, homeHelper, scribeHelper }, use) => {
    await use(new TranscriptScoreHelper(page, homeHelper, scribeHelper));
  },

});

export { expect } from '@playwright/test';
