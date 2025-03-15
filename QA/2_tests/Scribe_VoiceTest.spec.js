import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getDialogue, createSpeechScript } from '../utils/googleTTS.js';
import fs from 'fs/promises';

// Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('Test Web Speech Synthesis with Distinct Voices', async ({ page }) => {
  // Get a simple dialogue
  const dialogue = [
    { speaker: 'Clinician', text: 'Hello, what brings you in today?' },
    { speaker: 'Patient', text: 'I have been having a persistent cough.' },
    { speaker: 'Clinician', text: 'How long has this been going on?' },
    { speaker: 'Patient', text: 'About two weeks now.' },
  ];
  
  // Create a speech script
  const scriptPath = path.join(__dirname, '../temp', 'voice_test_script.json');
  await createSpeechScript(dialogue, scriptPath);
  
  // Read the script
  const script = await fs.readFile(scriptPath, 'utf8');
  
  // Navigate to a blank page
  await page.goto('about:blank');
  
  // Add a visual element to show the current speaker
  await page.evaluate(() => {
    const indicator = document.createElement('div');
    indicator.id = 'speakerIndicator';
    indicator.style.position = 'fixed';
    indicator.style.top = '20px';
    indicator.style.left = '20px';
    indicator.style.padding = '20px';
    indicator.style.backgroundColor = 'lightgray';
    indicator.style.fontSize = '24px';
    indicator.style.fontFamily = 'Arial, sans-serif';
    indicator.textContent = 'Ready to test voices...';
    document.body.appendChild(indicator);
  });
  
  // Test the voices
  await page.evaluate(async (scriptData) => {
    const data = JSON.parse(scriptData);
    const dialogue = data.dialogue;
    
    // Get all available voices
    const voices = window.speechSynthesis.getVoices();
    console.log('Available voices:', voices.map(v => v.name));
    
    // Function to find the best voice
    function findVoice(speakerType) {
      // Strategy 1: Look for voices with 'male' or 'female' in the name
      const genderVoices = voices.filter(v => 
        v.name.toLowerCase().includes(speakerType.toLowerCase())
      );
      
      if (genderVoices.length > 0) return genderVoices[0];
      
      // Strategy 2: Use voice URI patterns
      const uriVoices = voices.filter(v => 
        v.voiceURI.toLowerCase().includes(speakerType.toLowerCase())
      );
      
      if (uriVoices.length > 0) return uriVoices[0];
      
      // Strategy 3: For English voices, use default voices
      const englishVoices = voices.filter(v => v.lang.startsWith('en'));
      
      // Choose different voices for different speakers
      if (speakerType === 'female') {
        return englishVoices[0] || voices[0];
      } else {
        return englishVoices[englishVoices.length > 1 ? 1 : 0] || 
               voices[voices.length > 1 ? 1 : 0];
      }
    }
    
    // Find distinct voices
    const femaleVoice = findVoice('female');
    const maleVoice = findVoice('male');
    
    console.log('Selected female voice:', femaleVoice.name);
    console.log('Selected male voice:', maleVoice.name);
    
    // Display the voices
    const indicator = document.getElementById('speakerIndicator');
    indicator.innerHTML = `Female Voice: ${femaleVoice.name}<br>Male Voice: ${maleVoice.name}`;
    
    // Speak each line with appropriate voice
    const speakLine = (line) => {
      return new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(line.text);
        
        // Set voice based on speaker
        utterance.voice = line.speaker === 'Clinician' ? femaleVoice : maleVoice;
        
        // Adjust pitch and rate
        utterance.pitch = line.speaker === 'Clinician' ? 1.2 : 0.9;
        utterance.rate = line.speaker === 'Clinician' ? 0.95 : 0.92;
        
        // Update the indicator
        indicator.style.backgroundColor = line.speaker === 'Clinician' ? 
          'lightpink' : 'lightblue';
        indicator.textContent = `${line.speaker} (${utterance.voice.name}): "${line.text}"`;
        
        // Set up events
        utterance.onend = () => {
          console.log(`Finished speaking: ${line.text}`);
          resolve();
        };
        
        // Speak
        window.speechSynthesis.speak(utterance);
      });
    };
    
    // Speak each line in sequence
    for (const line of dialogue) {
      await speakLine(line);
      // Pause between lines
      await new Promise(r => setTimeout(r, 500));
    }
    
    indicator.style.backgroundColor = 'lightgreen';
    indicator.textContent = 'Voice test complete!';
  }, script);
  
  // Wait for the test to complete
  await page.waitForTimeout(10000);
});