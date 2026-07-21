/**
 * Standalone script to pre-generate dialogue + audio before running tests.
 * Run: node scripts/prepareAudio.mjs [scenario]
 * Default scenario: cough
 */

import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

dotenv.config();
const execAsync = promisify(exec);
const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dir, '..');
const OPENAI_KEY = process.env.OPENAI_API_KEY;

const scenario = process.argv[2] || 'cough';
const TEMP_DIR = path.join(ROOT, 'temp');
const AUDIO_DIR = path.join(TEMP_DIR, 'temp_audio');
const DIALOGUE_FILE = path.join(TEMP_DIR, `dialogue_${scenario}.json`);
const OUTPUT_MP3 = path.join(TEMP_DIR, `${scenario}_dialogue.mp3`);

const VOICES = { Clinician: 'nova', Patient: 'onyx', Narrator: 'shimmer' };

// ─── Step 1: Generate dialogue via OpenAI ────────────────────────────────────

async function generateDialogue() {
  console.log(`\n[1/3] Generating "${scenario}" dialogue via OpenAI...`);
  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You generate realistic medical dialogues as a JSON array. Respond ONLY with raw JSON, no markdown.' },
        { role: 'user', content: `Create a 6-exchange doctor-patient dialogue about ${scenario}. Each entry has "speaker" ("Clinician" or "Patient") and "text".` }
      ],
      temperature: 0.7,
      max_tokens: 800
    },
    { headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' }, timeout: 30000 }
  );
  const dialogue = JSON.parse(res.data.choices[0].message.content.trim());
  await fs.mkdir(TEMP_DIR, { recursive: true });
  await fs.writeFile(DIALOGUE_FILE, JSON.stringify(dialogue, null, 2));
  console.log(`    Saved ${dialogue.length} lines → ${DIALOGUE_FILE}`);
  dialogue.forEach(l => console.log(`    ${l.speaker}: "${l.text}"`));
  return dialogue;
}

// ─── Step 2: Synthesize each line via OpenAI TTS ─────────────────────────────

async function synthesizeLine(text, outputPath, voice) {
  const res = await axios.post(
    'https://api.openai.com/v1/audio/speech',
    { model: 'tts-1', input: text, voice },
    { headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' }, responseType: 'arraybuffer', timeout: 25000 }
  );
  await fs.writeFile(outputPath, Buffer.from(res.data));
}

async function generateAudio(dialogue) {
  console.log(`\n[2/3] Synthesizing ${dialogue.length} lines via OpenAI TTS...`);
  await fs.mkdir(AUDIO_DIR, { recursive: true });

  const files = [];

  // Initial silence
  const silencePath = path.join(AUDIO_DIR, 'initial_pause.mp3');
  await execAsync(`ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t 1.0 -q:a 9 -acodec libmp3lame "${silencePath}" 2>/dev/null`);
  files.push(silencePath);

  for (let i = 0; i < dialogue.length; i++) {
    const { speaker, text } = dialogue[i];
    const voice = VOICES[speaker] || 'alloy';
    const linePath = path.join(AUDIO_DIR, `line_${String(i).padStart(3, '0')}.mp3`);
    process.stdout.write(`    Line ${i + 1}/${dialogue.length} (${speaker}, ${voice})... `);
    await synthesizeLine(text, linePath, voice);
    console.log('done');
    files.push(linePath);

    if (i < dialogue.length - 1) {
      const pausePath = path.join(AUDIO_DIR, `pause_${i}.mp3`);
      await execAsync(`ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t 0.6 -q:a 9 -acodec libmp3lame "${pausePath}" 2>/dev/null`);
      files.push(pausePath);
    }
  }

  return files;
}

// ─── Step 3: Combine into one MP3 ────────────────────────────────────────────

async function combineAudio(files) {
  console.log(`\n[3/3] Combining ${files.length} segments → ${OUTPUT_MP3}`);
  const listPath = path.join(AUDIO_DIR, 'filelist.txt');
  const listContent = files.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
  await fs.writeFile(listPath, listContent);
  await execAsync(`ffmpeg -y -f concat -safe 0 -i "${listPath}" -ar 44100 -ac 1 -ab 128k "${OUTPUT_MP3}" 2>/dev/null`);
  const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${OUTPUT_MP3}"`);
  console.log(`    Duration: ${parseFloat(stdout).toFixed(1)}s`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  if (!OPENAI_KEY) { console.error('OPENAI_API_KEY not set in .env'); process.exit(1); }
  try {
    const dialogue = await generateDialogue();
    const files = await generateAudio(dialogue);
    await combineAudio(files);
    console.log('\n✅ Done — run the Playwright test now.\n');
  } catch (err) {
    console.error('\n❌ Failed:', err.message);
    process.exit(1);
  }
})();
