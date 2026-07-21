import {
  activateMockMicrophone,
  routeAudioToMockMic,
  debugAudioStreams,
  calculateRecordingDuration,
} from '../4_utils/browserUtils.js';

const RECORDING_TIME_PER_LINE = 5000;
const RECORDING_BUFFER_TIME   = 5000;

export class ScribeHelper {
  /** @param {import('../1_pages/ScribePage.js').ScribePage} scribePage */
  constructor(scribePage) {
    this.scribePage = scribePage;
  }

  async startRecording() {
    await this.scribePage.startRecordingBtn.click();
  }

  async stopRecording() {
    await this.scribePage.stopRecordingBtn.click();
  }

  /** Closes the microphone-error modal if it appears after startRecording. */
  async dismissMicErrorModal() {
    const { micErrorModal } = this.scribePage;
    if (await micErrorModal.isVisible({ timeout: 3000 }).catch(() => false)) {
      const closeBtn = micErrorModal.locator('button:has-text("Close"), button[aria-label="Close"]');
      await closeBtn.click().catch(() => {});
    }
  }

  /**
   * Full recording flow: activates mock mic, starts recording, pipes audio,
   * waits for playback, then stops recording.
   *
   * @param {string} audioFile  - Absolute path to the MP3 to play.
   * @param {Array}  dialogue   - Dialogue array (used for fallback wait calculation).
   */
  async recordWithAudio(audioFile, dialogue) {
    const { page } = this.scribePage;

    await activateMockMicrophone(page);
    await this.startRecording();
    await this.dismissMicErrorModal();
    await page.waitForTimeout(2000);
    await debugAudioStreams(page);

    const audioDuration = await routeAudioToMockMic(page, audioFile);
    const waitMs = audioDuration > 0
      ? Math.ceil(audioDuration * 1000) + RECORDING_BUFFER_TIME
      : calculateRecordingDuration(dialogue.length, RECORDING_TIME_PER_LINE, RECORDING_BUFFER_TIME);

    console.log(`[ScribeHelper] Waiting ${(waitMs / 1000).toFixed(1)}s for audio playback...`);
    await page.waitForTimeout(waitMs);

    await this.stopRecording();
  }
}
