import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';
import { test, expect } from '@playwright/test';
import { getDialogue, dialogueToSpeech, logDialogue } from '../4_utils/googleTTS.js';
import { processTranscript } from '../4_utils/transcriptAnalyzer.js';
import { writeTranscriptCanvas } from '../4_utils/canvasGenerator.js';
import { writeTranscriptHtml } from '../4_utils/htmlReport.js';
import sampleDialogues from '../data/sampleDialogues.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const MINIMUM_QUALITY_THRESHOLD = 85;
const LOCAL_ANALYZER_THRESHOLD  = 99;

export class TranscriptScoreHelper {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {import('./HomeHelper.js').HomeHelper}   homeHelper
   * @param {import('./ScribeHelper.js').ScribeHelper} scribeHelper
   */
  constructor(page, homeHelper, scribeHelper) {
    this.page         = page;
    this.homeHelper   = homeHelper;
    this.scribeHelper = scribeHelper;
  }

  /**
   * Full end-to-end transcript score verification for a given scenario.
   * Generates fresh dialogue + audio via OpenAI, records through the mock mic,
   * analyzes the resulting transcript, and writes the results to a canvas.
   *
   * @param {string} scenario  e.g. 'cough', 'headache', 'diabetes'
   */
  async verifyTranscriptScore(scenario) {
    const audioFile = path.join(__dirname, '../temp', `${scenario}_dialogue.mp3`);

    const dialogue = await getDialogue(scenario, true);
    if (!dialogue?.length) throw new Error(`No dialogue generated for scenario: "${scenario}"`);

    await this.#runScoringFlow(scenario, dialogue, audioFile);
  }

  /**
   * Transcript score verification using the predefined sample dialogue for a
   * scenario (no OpenAI generation). Useful for a deterministic, offline run.
   *
   * @param {string} scenario  e.g. 'cough'
   */
  async verifyTranscriptScoreWithSampleDialogue(scenario) {
    const audioFile = path.join(__dirname, '../temp', `${scenario}_sample_dialogue.mp3`);

    const dialogue = sampleDialogues[scenario];
    if (!dialogue?.length) throw new Error(`No sample dialogue found for scenario: "${scenario}"`);

    await this.#runScoringFlow(`${scenario} (sample)`, dialogue, audioFile);
  }

  /**
   * Transcript score verification that scores with the deterministic local
   * (heuristic) analyzer instead of the LLM judge. Uses the fixed sample
   * dialogue so the whole run — input and scoring — is fully reproducible.
   *
   * @param {string} scenario  e.g. 'cough'
   */
  async verifyTranscriptScoreWithLocalAnalyzer(scenario) {
    const audioFile = path.join(__dirname, '../temp', `${scenario}_local_dialogue.mp3`);

    const dialogue = sampleDialogues[scenario];
    if (!dialogue?.length) throw new Error(`No sample dialogue found for scenario: "${scenario}"`);

    await this.#runScoringFlow(`${scenario} (local analyzer)`, dialogue, audioFile, {
      useLocalAnalyzer: true,
      qualityThreshold: LOCAL_ANALYZER_THRESHOLD,
    });
  }

  /**
   * Shared flow: build audio from the given dialogue (so what's played always
   * matches what's compared), navigate to Scribe, record, analyze the
   * transcript against that dialogue, and write the canvas + HTML report.
   *
   * @param {object}  [opts]
   * @param {boolean} [opts.useLocalAnalyzer]  score with the heuristic analyzer instead of the LLM judge
   * @param {number}  [opts.qualityThreshold]  minimum overall score the run must exceed
   */
  async #runScoringFlow(label, dialogue, audioFile, { useLocalAnalyzer = false, qualityThreshold = MINIMUM_QUALITY_THRESHOLD } = {}) {
    const resultsDir = path.join(__dirname, '../results/transcript-analysis');
    await fs.mkdir(path.dirname(audioFile), { recursive: true });
    await fs.mkdir(resultsDir, { recursive: true });

    // Generate audio from this exact dialogue array — never re-fetch, or the
    // played audio could diverge from the logged/compared dialogue.
    logDialogue(dialogue);
    await dialogueToSpeech(dialogue, audioFile);

    await this.homeHelper.selectExistingPatient('ScribeE2E');
    await this.homeHelper.dismissOverlays();

    await this.scribeHelper.recordWithAudio(audioFile, dialogue);

    const result = await processTranscript(
      this.page,
      this.scribeHelper.scribePage.shortRecordingModal,
      dialogue,
      resultsDir,
      useLocalAnalyzer
    );

    expect(result, 'transcript analysis produced no result').not.toBeNull();

    // Write the reports first so a failing run is still inspectable...
    await writeTranscriptCanvas(label, result, qualityThreshold);
    const htmlPath = await writeTranscriptHtml(label, result, qualityThreshold);
    // Expose the report path so the reporter can print a link once the test ends.
    await test.info().attach('transcript-html-report', { path: htmlPath, contentType: 'text/html' });

    // ...then gate on the quality threshold (fails the test if under it).
    const { overallScore } = result.qualityResults;
    expect(
      overallScore,
      `overall score ${overallScore}% did not exceed threshold ${qualityThreshold}%`,
    ).toBeGreaterThan(qualityThreshold);
    console.log(`Quality score of ${overallScore}% exceeds minimum threshold of ${qualityThreshold}%`);
  }
}
