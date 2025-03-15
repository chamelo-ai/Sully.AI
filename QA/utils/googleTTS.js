/**
 * Google Cloud Text-to-Speech utility using Service Account authentication
 * Enhanced with OpenAI API integration for dialogue generation
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

// Load environment variables
dotenv.config();

// Convert exec to promise-based
const execAsync = promisify(exec);

// Get current file's directory (ES Module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get OpenAI API key from environment
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

/**
 * Create a Google Cloud TTS client using service account credentials
 * @returns {TextToSpeechClient} - The TTS client
 */
function createTTSClient() {
  // Path to the service account key file
  const keyFilePath = path.join(process.cwd(), 'audiotesting.json');
  
  // Create the client with the key file
  return new TextToSpeechClient({
    keyFilename: keyFilePath
  });
}

/**
 * Convert text to speech using Google Cloud TTS API
 * @param {string} text - Text to convert to speech
 * @param {string} outputPath - Path to save the audio file
 * @param {Object} options - Additional options
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
async function textToSpeech(text, outputPath, options = {}) {
  // Default options
  const defaultOptions = {
    voiceName: 'en-US-Standard-D', // Default voice
    languageCode: 'en-US',
    ssmlGender: 'NEUTRAL',
    audioEncoding: 'MP3',
    speakingRate: 1.0,
    pitch: 0.0
  };
  
  // Merge with provided options
  const mergedOptions = { ...defaultOptions, ...options };
  
  try {
    console.log(`Converting text to speech: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
    console.log(`Using voice: ${mergedOptions.voiceName} (${mergedOptions.ssmlGender})`);
    
    // Create the TTS client
    const client = createTTSClient();
    
    // Prepare the request
    const request = {
      input: { text },
      voice: {
        languageCode: mergedOptions.languageCode,
        name: mergedOptions.voiceName,
        ssmlGender: mergedOptions.ssmlGender
      },
      audioConfig: {
        audioEncoding: mergedOptions.audioEncoding,
        speakingRate: mergedOptions.speakingRate,
        pitch: mergedOptions.pitch
      }
    };
    
    // Make the request
    const [response] = await client.synthesizeSpeech(request);
    
    // Ensure the directory exists
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    
    // Write the audio file
    await fs.writeFile(outputPath, response.audioContent);
    
    console.log(`Audio file generated successfully: ${outputPath}`);
    return true;
  } catch (error) {
    console.error('Error generating audio with Google TTS:', error);
    return false;
  }
}

/**
 * Generate a medical dialogue using OpenAI API
 * @param {string} scenario - Medical scenario (e.g., 'cough', 'headache')
 * @returns {Promise<Array>} - Array of dialogue objects with speaker and text properties
 */
async function generateOpenAIDialogue(scenario) {
  if (!OPENAI_API_KEY) {
    console.log('OpenAI API key not found, skipping dialogue generation');
    return null;
  }
  
  try {
    console.log(`Generating dialogue using OpenAI API for scenario: ${scenario}`);
    
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
        }
      }
    );
    
    const responseText = response.data.choices[0].message.content.trim();
    
    // Parse the JSON
    try {
      const dialogue = JSON.parse(responseText);
      
      // Validate dialogue format
      if (!Array.isArray(dialogue) || dialogue.length === 0) {
        throw new Error('Invalid dialogue format - not an array or empty array');
      }
      
      // Check if each item has speaker and text
      for (const item of dialogue) {
        if (!item.speaker || !item.text || 
            (item.speaker !== 'Clinician' && item.speaker !== 'Patient')) {
          throw new Error('Invalid dialogue format - missing or invalid speaker/text properties');
        }
      }
      
      console.log(`Successfully generated dialogue with ${dialogue.length} lines using OpenAI API`);
      return dialogue;
    } catch (parseError) {
      console.error('Error parsing OpenAI response as JSON:', parseError);
      console.log('Response text:', responseText);
      return null;
    }
  } catch (error) {
    console.error('Error generating dialogue with OpenAI API:', error.message);
    if (error.response) {
      console.error('API Error Details:', error.response.data);
    }
    return null;
  }
}

/**
 * Convert a dialogue array to speech with explicit speaker labels for transcription
 * @param {Array} dialogue - Array of dialogue objects with speaker and text properties
 * @param {string} outputPath - Path to save the audio file
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
async function dialogueToSpeech(dialogue, outputPath) {
  try {
    // Define voices for different speakers with the most extreme differentiation
    const voices = {
      'Clinician': {
        voiceName: 'en-US-Studio-O', // Most feminine voice
        ssmlGender: 'FEMALE',
        speakingRate: 0.95,
        pitch: 5.0 // Very high pitch
      },
      'Patient': {
        voiceName: 'en-US-Neural2-J', // Deepest male voice
        ssmlGender: 'MALE',
        speakingRate: 0.85, // Slower
        pitch: -10.0 // Extremely low pitch
      }
    };
    
    // Process each dialogue line
    console.log(`Converting dialogue with ${dialogue.length} lines to speech...`);
    
    // Create a temp directory
    const tempDir = path.join(dirname(outputPath), 'temp_audio');
    await fs.mkdir(tempDir, { recursive: true });
    
    // Add a pause for the start to ensure microphone activation
    const initialPausePath = path.join(tempDir, 'initial_pause.mp3');
    try {
      await execAsync(`ffmpeg -f lavfi -i anullsrc=r=24000:cl=mono -t 1.5 -q:a 9 -acodec libmp3lame "${initialPausePath}"`);
      console.log('Created initial silence');
    } catch (e) {
      console.warn('Could not create initial silence:', e.message);
    }
    
    // Generate individual audio files for each line
    const audioFiles = [initialPausePath]; 
    
    // Add an intro explaining the format
    const introPath = path.join(tempDir, 'intro.mp3');
    await textToSpeech(
      "In this recording, the clinician will be a female voice, and the patient will be a male voice.",
      introPath,
      {
        voiceName: 'en-US-Neural2-C',
        ssmlGender: 'NEUTRAL',
        speakingRate: 0.9
      }
    );
    audioFiles.push(introPath);
    
    // Generate audio for each line with speaker labels formatted with commas
    // to match the transcript output
    for (let i = 0; i < dialogue.length; i++) {
      const line = dialogue[i];
      const speaker = line.speaker || 'Narrator';
      let text = line.text || '';
      
      // Skip empty lines
      if (!text.trim()) {
        continue;
      }
      
      // Explicitly add speaker label with comma to match transcript format
      text = `${speaker}, ${text}`;
      
      // Choose voice based on speaker
      const voice = voices[speaker] || voices['Clinician'];
      console.log(`Line ${i+1}: Using ${voice.voiceName} for ${speaker}: "${text}"`);
      
      // Generate file path for this line
      const lineAudioPath = path.join(tempDir, `line_${i.toString().padStart(3, '0')}.mp3`);
      
      // Generate audio for this line
      const success = await textToSpeech(
        text, 
        lineAudioPath, 
        voice
      );
      
      if (success) {
        audioFiles.push(lineAudioPath);
        console.log(`Generated audio for line ${i+1}/${dialogue.length}`);
        
        // Add pause between lines
        if (i < dialogue.length - 1) {
          const pausePath = path.join(tempDir, `pause_${i}.mp3`);
          try {
            await execAsync(`ffmpeg -f lavfi -i anullsrc=r=24000:cl=mono -t 0.7 -q:a 9 -acodec libmp3lame "${pausePath}"`);
            audioFiles.push(pausePath);
          } catch (e) {
            console.warn('Could not create pause:', e.message);
          }
        }
      } else {
        console.error(`Failed to generate audio for line ${i+1}`);
      }
    }
    
    // If we have audio files, combine them
    if (audioFiles.length > 0) {
      console.log(`Combining ${audioFiles.length} audio files...`);
      
      // Create a file list for ffmpeg
      const fileListPath = path.join(tempDir, 'filelist.txt');
      const fileListContent = audioFiles.map(file => 
        `file '${file.replace(/'/g, "'\\''")}'`
      ).join('\n');
      
      await fs.writeFile(fileListPath, fileListContent);
      
      // Use ffmpeg to concatenate the files
      try {
        // Make sure the output directory exists
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        
        // Run ffmpeg to concatenate all audio files
        const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c copy "${outputPath}"`;
        console.log(`Executing: ${ffmpegCommand}`);
        
        const { stdout, stderr } = await execAsync(ffmpegCommand);
        if (stderr) {
          console.log('ffmpeg stderr:', stderr);
        }
        
        console.log(`Combined audio file created at: ${outputPath}`);
        return true;
      } catch (ffmpegError) {
        console.error('Error executing ffmpeg:', ffmpegError);
        
        // Fallback if ffmpeg fails: just copy the audio files sequentially
        console.log('Falling back to sequential copying...');
        
        try {
          // Create an empty file
          await fs.writeFile(outputPath, Buffer.alloc(0));
          
          // Append each audio file one by one
          for (const audioFile of audioFiles) {
            const audioContent = await fs.readFile(audioFile);
            await fs.appendFile(outputPath, audioContent);
          }
          
          console.log(`Audio file created using fallback method at: ${outputPath}`);
          return true;
        } catch (fallbackError) {
          console.error('Error in fallback audio combining:', fallbackError);
          return false;
        }
      }
    } else {
      console.error('No audio files were generated');
      return false;
    }
  } catch (error) {
    console.error('Error in dialogueToSpeech:', error);
    return false;
  }
}

/**
 * Get dialogue for a specific scenario
 * @param {string} scenario - Scenario name
 * @param {boolean} forceRefresh - Whether to force refresh the dialogue
 * @returns {Promise<Array>} - Array of dialogue objects with speaker and text properties
 */
async function getDialogue(scenario, forceRefresh = false) {
  try {
    console.log(`Getting dialogue for scenario: ${scenario}`);
    
    // Define path for cached dialogue
    const dialogueFileName = `dialogue_${scenario}.json`;
    const dialoguePath = path.join(process.cwd(), 'temp', dialogueFileName);
    
    // Check if cached dialogue exists and forceRefresh is false
    if (!forceRefresh) {
      try {
        const fileExists = await fs.access(dialoguePath).then(() => true).catch(() => false);
        if (fileExists) {
          console.log(`Using cached dialogue from ${dialoguePath}`);
          const dialogueData = await fs.readFile(dialoguePath, 'utf8');
          return JSON.parse(dialogueData);
        }
      } catch (error) {
        console.log(`No cached dialogue found or error reading cache: ${error.message}`);
      }
    }
    
    // Try to generate dialogue using OpenAI API
    const openAIDialogue = await generateOpenAIDialogue(scenario);
    
    // Get the dialogue (either from OpenAI or from sample dialogues)
    const dialogue = openAIDialogue || (sampleDialogues[scenario] || sampleDialogues['cough']);
    
    if (dialogue.length === 0) {
      console.log(`No dialogue found for scenario: ${scenario}`);
      return [];
    }
    
    // Create directory if it doesn't exist
    await fs.mkdir(path.dirname(dialoguePath), { recursive: true });
    
    // Cache the dialogue
    await fs.writeFile(dialoguePath, JSON.stringify(dialogue, null, 2));
    console.log(`Dialogue cached to ${dialoguePath}`);
    
    return dialogue;
  } catch (error) {
    console.error('Error getting dialogue:', error);
    // Fall back to sample dialogues on error
    return sampleDialogues[scenario] || sampleDialogues['cough'];
  }
}

/**
 * Generate audio file for a dialogue scenario
 * @param {string} scenario - Scenario name
 * @param {string} outputPath - Path to save the audio file
 * @param {boolean} forceRefresh - Whether to force refresh
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
async function generateDialogueAudio(scenario, outputPath, forceRefresh = false) {
  try {
    // Get dialogue for the scenario
    const dialogue = await getDialogue(scenario, forceRefresh);
    
    if (!dialogue || dialogue.length === 0) {
      console.error(`No dialogue found for scenario: ${scenario}`);
      return false;
    }
    
    // Generate audio using dialogueToSpeech
    return await dialogueToSpeech(dialogue, outputPath);
  } catch (error) {
    console.error('Error generating dialogue audio:', error);
    return false;
  }
}

export {
  textToSpeech,
  dialogueToSpeech,
  getDialogue,
  generateDialogueAudio
};