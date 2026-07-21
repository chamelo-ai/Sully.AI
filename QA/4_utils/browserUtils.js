/**
 * Browser utility functions for Scribe application tests
 */

import { common } from '../1_pages/1_locators.js';
import fs from 'fs/promises';

/**
 * Create a browser context with microphone permissions
 */
export async function createContextWithMicPermission(browser, baseURL = 'https://app.sully.ai') {
  const context = await browser.newContext({
    permissions: ['microphone'],
    baseURL
  });
  await context.grantPermissions(['microphone'], { origin: baseURL });
  return context;
}

/**
 * Set up the audio mocking infrastructure
 */
export async function setupAudioInfrastructure(page) {
  await page.addInitScript(() => {
    window._audioInjection = {
      originalGetUserMedia: navigator.mediaDevices.getUserMedia,
      mockActive: false,
      mediaStream: null,
      audioContext: new (window.AudioContext || window.webkitAudioContext)(),
      speechSynthesis: { speaking: false, dialogue: null, currentIndex: 0 }
    };
    
    window._audioInjection.destination = window._audioInjection.audioContext.createMediaStreamDestination();
    
    if (navigator.permissions?.query) {
      const originalQuery = navigator.permissions.query;
      navigator.permissions.query = function(permissionDesc) {
        if (permissionDesc.name === 'microphone') {
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
    
    navigator.mediaDevices.getUserMedia = async function(constraints) {
      if (constraints?.audio && window._audioInjection.mockActive && window._audioInjection.mediaStream) {
        return window._audioInjection.mediaStream;
      } 
      return window._audioInjection.originalGetUserMedia.call(navigator.mediaDevices, constraints);
    };
  });
  
  console.log('Audio injection infrastructure prepared');
}

/**
 * Pre-activate the mock microphone stream so that getUserMedia returns the
 * synthetic stream the moment Sully's app calls it (before startRecording).
 * Must be called after setupAudioInfrastructure and after the page has loaded.
 */
export async function activateMockMicrophone(page) {
  await page.evaluate(async () => {
    if (!window._audioInjection) {
      console.warn('[Mock] Audio injection not initialized — cannot activate mock mic');
      return;
    }

    if (window._audioInjection.audioContext.state !== 'running') {
      await window._audioInjection.audioContext.resume();
    }

    const oscillator = window._audioInjection.audioContext.createOscillator();
    oscillator.frequency.value = 0;
    const gainNode = window._audioInjection.audioContext.createGain();
    gainNode.gain.value = 0;
    oscillator.connect(gainNode);
    gainNode.connect(window._audioInjection.destination);
    oscillator.start();

    window._audioInjection.mediaStream = window._audioInjection.destination.stream;
    window._audioInjection.mockActive = true;
    console.log('[Mock] Mock microphone pre-activated');
  });
  console.log('Mock microphone pre-activated before recording');
}

/**
 * Route a local audio file through the mock AudioContext so Sully's recording
 * actually hears speech instead of silence.
 *
 * Call this AFTER activateMockMicrophone() and startRecording().
 * Returns the audio duration in seconds.
 */
export async function routeAudioToMockMic(page, audioFilePath) {
  const INTERCEPT_URL = '**/sully-mock-dialogue.mp3';
  const FETCH_PATH = '/sully-mock-dialogue.mp3';

  const audioData = await fs.readFile(audioFilePath);

  await page.unroute(INTERCEPT_URL).catch(() => {});
  await page.route(INTERCEPT_URL, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'audio/mpeg',
      body: audioData
    });
  });

  const duration = await page.evaluate(async (fetchPath) => {
    try {
      if (!window._audioInjection?.audioContext) {
        console.error('[AudioRoute] Mock not initialized');
        return 0;
      }
      const ctx = window._audioInjection.audioContext;
      const dest = window._audioInjection.destination;

      if (ctx.state !== 'running') await ctx.resume();

      const resp = await fetch(fetchPath);
      const arrayBuf = await resp.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(arrayBuf);

      const source = ctx.createBufferSource();
      source.buffer = audioBuf;
      source.connect(dest);
      source.connect(ctx.destination);
      source.start(0);

      console.log(`[AudioRoute] Playing ${audioBuf.duration.toFixed(1)}s through mock mic`);
      return audioBuf.duration;
    } catch (err) {
      console.error('[AudioRoute] Failed:', err.message, err.stack);
      return { error: err.message };
    }
  }, FETCH_PATH);

  if (duration && duration.error) {
    console.error(`Audio routing failed in browser: ${duration.error}`);
    return 0;
  }
  console.log(`Audio routed to mock mic (${duration && duration.toFixed ? duration.toFixed(1) : duration}s)`);
  return duration;
}

/**
 * Debug audio streams — logs stream state to console and returns it.
 */
export async function debugAudioStreams(page) {
  return await page.evaluate(() => {
    if (!window._audioInjection) return { error: 'Audio injection not initialized' };
    
    const stream = window._audioInjection.mediaStream;
    const tracks = stream ? stream.getAudioTracks() : [];
    
    return {
      mockActive: window._audioInjection.mockActive,
      hasMediaStream: !!stream,
      trackCount: tracks.length,
      trackEnabled: tracks.length > 0 ? tracks[0].enabled : false,
      contextState: window._audioInjection.audioContext?.state || 'unknown'
    };
  });
}

/**
 * Calculate recording duration based on dialogue length
 */
export function calculateRecordingDuration(lineCount, timePerLine = 5000, bufferTime = 5000) {
  return lineCount * timePerLine + bufferTime;
}

/**
 * Get transcript text using various selector fallback strategies
 */
export async function getTranscriptText(page) {
  const selectors = [
    common.transcriptBox,
    common.patientNotes,
    '.transcript', 
    '.transcript-box', 
    '.transcript-content', 
    '.notes', 
    '[data-testid="transcript"]', 
    '[data-content="transcript"]',
    'div[class*="transcript"]', 
    'div[class*="notes"]'
  ].filter(Boolean);
  
  for (const selector of selectors) {
    try {
      const isVisible = await page.locator(selector).isVisible({ 
        timeout: selector === common.transcriptBox ? 30000 : 3000 
      }).catch(() => false);
      
      if (isVisible) {
        console.log(`Found transcript with selector: ${selector}`);
        return await page.locator(selector).textContent();
      }
    } catch (error) {
      // Try next selector
    }
  }
  
  return await page.evaluate(() => {
    const allTextElements = document.querySelectorAll('div, p, span');
    for (const element of allTextElements) {
      const text = element.textContent || '';
      if (text.length > 100 && text.includes('.') && !text.includes('<')) {
        return text;
      }
    }
    return '';
  });
}
