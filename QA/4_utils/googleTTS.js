/**
 * Google Cloud Text-to-Speech utility with OpenAI dialogue generation
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import axios from 'axios';
import sampleDialogues from '../data/sampleDialogues.js';

// Setup and constants
dotenv.config();
const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

// Speaker voice configurations (Google TTS fallback)
const VOICE_CONFIGS = {
  'Clinician': {
    voiceName: 'en-US-Studio-O',
    ssmlGender: 'FEMALE',
    speakingRate: 0.95,
    pitch: 5.0,
    openaiVoice: 'nova'      // warm female
  },
  'Patient': {
    voiceName: 'en-US-Neural2-J',
    ssmlGender: 'MALE',
    speakingRate: 0.85,
    pitch: -10.0,
    openaiVoice: 'onyx'      // deep male
  },
  'Narrator': {
    voiceName: 'en-US-Neural2-C',
    ssmlGender: 'NEUTRAL',
    speakingRate: 0.9,
    pitch: 0.0,
    openaiVoice: 'shimmer'
  }
};

/**
 * Create a Google Cloud TTS client using service account credentials
 */
function createTTSClient() {
  return new TextToSpeechClient({
    keyFilename: path.join(process.cwd(), 'audiotesting.json')
  });
}

/**
 * Convert text to speech using OpenAI TTS API (primary provider)
 */
async function textToSpeechOpenAI(text, outputPath, options = {}) {
  if (!OPENAI_API_KEY) return false;
  try {
    const voice = options.openaiVoice || 'alloy';
    const response = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      { model: 'tts-1', input: text, voice },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        responseType: 'arraybuffer',
        timeout: 20000
      }
    );
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, Buffer.from(response.data));
    return true;
  } catch (error) {
    console.error('OpenAI TTS error:', error.message);
    return false;
  }
}

/**
 * Convert text to speech using macOS built-in `say` command (no credentials needed).
 * Clinician → Samantha (female), Patient → Alex (male), Narrator → Karen.
 */
async function textToSpeechMacOS(text, outputPath, options = {}) {
  try {
    const voiceMap = { nova: 'Samantha', onyx: 'Alex', shimmer: 'Karen', alloy: 'Karen' };
    const voice = voiceMap[options.openaiVoice] || 'Samantha';
    const aiffPath = outputPath.replace(/\.mp3$/, '.aiff');
    const escapedText = text.replace(/'/g, "'\\''");
    await execAsync(`say -v "${voice}" '${escapedText}' -o "${aiffPath}"`);
    await execAsync(`ffmpeg -y -i "${aiffPath}" "${outputPath}" 2>/dev/null`);
    await fs.unlink(aiffPath).catch(() => {});
    return true;
  } catch (error) {
    console.error('macOS say TTS error:', error.message);
    return false;
  }
}

/**
 * Convert text to speech — tries OpenAI first, falls back to Google, then macOS say
 */
async function textToSpeech(text, outputPath, options = {}) {
  // Try OpenAI TTS first (Google credentials are often expired)
  if (OPENAI_API_KEY) {
    const ok = await textToSpeechOpenAI(text, outputPath, options);
    if (ok) return true;
    console.log('OpenAI TTS failed, trying Google TTS fallback...');
  }

  const defaultOptions = {
    voiceName: 'en-US-Standard-D',
    languageCode: 'en-US',
    ssmlGender: 'NEUTRAL',
    audioEncoding: 'MP3',
    speakingRate: 1.0,
    pitch: 0.0
  };
  
  const opts = { ...defaultOptions, ...options };
  
  try {
    // Create TTS client and prepare request
    const client = createTTSClient();
    const request = {
      input: { text },
      voice: {
        languageCode: opts.languageCode,
        name: opts.voiceName,
        ssmlGender: opts.ssmlGender
      },
      audioConfig: {
        audioEncoding: opts.audioEncoding,
        speakingRate: opts.speakingRate,
        pitch: opts.pitch
      }
    };

    // Enforce a hard 8-second timeout per TTS request so a hanging gRPC call
    // doesn't stall the whole test when credentials are invalid/expired.
    const ttsPromise = client.synthesizeSpeech(request);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TTS request timed out after 8s')), 8000)
    );
    const [response] = await Promise.race([ttsPromise, timeoutPromise]);

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, response.audioContent);
    
    return true;
  } catch (error) {
    console.error('TTS error:', error.message);
  }

  // Final fallback: macOS built-in say command (no credentials required)
  console.log('Google TTS failed, using macOS say fallback...');
  return textToSpeechMacOS(text, outputPath, options);
}

/**
 * Generate a medical dialogue using OpenAI API
 */
async function generateOpenAIDialogue(scenario) {
  if (!OPENAI_API_KEY) {
    console.log('OpenAI API key not found, using sample dialogue');
    return null;
  }
  
  try {
    const prompt = `
Create a realistic medical dialogue between a clinician and a patient about ${scenario}.
The dialogue should be 6-8 exchanges long (3-4 turns each).
The patient should describe symptoms consistent with ${scenario}.
The clinician should ask appropriate follow-up questions and offer medical advice.

Format the dialogue as a JSON array where each object has "speaker" (either "Clinician" or "Patient") and "text" properties.
Example format:
[
  {"speaker": "Clinician", "text": "Hello, what brings you in today?"},
  {"speaker": "Patient", "text": "I've been having a persistent cough for the past two weeks."}
]
Provide ONLY the raw JSON array with no additional text, explanations or markdown formatting.
`;

    const response = await axios.post(
      OPENAI_API_ENDPOINT,
      {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a medical dialogue generator that creates realistic clinician-patient conversations. Respond only with the requested JSON format and nothing else.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        timeout: 30000
      }
    );
    
    // Parse and validate response
    const dialogue = JSON.parse(response.data.choices[0].message.content.trim());
    
    if (!Array.isArray(dialogue) || dialogue.length === 0) {
      throw new Error('Invalid dialogue format');
    }
    
    // Validate each dialogue entry
    for (const item of dialogue) {
      if (!item.speaker || !item.text || 
          (item.speaker !== 'Clinician' && item.speaker !== 'Patient')) {
        throw new Error('Invalid dialogue format - missing or invalid properties');
      }
    }
    
    return dialogue;
  } catch (error) {
    console.error('OpenAI dialogue generation error:', error.message);
    return null;
  }
}

/**
 * Create silence audio file using ffmpeg
 */
async function createSilence(outputPath, duration = 1.5) {
  try {
    await execAsync(`ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t ${duration} -q:a 9 -acodec libmp3lame "${outputPath}" 2>/dev/null`);
    return true;
  } catch (error) {
    console.warn('Failed to create silence:', error.message);
    return false;
  }
}

/**
 * Convert a dialogue array to speech
 */
async function dialogueToSpeech(dialogue, outputPath) {
  try {
    // Isolate per-output line cache so different dialogues (e.g. fresh vs sample
    // for the same scenario) never reuse each other's index-based line files.
    const baseName = path.basename(outputPath, path.extname(outputPath));
    const tempDir = path.join(dirname(outputPath), `temp_audio_${baseName}`);

    // Start clean so stale line audio from a previous run isn't reused.
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(tempDir, { recursive: true });
    const audioFiles = [];
    
    // Add initial silence
    const initialPausePath = path.join(tempDir, 'initial_pause.mp3');
    if (await createSilence(initialPausePath, 1.5)) {
      audioFiles.push(initialPausePath);
    }
    
    // Add introduction
    const introPath = path.join(tempDir, 'intro.mp3');
    if (await textToSpeech(
      "In this recording, the clinician will be a female voice, and the patient will be a male voice.",
      introPath,
      VOICE_CONFIGS.Narrator
    )) {
      audioFiles.push(introPath);
    }
    
    // Generate audio for each dialogue line
    for (let i = 0; i < dialogue.length; i++) {
      const line = dialogue[i];
      const speaker = line.speaker || 'Narrator';
      const text = line.text?.trim();
      
      if (!text) continue;
      
      // Add speaker label and generate audio
      const formattedText = `${speaker}, ${text}`;
      const lineAudioPath = path.join(tempDir, `line_${i.toString().padStart(3, '0')}.mp3`);

      if (await textToSpeech(formattedText, lineAudioPath, VOICE_CONFIGS[speaker] || VOICE_CONFIGS.Narrator)) {
        audioFiles.push(lineAudioPath);
        
        // Add pause between lines (except for the last line)
        if (i < dialogue.length - 1) {
          const pausePath = path.join(tempDir, `pause_${i}.mp3`);
          if (await createSilence(pausePath, 0.7)) {
            audioFiles.push(pausePath);
          }
        }
      }
    }
    
    // If we have audio files, combine them
    if (audioFiles.length === 0) {
      throw new Error('No audio files were generated');
    }
    
    // Create a file list for ffmpeg
    const fileListPath = path.join(tempDir, 'filelist.txt');
    const fileListContent = audioFiles.map(file => 
      `file '${file.replace(/'/g, "'\\''")}'`
    ).join('\n');
    await fs.writeFile(fileListPath, fileListContent);
    
    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    try {
      // Try ffmpeg concatenation
      const { stderr } = await execAsync(
        `ffmpeg -y -f concat -safe 0 -i "${fileListPath}" -ar 44100 -ac 1 -ab 128k "${outputPath}" 2>/dev/null`
      );
      if (stderr) console.log('ffmpeg stderr:', stderr);
      return true;
    } catch (ffmpegError) {
      // Fallback to sequential copying
      console.log('Falling back to sequential file copying...');
      await fs.writeFile(outputPath, Buffer.alloc(0));
      
      for (const audioFile of audioFiles) {
        await fs.appendFile(outputPath, await fs.readFile(audioFile));
      }
      return true;
    }
  } catch (error) {
    console.error('Error in dialogueToSpeech:', error.message);
    return false;
  }
}

/**
 * Get dialogue for a specific scenario
 */
export async function getDialogue(scenario, forceRefresh = false) {
  try {
    // Define path for cached dialogue
    const dialoguePath = path.join(process.cwd(), 'temp', `dialogue_${scenario}.json`);
    
    // Use cached dialogue if available and not forcing refresh
    if (!forceRefresh) {
      try {
        const fileExists = await fs.access(dialoguePath).then(() => true).catch(() => false);
        if (fileExists) {
          return JSON.parse(await fs.readFile(dialoguePath, 'utf8'));
        }
      } catch (error) {
        // Continue if cache reading fails
      }
    }
    
    // Generate new dialogue or use sample
    const openAIDialogue = await generateOpenAIDialogue(scenario);
    const dialogue = openAIDialogue || (sampleDialogues[scenario] || sampleDialogues['cough']);
    
    if (!dialogue || dialogue.length === 0) {
      return [];
    }
    
    // Cache the dialogue
    await fs.mkdir(path.dirname(dialoguePath), { recursive: true });
    await fs.writeFile(dialoguePath, JSON.stringify(dialogue, null, 2));
    
    return dialogue;
  } catch (error) {
    console.error('Error getting dialogue:', error.message);
    return sampleDialogues[scenario] || sampleDialogues['cough'];
  }
}

/**
 * Log dialogue to console in formatted way
 */
export function logDialogue(dialogue) {
  console.log('\n========== DIALOGUE USED IN THIS TEST ==========');
  dialogue.forEach(line => console.log(`${line.speaker}: "${line.text}"`));
  console.log('===============================================\n');
}

export { textToSpeech, dialogueToSpeech };