/**
 * Browser and Playwright utility functions
 */

/**
 * Create a browser context with microphone permissions
 * @param {Browser} browser - Playwright browser instance
 * @param {string} baseURL - Base URL for the context
 * @returns {Promise<BrowserContext>} - The created browser context
 */
async function createContextWithMicPermission(browser, baseURL = 'https://app.sully.ai') {
  const context = await browser.newContext({
    permissions: ['microphone'],
    baseURL
  });
  
  // Also explicitly grant permissions for the specific origin
  await context.grantPermissions(['microphone'], { origin: baseURL });
  
  return context;
}

/**
 * Set up the audio mocking infrastructure but don't activate it yet
 * @param {Page} page - Playwright page instance
 * @returns {Promise<void>}
 */
async function setupAudioInfrastructure(page) {
  // First, prepare the page with the audio injection functionality
  await page.addInitScript(() => {
    window._audioInjection = {
      originalGetUserMedia: null,
      mockActive: false,
      audioElement: null,
      mediaStream: null,
      audioContext: new (window.AudioContext || window.webkitAudioContext)(),
      speechSynthesis: {
        speaking: false,
        dialogue: null,
        currentIndex: 0
      }
    };
    
    // Create a destination for our audio
    window._audioInjection.destination = window._audioInjection.audioContext.createMediaStreamDestination();
    
    // Store the original getUserMedia
    window._audioInjection.originalGetUserMedia = navigator.mediaDevices.getUserMedia;
    
    // Setup permission API override
    if (navigator.permissions && navigator.permissions.query) {
      const originalQuery = navigator.permissions.query;
      navigator.permissions.query = function(permissionDesc) {
        if (permissionDesc.name === 'microphone') {
          console.log('[Mock] Permission query for microphone, returning granted');
          return Promise.resolve({
            state: 'granted',
            addEventListener: () => {},
            removeEventListener: () => {},
            onchange: null
          });
        }
        return originalQuery.call(navigator.permissions, permissionDesc);
      };
    }
    
    // Override getUserMedia to use our switching logic
    navigator.mediaDevices.getUserMedia = async function(constraints) {
      console.log('[Mock] getUserMedia called with constraints:', JSON.stringify(constraints));
      
      if (constraints && constraints.audio) {
        if (window._audioInjection.mockActive && window._audioInjection.mediaStream) {
          console.log('[Mock] Returning mock audio stream');
          return window._audioInjection.mediaStream;
        } else {
          console.log('[Mock] Mock not active yet, returning real microphone');
          return window._audioInjection.originalGetUserMedia.call(navigator.mediaDevices, constraints);
        }
      } else {
        // For non-audio requests, use original implementation
        return window._audioInjection.originalGetUserMedia.call(navigator.mediaDevices, constraints);
      }
    };
    
    console.log('[Mock] Audio infrastructure setup complete');
  });
  
  console.log('Audio injection infrastructure prepared');
}

/**
 * Inject speech synthesis dialogue for playback after recording has started
 * @param {Page} page - Playwright page instance
 * @param {string} dialogueScript - JSON string of dialogue script 
 * @param {boolean} audiblePlayback - Whether to play audio through speakers
 * @returns {Promise<boolean>} - Whether the injection was successful
 */
async function injectSpeechSynthesis(page, dialogueScript, audiblePlayback = true) {
  console.log(`Injecting speech synthesis with ${dialogueScript.length} characters of dialogue script`);
  
  const success = await page.evaluate(async (params) => {
    try {
      console.log('[Mock] Setting up speech synthesis dialogue');
      
      // Parse the dialogue script
      const dialogue = JSON.parse(params.dialogueScript);
      console.log(`[Mock] Loaded ${dialogue.length} lines of dialogue for speech synthesis`);
      
      // Store the dialogue
      window._audioInjection.speechSynthesis.dialogue = dialogue;
      
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
                utterance.voice = maleVoices.length > 0 ? maleVoices[0] : voices[0];
              } else {
                utterance.voice = voices[0];
              }
              console.log(`[Mock] Using voice for ${line.speaker}: ${utterance.voice.name}`);
            }
            
            // Set speech properties
            utterance.rate = line.rate || 1.0;
            utterance.pitch = line.pitch || 1.0;
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
                indicator.style.backgroundColor = dialogue[i].speaker === 'Clinician' ? 
                  'rgba(0, 128, 128, 0.8)' : 'rgba(128, 0, 128, 0.8)';
                indicator.firstChild.textContent = `🔊 ${dialogue[i].speaker} Speaking...`;
                
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
    dialogueScript, 
    audiblePlayback 
  });
  
  return success;
}

/**
 * Inject an audio file into the recording
 * Enhanced for better audio capture
 * @param {Page} page - Playwright page object
 * @param {string} audioFilePath - Path to the audio file to inject
 * @param {boolean} playAudibly - Whether to play the audio audibly (for debugging)
 * @returns {Promise<boolean>} - Whether injection was successful
 */
async function injectAudioFile(page, audioFilePath, playAudibly = true) {
  console.log(`Injecting audio file: ${audioFilePath}`);
  
  // First we need to read the file and convert it to a base64 string to pass to the browser
  const fs = await import('fs/promises');
  try {
    // Verify the file exists
    try {
      const stats = await fs.stat(audioFilePath);
      console.log(`Audio file exists with size: ${stats.size} bytes`);
    } catch (err) {
      console.error(`Audio file not found: ${audioFilePath}`);
      return false;
    }
    
    const audioBuffer = await fs.readFile(audioFilePath);
    const base64Audio = audioBuffer.toString('base64');
    
    // Ensure the audio injection infrastructure exists
    const infraResult = await page.evaluate(() => {
      // Create audio infrastructure if it doesn't exist
      if (!window._audioInjection) {
        console.log('Creating audio injection infrastructure');
        window._audioInjection = {};
      }
      
      // Create audio context if needed
      if (!window._audioInjection.audioContext) {
        window._audioInjection.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // Create destination if needed  
      if (!window._audioInjection.destination) {
        window._audioInjection.destination = window._audioInjection.audioContext.createMediaStreamDestination();
      }
      
      // Store original getUserMedia if needed
      if (!window._audioInjection.originalGetUserMedia) {
        window._audioInjection.originalGetUserMedia = navigator.mediaDevices.getUserMedia;
      }
      
      // Return status
      return {
        contextState: window._audioInjection.audioContext.state,
        hasDestination: !!window._audioInjection.destination,
        hasOriginalGetUserMedia: !!window._audioInjection.originalGetUserMedia
      };
    });
    
    console.log('Audio infrastructure status:', infraResult);
    
    // Now inject and play the audio in the browser context
    return await page.evaluate(
      async ({ base64Audio, playAudibly }) => {
        try {
          console.log('Injecting audio file...');
          
          // Resume audio context if it's suspended
          if (window._audioInjection.audioContext.state !== 'running') {
            console.log('Resuming audio context...');
            await window._audioInjection.audioContext.resume();
          }
          
          // Convert base64 to an ArrayBuffer
          const binaryString = window.atob(base64Audio);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          // Add a background oscillator to ensure we have an audio track
          console.log('Adding background oscillator...');
          const oscillator = window._audioInjection.audioContext.createOscillator();
          oscillator.type = 'sine';
          oscillator.frequency.value = 50; // Very low frequency
          
          const gainNode = window._audioInjection.audioContext.createGain();
          gainNode.gain.value = 0.01; // Very low volume
          
          oscillator.connect(gainNode);
          gainNode.connect(window._audioInjection.destination);
          oscillator.start();
          
          // Decode the audio data
          console.log('Decoding audio data...');
          const audioBuffer = await window._audioInjection.audioContext.decodeAudioData(bytes.buffer);
          console.log('Audio decoded successfully, duration:', audioBuffer.duration);
          
          // Create a new source node for the audio file
          const source = window._audioInjection.audioContext.createBufferSource();
          source.buffer = audioBuffer;
          
          // Connect to output if we want to hear it
          if (playAudibly) {
            console.log('Connecting to destination for audible playback');
            source.connect(window._audioInjection.audioContext.destination);
          }
          
          // Connect to the recording destination
          console.log('Connecting to recording destination');
          source.connect(window._audioInjection.destination);
          
          // Create our media stream
          window._audioInjection.mediaStream = window._audioInjection.destination.stream;
          
          // Override getUserMedia to use our stream
          console.log('Setting up media stream injection...');
          navigator.mediaDevices.getUserMedia = async function(constraints) {
            console.log('[Mock] getUserMedia called with constraints:', JSON.stringify(constraints));
            
            if (constraints && constraints.audio) {
              console.log('[Mock] Returning mock audio stream');
              return window._audioInjection.mediaStream;
            } else {
              console.log('[Mock] Calling original getUserMedia');
              return window._audioInjection.originalGetUserMedia.call(navigator.mediaDevices, constraints);
            }
          };
          
          // Activate the mock
          window._audioInjection.mockActive = true;
          
          // Visual indicator
          if (playAudibly) {
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
            indicator.textContent = '🔊 Playing Audio File...';
            document.body.appendChild(indicator);
            
            // Update when finished
            source.onended = () => {
              indicator.style.backgroundColor = 'rgba(128, 128, 128, 0.8)';
              indicator.textContent = '✓ Audio Playback Completed';
              setTimeout(() => {
                document.body.removeChild(indicator);
              }, 3000);
            };
          }
          
          // Add error handling
          source.onerror = (error) => {
            console.error('Audio playback error:', error);
          };
          
          // Start playing the audio
          console.log('Starting audio playback');
          source.start(0);
          
          // Return success
          return true;
        } catch (error) {
          console.error('Error in audio file injection:', error);
          console.error(error.stack);
          return false;
        }
      },
      { base64Audio, playAudibly }
    );
  } catch (error) {
    console.error('Error reading audio file:', error);
    return false;
  }
}

/**
 * Wait for element and take a screenshot if it's not found
 * @param {Page} page - Playwright page
 * @param {string} selector - Element selector
 * @param {Object} options - Additional options (timeout, etc.)
 * @returns {Promise<ElementHandle>} - The found element
 */
async function waitForElementWithScreenshot(page, selector, options = {}) {
  try {
    return await page.waitForSelector(selector, options);
  } catch (error) {
    // Take screenshot on failure
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await page.screenshot({ 
      path: `./results/error-${timestamp}.png`,
      fullPage: true 
    });
    throw error;
  }
}

/**
 * Debug audio streams to help diagnose issues
 * @param {Page} page - Playwright page
 * @returns {Promise<Object>} - Debug information about the audio streams
 */
async function debugAudioStreams(page) {
  return await page.evaluate(() => {
    if (!window._audioInjection) {
      return { error: 'Audio injection not initialized' };
    }
    
    return {
      mockActive: window._audioInjection.mockActive,
      hasMediaStream: !!window._audioInjection.mediaStream,
      trackCount: window._audioInjection.mediaStream ? 
        window._audioInjection.mediaStream.getAudioTracks().length : 0,
      trackEnabled: window._audioInjection.mediaStream && 
        window._audioInjection.mediaStream.getAudioTracks().length > 0 ? 
        window._audioInjection.mediaStream.getAudioTracks()[0].enabled : false,
      contextState: window._audioInjection.audioContext ? 
        window._audioInjection.audioContext.state : 'unknown'
    };
  });
}

export {
  createContextWithMicPermission,
  setupAudioInfrastructure,
  injectSpeechSynthesis,
  injectAudioFile,
  waitForElementWithScreenshot,
  debugAudioStreams
};