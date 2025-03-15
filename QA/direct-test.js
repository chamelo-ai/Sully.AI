/**
 * Simple test script to generate dialogue audio directly
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { generateDialogueAudio } from './utils/googleTTS.js';

// Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runTest() {
  console.log('Starting direct dialogue audio generation test...');
  
  // Define scenario and output path
  const scenario = 'headache';
  const outputPath = path.join(__dirname, 'output', `${scenario}_dialogue.mp3`);
  
  // Generate the audio file
  console.log(`Generating audio for scenario: ${scenario}`);
  console.log(`Output will be saved to: ${outputPath}`);
  
  const success = await generateDialogueAudio(scenario, outputPath, true);
  
  if (success) {
    console.log('✅ Audio generated successfully!');
  } else {
    console.error('❌ Failed to generate audio');
  }
}

// Run the test
runTest();