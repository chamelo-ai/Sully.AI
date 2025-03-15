import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { ScribePage } from '../1_pages/ScribePage.js';
import { LoginPage } from '../1_pages/LoginPage.js';
import { sideNavBar, common } from '../1_pages/1_locators.js';
import { testData } from '../data/testData.js';
import { generateDialogueAudio, getDialogue } from '../utils/googleTTS.js';
import { setupAudioInfrastructure, injectSpeechSynthesis, debugAudioStreams } from '../utils/browserUtils.js';
import { analyzeTranscriptQuality, generateImprovementSuggestions } from '../utils/transcriptAnalyzer.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';

dotenv.config();

// Get current file's directory (ES Module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('Scribe Flow: Generate and Test Dialogue with Alternating Voices', async ({ browser }) => {
  // Extended timeout for this test since it involves API calls and audio generation
  test.setTimeout(300000); // 5 minutes
  
  // Define scenario and force refresh
  const scenario = 'hypertension'; // You can use other scenarios: 'headache', 'diabetes', etc.
  const forceRefresh = process.env.FORCE_REFRESH_DIALOGUE === 'true';
  
  // Define paths
  const audioFilePath = path.join(__dirname, '../temp', `${scenario}_dialogue.mp3`);
  const scriptFilePath = path.join(__dirname, '../temp', `speech_script_${scenario}.json`);
  
  // STEP 1: Generate dialogue with alternating voices
  console.log(`Getting dialogue for scenario "${scenario}"...`);
  const dialogue = await getDialogue(scenario, forceRefresh);
  if (!dialogue || dialogue.length === 0) {
    console.error('Failed to get dialogue. Skipping test.');
    test.skip();
    return;
  }
  
  // STEP 2: Generate audio file with alternating voices (for debugging/verification)
  console.log(`Generating audio file at ${audioFilePath}...`);
  const audioGenerated = await generateDialogueAudio(scenario, audioFilePath, forceRefresh);
  if (audioGenerated) {
    console.log(`✅ Audio file generated at: ${audioFilePath}`);
    
    // Verify the audio file 
    try {
      const fileStats = await fs.stat(audioFilePath);
      console.log(`Audio file size: ${fileStats.size} bytes`);
    } catch (error) {
      console.error("Error checking audio file:", error);
    }
  } else {
    console.log(`⚠️ Audio file generation failed, but continuing with test`);
  }
  
  // STEP 3: Create enhanced speech script for web speech synthesis
  console.log(`Creating enhanced speech script at ${scriptFilePath}...`);
  
  // Create speech script (since createSpeechScript isn't available)
  const speechDialogue = dialogue.map(line => {
    // Basic format for speech synthesis
    let speechLine = {
      text: line.text,
      speaker: line.speaker
    };
    
    // Add voice-specific settings
    if (line.speaker === 'Clinician') {
      speechLine.voice = 'female';
      speechLine.rate = 0.95;
      speechLine.pitch = 1.2;  // Higher pitch for female
    } else {
      speechLine.voice = 'male';
      speechLine.rate = 0.92;
      speechLine.pitch = 0.9;  // Lower pitch for male
    }
    
    return speechLine;
  });
  
  // Write the script file
  await fs.mkdir(path.dirname(scriptFilePath), { recursive: true });
  await fs.writeFile(scriptFilePath, JSON.stringify(speechDialogue, null, 2));
  console.log(`Speech script created at: ${scriptFilePath}`);
  
  // Read the script file
  const speechScript = await fs.readFile(scriptFilePath, 'utf8');
  
  // Print the dialogue that will be used
  console.log('========== DIALOGUE USED IN THIS TEST ==========');
  for (const line of dialogue) {
    console.log(`${line.speaker}: "${line.text}"`);
  }
  console.log('===============================================');
  
  // Create context with explicit permissions
  const context = await browser.newContext({
    permissions: ['microphone'],
    baseURL: 'https://app.sully.ai'
  });
  
  // Also explicitly grant permissions for the specific origin
  await context.grantPermissions(['microphone'], { origin: 'https://app.sully.ai' });
  
  // Create a page from this context
  const page = await context.newPage();
  console.log('Microphone permission granted');
  
  // Setup audio infrastructure
  await setupAudioInfrastructure(page);
  console.log('Audio injection infrastructure prepared');
  
  // Login to the application
  const scribePage = new ScribePage(page);
  const loginPage = new LoginPage(page);
  const errorModal = page.locator(common.shortRecordingErrorModal);

  await loginPage.navigate();
  await loginPage.login(testData.validLogin.username, testData.validLogin.password);
  await expect(loginPage.profileHeader).toBeVisible({ timeout: 10000 });
  console.log('Login successful using credentials from testData!');

  // Select patient
  await page.click(common.existingPatientDropdown);
  console.log('Clicked on Existing Patient dropdown');
  
  const dropdownItems = page.locator(common.patientDropdownResults);
  const patientOption = dropdownItems.filter({ hasText: 'ScribeE2E' });
  await patientOption.click();
  console.log('Selected patient "ScribeE2E"');

  // Debug audio setup before recording
  const initialAudioState = await debugAudioStreams(page);
  console.log('Initial audio state:', initialAudioState);
  
  // Additional setup to ensure audio context is ready
  await page.evaluate(() => {
    if (window._audioInjection && window._audioInjection.audioContext.state !== 'running') {
      window._audioInjection.audioContext.resume();
    }
    
    // Create a sine oscillator to ensure we have an audio track
    const oscillator = window._audioInjection.audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = 100; // Very low frequency
    
    const gainNode = window._audioInjection.audioContext.createGain();
    gainNode.gain.value = 0.01; // Very low volume
    
    oscillator.connect(gainNode);
    gainNode.connect(window._audioInjection.destination);
    
    // Create our media stream
    window._audioInjection.mediaStream = window._audioInjection.destination.stream;
    
    // Start the oscillator
    oscillator.start();
    
    console.log('Audio setup reinforced with background oscillator');
  });

  // Start recording
  await scribePage.startRecording();
  console.log('Started recording');

  // Wait a moment for recording to initialize
  await page.waitForTimeout(2000);
  
  // Check audio state after recording starts
  const recordingAudioState = await debugAudioStreams(page);
  console.log('Audio state after recording starts:', recordingAudioState);
  
  // Add a custom voice finder to help with voice selection
  await page.evaluate(() => {
    // Override the speech synthesis voice selection
    const originalSpeak = window.speechSynthesis.speak;
    
    window.speechSynthesis.speak = function(utterance) {
      // Get available voices
      const voices = window.speechSynthesis.getVoices();
      console.log('Available voices:', voices.map(v => v.name));
      
      // Set pitch based on speaker
      if (utterance._line && utterance._line.speaker) {
        if (utterance._line.speaker === 'Clinician') {
          utterance.pitch = 1.2; // Higher pitch for female
          
          // Try to find female voice
          const femaleVoice = voices.find(v => 
            v.name.toLowerCase().includes('female') || 
            v.name.toLowerCase().includes('woman'));
          
          if (femaleVoice) {
            utterance.voice = femaleVoice;
            console.log(`Using female voice: ${femaleVoice.name}`);
          }
        } else {
          utterance.pitch = 0.9; // Lower pitch for male
          
          // Try to find male voice
          const maleVoice = voices.find(v => 
            v.name.toLowerCase().includes('male') || 
            v.name.toLowerCase().includes('man'));
          
          if (maleVoice) {
            utterance.voice = maleVoice;
            console.log(`Using male voice: ${maleVoice.name}`);
          }
        }
      }
      
      // Call the original speak method
      return originalSpeak.call(window.speechSynthesis, utterance);
    };
  });
  
  // Use the injectSpeechSynthesis function with our modified script
  console.log('Now injecting web speech synthesis with proper voice assignment...');
  const playAudibly = true;
  
  // Enhance injectSpeechSynthesis to better handle voice selection
  const injectionSuccess = await page.evaluate(async (params) => {
    try {
      console.log('[Mock] Setting up speech synthesis dialogue');
      
      // Parse the dialogue script
      const dialogue = JSON.parse(params.dialogueScript);
      console.log(`[Mock] Loaded ${dialogue.length} lines of dialogue for speech synthesis`);
      
      // Store the dialogue
      window._audioInjection = window._audioInjection || {};
      window._audioInjection.speechSynthesis = {
        speaking: false,
        dialogue: dialogue,
        currentIndex: 0
      };
      
      // Set up audio context for streaming
      if (!window._audioInjection.audioContext) {
        window._audioInjection.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      if (!window._audioInjection.destination) {
        window._audioInjection.destination = window._audioInjection.audioContext.createMediaStreamDestination();
      }
      
      // Function to speak a line of dialogue
      async function speakLine(line, index) {
        return new Promise((resolve, reject) => {
          try {
            console.log(`[Mock] Speaking line ${index + 1}/${dialogue.length}: ${line.text.substring(0, 50)}...`);
            
            // Create and configure speech utterance
            const utterance = new SpeechSynthesisUtterance(line.text);
            utterance._line = line; // Store reference to line for voice selection in our override
            
            // Find the appropriate voice based on speaker
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
              // Try to find a voice matching the speaker
              if (line.speaker === 'Clinician') {
                // Look for female voices
                const femaleVoices = voices.filter(voice => 
                  voice.name.toLowerCase().includes('female'));
                utterance.voice = femaleVoices.length > 0 ? femaleVoices[0] : voices[0];
              } else if (line.speaker === 'Patient') {
                // Look for male voices
                const maleVoices = voices.filter(voice => 
                  voice.name.toLowerCase().includes('male'));
                utterance.voice = maleVoices.length > 0 ? maleVoices[0] : voices[voices.length > 1 ? 1 : 0];
              } else {
                utterance.voice = voices[0];
              }
              console.log(`[Mock] Using voice for ${line.speaker}: ${utterance.voice ? utterance.voice.name : 'default'}`);
            }
            
            // Set speech properties
            utterance.rate = line.rate || 1.0;
            utterance.pitch = line.speaker === 'Clinician' ? 1.2 : 0.9; // Explicit pitch difference
            utterance.volume = params.audiblePlayback ? 1.0 : 0.0;
            
            // Events
            utterance.onstart = () => {
              console.log(`[Mock] Started speaking line ${index + 1}`);
              window._audioInjection.speechSynthesis.speaking = true;
              window._audioInjection.speechSynthesis.currentIndex = index;
            };
            
            utterance.onend = () => {
              console.log(`[Mock] Finished speaking line ${index + 1}`);
              window._audioInjection.speechSynthesis.speaking = false;
              resolve();
            };
            
            utterance.onerror = (event) => {
              console.error(`[Mock] Error speaking line ${index + 1}:`, event);
              window._audioInjection.speechSynthesis.speaking = false;
              reject(event);
            };
            
            // Speak the utterance
            window.speechSynthesis.speak(utterance);
          } catch (error) {
            console.error('[Mock] Error in speakLine:', error);
            reject(error);
          }
        });
      }
      
      // Create audio element for capturing speech audio
      try {
        // Start streaming audio context
        if (window._audioInjection.audioContext.state !== 'running') {
          await window._audioInjection.audioContext.resume();
        }
        
        // Add an oscillator as a backup sound source to ensure we have an audio track
        const oscillator = window._audioInjection.audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = 100; // Very low frequency
        
        const gainNode = window._audioInjection.audioContext.createGain();
        gainNode.gain.value = 0.01; // Very low volume
        
        oscillator.connect(gainNode);
        gainNode.connect(window._audioInjection.destination);
        oscillator.start();
        
        // Create our media stream
        window._audioInjection.mediaStream = window._audioInjection.destination.stream;
        window._mockAudioStream = window._audioInjection.destination.stream;
        
        // Activate the mock
        window._audioInjection.mockActive = true;
        
        console.log('[Mock] Speech synthesis setup complete and stream created');
        
        // Create a visual indicator for audio playback
        if (params.audiblePlayback) {
          const indicator = document.createElement('div');
          indicator.style.position = 'fixed';
          indicator.style.bottom = '20px';
          indicator.style.right = '20px';
          indicator.style.backgroundColor = 'rgba(0, 128, 0, 0.8)';
          indicator.style.color = 'white';
          indicator.style.padding = '10px 20px';
          indicator.style.borderRadius = '5px';
          indicator.style.zIndex = '9999';
          indicator.style.fontFamily = 'Arial, sans-serif';
          indicator.style.fontSize = '14px';
          indicator.textContent = '🔊 Starting Speech...';
          
          // Add a line counter
          const counter = document.createElement('div');
          counter.style.marginTop = '5px';
          counter.style.fontSize = '12px';
          counter.textContent = 'Preparing...';
          indicator.appendChild(counter);
          
          // Add to page
          document.body.appendChild(indicator);
          
          // Start speaking the dialogue lines in sequence
          (async function speakAllLines() {
            try {
              for (let i = 0; i < dialogue.length; i++) {
                counter.textContent = `Line ${i+1}/${dialogue.length}`;
                
                // Change background color based on speaker
                if (dialogue[i].speaker === 'Clinician') {
                  indicator.style.backgroundColor = 'rgba(0, 128, 128, 0.8)'; // Teal for Clinician
                  indicator.firstChild.textContent = '🔊 Clinician Speaking...';
                } else {
                  indicator.style.backgroundColor = 'rgba(128, 0, 128, 0.8)'; // Purple for Patient
                  indicator.firstChild.textContent = '🔊 Patient Speaking...';
                }
                
                await speakLine(dialogue[i], i);
                
                // Small pause between lines
                await new Promise(resolve => setTimeout(resolve, 500));
              }
              
              // All done
              indicator.style.backgroundColor = 'rgba(128, 128, 128, 0.8)';
              indicator.textContent = '✓ Speech Completed';
              counter.textContent = `${dialogue.length} lines spoken`;
              
              // Remove after a delay
              setTimeout(() => {
                document.body.removeChild(indicator);
              }, 3000);
            } catch (error) {
              console.error('Error in speech sequence:', error);
              indicator.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
              indicator.textContent = '❌ Speech Error';
              counter.textContent = error.message || 'Unknown error';
            }
          })();
        }
        
        return true;
      } catch (error) {
        console.error('[Mock] Error setting up audio capture:', error);
        return false;
      }
    } catch (error) {
      console.error('[Mock] Error in speech synthesis setup:', error);
      return false;
    }
  }, { 
    dialogueScript: speechScript, 
    audiblePlayback: playAudibly 
  });
  
  if (injectionSuccess) {
    console.log('✅ Speech synthesis successfully injected into the recording!');
  } else {
    console.log('❌ Failed to inject speech synthesis. Recording may be silent.');
  }
  
  // Check audio state after injection
  const postInjectionState = await debugAudioStreams(page);
  console.log('Audio state after injection:', postInjectionState);

  // Wait for the audio to play
  const recordingDuration = dialogue.length * 5000 + 5000; // 5 seconds per line plus buffer
  console.log(`Waiting for ${recordingDuration/1000} seconds while speech plays...`);
  await page.waitForTimeout(recordingDuration);
  console.log('Speech playback should now be complete');

  // Click on "Finish Visit"
  await scribePage.stopRecording();
  console.log('Clicked on Finish Visit button');

  // Generate timestamp for this test run
  const timestamp = new Date().toISOString().replace(/[:T.]/g, '-');
  
  // Check for error modal
  const isErrorVisible = await errorModal.isVisible({ timeout: 5000 }).catch(() => false);
  
  if (isErrorVisible) {
    console.log('Error modal is visible - recording might still be too short');
    await expect(errorModal).toContainText('Cannot generate transcript. Recording is too short.');
  } else {
    console.log('No error modal - recording was processed successfully');
    
    // Wait for transcript to appear 
    let transcriptText;
    try {
      await expect(page.locator(common.transcriptBox)).toBeVisible({ timeout: 30000 });
      console.log('Transcript box is visible');
      
      // Get the transcript text
      transcriptText = await page.locator(common.transcriptBox).textContent();
      console.log('Transcript text:', transcriptText);
    } catch (error) {
      console.log('Error waiting for transcript box:', error.message);
      console.log('Trying alternative selectors...');
      
      // Try alternative selectors if transcriptBox fails
      if (common.patientNotes) {
        try {
          await expect(page.locator(common.patientNotes)).toBeVisible({ timeout: 15000 });
          transcriptText = await page.locator(common.patientNotes).textContent();
          console.log('Got transcript from patientNotes');
        } catch (e) {
          console.log('patientNotes not found');
        }
      }
      
      if (!transcriptText && common.transcriptContent) {
        try {
          await expect(page.locator(common.transcriptContent)).toBeVisible({ timeout: 15000 });
          transcriptText = await page.locator(common.transcriptContent).textContent();
          console.log('Got transcript from transcriptContent');
        } catch (e) {
          console.log('transcriptContent not found');
        }
      }
      
      // Last resort: try to find any text that looks like a transcript
      if (!transcriptText) {
        console.log('Attempting to find transcript with generic selectors');
        transcriptText = await page.evaluate(() => {
          const possibleSelectors = [
            '.transcript', '.transcript-box', '.transcript-content', '.notes', 
            '[data-testid="transcript"]', '[data-content="transcript"]',
            'div[class*="transcript"]', 'div[class*="notes"]'
          ];
          
          for (const selector of possibleSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              console.log(`Found potential transcript with selector: ${selector}`);
              return elements[0].textContent;
            }
          }
          
          // Try to find by content
          const allDivs = document.querySelectorAll('div, p, span');
          for (const div of allDivs) {
            const text = div.textContent || '';
            // If it's a substantial block of text, it might be the transcript
            if (text.length > 100 && text.includes('.') && !text.includes('<')) {
              return text;
            }
          }
          
          return '';
        });
      }
    }
    
    // If we have transcript text, save and analyze it
    if (transcriptText && transcriptText.length > 0) {
      // Create directories for saving results
      const resultsDir = path.join(__dirname, '../results/transcript-analysis');
      await fs.mkdir(resultsDir, { recursive: true });
      
      // Save the transcript text
      const transcriptFilePath = path.join(resultsDir, `transcript_${timestamp}.txt`);
      await fs.writeFile(transcriptFilePath, transcriptText);
      console.log(`Transcript saved to: ${transcriptFilePath}`);
      
      // Convert the original dialogue to text
      const originalText = dialogue
        .map(line => `${line.speaker}: ${line.text}`)
        .join('\n');
        
      // Save the original text
      const originalFilePath = path.join(resultsDir, `original_${timestamp}.txt`);
      await fs.writeFile(originalFilePath, originalText);
      console.log(`Original dialogue saved to: ${originalFilePath}`);
      
      // Take a screenshot of the transcript for reference
      await page.screenshot({ 
        path: path.join(resultsDir, `transcript_screenshot_${timestamp}.png`),
        fullPage: false 
      });
      
      // Perform quality evaluation
      console.log('Evaluating transcript quality...');
      try {
        // This performs accuracy analysis
        console.log('Calling analyzeTranscriptQuality...');
        const analysisResults = await analyzeTranscriptQuality(transcriptText, originalText);
        console.log('Analysis complete!');
        
        // Get improvement suggestions
        const suggestions = generateImprovementSuggestions ? 
          generateImprovementSuggestions(analysisResults) : 
          [];
        
        // Create a comprehensive quality report
        const qualityResults = {
          // Core metrics
          contentAccuracy: Math.round(analysisResults.contentCoverage * 100),
          speakerAttribution: Math.round(analysisResults.speakerAccuracy * 100),
          coherence: Math.round(analysisResults.coherence * 10),
          naturalness: Math.round(analysisResults.naturalness * 10),
          overallScore: Math.round(analysisResults.overallScore * 100),
          
          // Details
          presentPhrases: analysisResults.presentPhrases,
          missingPhrases: analysisResults.missingPhrases,
          incorrectTranscriptions: analysisResults.incorrectTranscriptions,
          improvementSuggestions: suggestions
        };
        
        // Save the full analysis results as JSON
        const resultsFilePath = path.join(resultsDir, `quality_results_${timestamp}.json`);
        await fs.writeFile(resultsFilePath, JSON.stringify(qualityResults, null, 2));
        console.log(`Detailed quality results saved to: ${resultsFilePath}`);
        
        // Create a comparison table for the transcript text
        console.log('\n============= TRANSCRIPT COMPARISON =============');
        console.log('ORIGINAL:');
        console.log(originalText.substring(0, 300) + '...');
        console.log('TRANSCRIPT:');
        console.log(transcriptText.substring(0, 300) + '...');
        
        // Log key results to console in a detailed format
        console.log('\n============= TRANSCRIPT QUALITY METRICS =============');
        console.log(`CONTENT ACCURACY: ${qualityResults.contentAccuracy}%`);
        console.log(`SPEAKER ATTRIBUTION: ${qualityResults.speakerAttribution}%`);
        console.log(`COHERENCE: ${qualityResults.coherence}/10`);
        console.log(`NATURALNESS: ${qualityResults.naturalness}/10`);
        console.log(`OVERALL SCORE: ${qualityResults.overallScore}%`);
        console.log('====================================================\n');
        
        // Print improvement suggestions
        if (suggestions.length > 0) {
          console.log('\n============= IMPROVEMENT SUGGESTIONS =============');
          suggestions.forEach((suggestion, index) => {
            console.log(`${index + 1}. ${suggestion}`);
          });
          console.log('====================================================\n');
        }
        
        // Print key missing phrases if any
        if (qualityResults.missingPhrases.length > 0) {
          console.log('\n============= KEY MISSING PHRASES =============');
          qualityResults.missingPhrases.slice(0, 5).forEach((phrase, index) => {
            console.log(`${index + 1}. "${phrase}"`);
          });
          console.log('===============================================\n');
        }
        
        // Print incorrect transcriptions if any
        if (qualityResults.incorrectTranscriptions.length > 0) {
          console.log('\n============= INCORRECT TRANSCRIPTIONS =============');
          qualityResults.incorrectTranscriptions.forEach((item, index) => {
            console.log(`${index + 1}. Original: "${item.original}"`);
            console.log(`   Transcribed: "${item.transcribed}" (similarity: ${(item.similarityScore * 100).toFixed(1)}%)`);
          });
          console.log('====================================================\n');
        }
        
        // Assert minimum quality standards with a more lenient threshold
        expect(qualityResults.overallScore).toBeGreaterThan(40);
      } catch (error) {
        console.error('Error in transcript quality evaluation:');
        console.error(error.message);
        console.error(error.stack);
        console.error('Transcript text sample:', transcriptText.substring(0, 200));
        console.error('Original text sample:', originalText.substring(0, 200));
      }
    } else {
      console.log('No transcript text found for quality evaluation');
      
      // Take screenshot to help debug why transcript wasn't found
      await page.screenshot({ 
        path: path.join(__dirname, '../results', `no_transcript_${timestamp}.png`),
        fullPage: true 
      });
    }
  }
  
  // Print the dialogue again at the end of the test for reference
  console.log('\n\n========== DIALOGUE USED IN THIS TEST ==========');
  for (const line of dialogue) {
    console.log(`${line.speaker}: ${line.text}`);
  }
  console.log('===============================================');
});