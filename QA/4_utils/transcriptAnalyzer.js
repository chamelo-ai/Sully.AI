/**
 * Transcript analyzer utility with OpenAI API integration
 */

import { stringSimilarity } from 'string-similarity-js';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { getTranscriptText } from './browserUtils.js';

// Load environment variables
dotenv.config();

// Configuration constants
const CONFIG = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4'
  },
  analysis: {
    qualityThresholds: {
      speakerAccuracy: 0.7,
      contentCoverage: 0.7,
      coherence: 0.7,
      naturalness: 0.7,
      overallScore: 0.8
    }
  },
  stopWords: new Set([
    'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by',
    'is', 'are', 'was', 'were', 'be', 'being', 'been', 'have', 'has', 'had',
    'do', 'does', 'did', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their'
  ]),
  medicalTermRegex: /\b(diagnos(is|e)|symptom|treatment|medication|condition|pain|discomfort|prescription|chronic|acute|infection|disease|disorder|syndrome|therapy|allergi(c|es)|assessment|examination|test results|prognosis|referral|specialist|surgery|procedure|recovery|follow-up|medical history|vital signs|blood pressure|temperature|pulse|respiration|breath|cough|fatigue|nausea|dizziness|headache|migraine|fever|inflammation|swelling|rash|discharge|bleeding|wound|injury|fracture|strain|sprain|tumor|cancer|diabetes|hypertension|asthma|copd|arthritis|depression|anxiety)\b/gi
};

/**
 * Process transcript and analyze quality
 */
export async function processTranscript(page, errorModal, dialogue, resultsDir, useLocalAnalyzer = false) {
  const timestamp = new Date().toISOString().replace(/[:T.]/g, '-');
  
  // Check for error modal
  const isErrorVisible = await errorModal.isVisible({ timeout: 5000 }).catch(() => false);
  if (isErrorVisible) {
    console.log('Error modal is visible - recording might be too short');
    return null;
  }
  
  // Get transcript text
  console.log('Attempting to retrieve transcript...');
  const transcriptText = await getTranscriptText(page);
  
  if (!transcriptText) {
    console.log('No transcript text found');
    await page.screenshot({ 
      path: path.join(resultsDir, `no_transcript_${timestamp}.png`),
      fullPage: true 
    });
    return null;
  }
  
  // Convert the original dialogue to text
  const originalText = dialogue
    .map(line => `${line.speaker}: ${line.text}`)
    .join('\n');
    
  // Save files
  await saveFiles(transcriptText, originalText, timestamp, resultsDir);
  
  // Take screenshot
  await page.screenshot({ 
    path: path.join(resultsDir, `transcript_screenshot_${timestamp}.png`),
    fullPage: false 
  });
  
  // Analyze quality and return results
  return analyzeAndValidate(transcriptText, originalText, timestamp, resultsDir, useLocalAnalyzer);
}

/**
 * Save transcript and original files
 */
async function saveFiles(transcriptText, originalText, timestamp, resultsDir) {
  const transcriptFilePath = path.join(resultsDir, `transcript_${timestamp}.txt`);
  const originalFilePath = path.join(resultsDir, `original_${timestamp}.txt`);
  
  await fs.writeFile(transcriptFilePath, transcriptText);
  await fs.writeFile(originalFilePath, originalText);
  console.log(`Transcript saved to: ${transcriptFilePath}`);
}

/**
 * Analyze transcript and validate against threshold
 */
async function analyzeAndValidate(transcriptText, originalText, timestamp, resultsDir, useLocalAnalyzer = false) {
  try {
    console.log('Analyzing transcript quality...');
    
    // Use the existing utility for transcript analysis
    const analysisResults = await analyzeTranscriptQuality(transcriptText, originalText, useLocalAnalyzer);
    
    // Get improvement suggestions
    const suggestions = generateImprovementSuggestions(analysisResults);
    
    // Create quality report
    const qualityResults = prepareQualityReport(analysisResults, suggestions);
    
    // Save results
    const resultsFilePath = path.join(resultsDir, `quality_results_${timestamp}.json`);
    await fs.writeFile(resultsFilePath, JSON.stringify(qualityResults, null, 2));
    
    // Log results
    logAnalysisResults(qualityResults, transcriptText, originalText);

    // NOTE: the quality-threshold gate is asserted by the caller (after the
    // report is written), so a failing score still produces a report AND fails
    // the test — instead of being silently swallowed here.
    return { qualityResults, transcriptText, originalText };
    
  } catch (error) {
    console.error('Error in transcript quality evaluation:', error);
    return null;
  }
}

/**
 * Prepare quality report from analysis results
 */
function prepareQualityReport(analysisResults, suggestions) {
  return {
    contentAccuracy: Math.round(analysisResults.contentCoverage * 100),
    speakerAttribution: Math.round(analysisResults.speakerAccuracy * 100),
    coherence: Math.round(analysisResults.coherence * 10),
    naturalness: Math.round(analysisResults.naturalness * 10),
    overallScore: Math.round(analysisResults.overallScore * 100),
    presentPhrases: analysisResults.presentPhrases,
    missingPhrases: analysisResults.missingPhrases,
    incorrectTranscriptions: analysisResults.incorrectTranscriptions,
    improvementSuggestions: suggestions
  };
}

/**
 * Log analysis results to console
 */
function logAnalysisResults(qualityResults, transcriptText, originalText) {
  // Log comparison
  console.log('\n============= TRANSCRIPT COMPARISON =============');
  console.log('ORIGINAL:');
  console.log(originalText.substring(0, 300) + '...');
  console.log('TRANSCRIPT:');
  console.log(transcriptText.substring(0, 300) + '...');
  
  // Log metrics
  console.log('\n============= TRANSCRIPT QUALITY METRICS =============');
  console.log(`CONTENT ACCURACY: ${qualityResults.contentAccuracy}%`);
  console.log(`SPEAKER ATTRIBUTION: ${qualityResults.speakerAttribution}%`);
  console.log(`COHERENCE: ${qualityResults.coherence}/10`);
  console.log(`NATURALNESS: ${qualityResults.naturalness}/10`);
  console.log(`OVERALL SCORE: ${qualityResults.overallScore}%`);
  
  // Log suggestions
  if (qualityResults.improvementSuggestions.length > 0) {
    console.log('\n============= IMPROVEMENT SUGGESTIONS =============');
    qualityResults.improvementSuggestions.forEach((suggestion, index) => {
      console.log(`${index + 1}. ${suggestion}`);
    });
  }
  
  // Log missing phrases
  if (qualityResults.missingPhrases.length > 0) {
    console.log('\n============= KEY MISSING PHRASES =============');
    qualityResults.missingPhrases.slice(0, 5).forEach((phrase, index) => {
      console.log(`${index + 1}. "${phrase}"`);
    });
  }
}

/**
 * Analyze transcript quality compared to original dialogue
 */
export async function analyzeTranscriptQuality(transcriptText, originalText, useLocalAnalyzer = false) {
  // Force the deterministic local analyzer, bypassing the LLM judge entirely.
  if (useLocalAnalyzer) {
    console.log('Using local (heuristic) analyzer — LLM judge bypassed');
    return localAnalyzeTranscriptQuality(transcriptText, originalText);
  }

  // First try OpenAI-based analysis
  if (CONFIG.openai.apiKey) {
    try {
      console.log('Attempting transcript analysis with OpenAI API...');
      const openAIAnalysis = await analyzeWithOpenAI(transcriptText, originalText);
      
      if (openAIAnalysis) {
        console.log('OpenAI analysis completed successfully');
        return openAIAnalysis;
      } else {
        console.log('OpenAI analysis failed or returned invalid results, falling back to local analysis');
      }
    } catch (error) {
      console.error('Error with OpenAI analysis:', error.message);
      console.log('Falling back to local analysis');
    }
  } else {
    console.log('OpenAI API key not found, using local analysis');
  }
  
  // Fall back to local analysis if OpenAI fails or isn't configured
  return localAnalyzeTranscriptQuality(transcriptText, originalText);
}

/**
 * Analyze transcript quality using OpenAI API
 */
async function analyzeWithOpenAI(transcriptText, originalText) {
  try {
    const prompt = `
You are an expert transcript quality analyzer. Analyze the quality of a medical transcript compared to the original dialogue.

ORIGINAL DIALOGUE:
${originalText}

GENERATED TRANSCRIPT:
${transcriptText}

Evaluate the transcript on the following metrics:
1. Content Accuracy: How much of the original content was captured (0-1 scale)
2. Speaker Attribution: How well speakers are distinguished (0-1 scale)
3. Coherence: How well the text flows logically (0-1 scale)
4. Naturalness: How natural-sounding the language is (0-1 scale)

Also identify:
- Missing key phrases
- Incorrect transcriptions
- Speaker attribution errors

Return your analysis as a JSON object with the following structure:
{
  "contentCoverage": 0.85, // 0-1 scale
  "speakerAccuracy": 0.9, // 0-1 scale
  "coherence": 0.8, // 0-1 scale
  "naturalness": 0.7, // 0-1 scale
  "overallScore": 0.82, // Weighted average of above metrics
  "presentPhrases": ["key phrase 1", "key phrase 2"], 
  "missingPhrases": ["key phrase 3", "key phrase 4"],
  "incorrectTranscriptions": [
    {
      "original": "original text",
      "transcribed": "transcribed text",
      "similarityScore": 0.6
    }
  ]
}

Respond ONLY with the JSON. No additional text, explanations, or markdown formatting.
`;

    const response = await axios.post(
      CONFIG.openai.endpoint,
      {
        model: CONFIG.openai.model,
        messages: [
          { role: 'system', content: 'You are a transcript quality analysis tool. Provide detailed analysis in the requested JSON format and nothing else.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 1500
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.openai.apiKey}`
        }
      }
    );
    
    const responseText = response.data.choices[0].message.content.trim();
    
    try {
      const analysis = JSON.parse(responseText);
      
      // Validate required fields
      const requiredFields = [
        'contentCoverage', 'speakerAccuracy', 'coherence', 'naturalness', 
        'overallScore', 'presentPhrases', 'missingPhrases', 'incorrectTranscriptions'
      ];
      
      for (const field of requiredFields) {
        if (analysis[field] === undefined) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
      
      // Add empty improvement suggestions array to match expected format
      analysis.improvementSuggestions = [];
      
      return analysis;
    } catch (parseError) {
      console.error('Error parsing OpenAI analysis response as JSON:', parseError);
      console.log('Response text:', responseText);
      return null;
    }
  } catch (error) {
    console.error('Error analyzing transcript with OpenAI API:', error.message);
    if (error.response) {
      console.error('API Error Details:', error.response.data);
    }
    return null;
  }
}

/**
 * Analyze transcript quality using local methods
 */
async function localAnalyzeTranscriptQuality(transcriptText, originalText) {
  // Extract key phrases from original text
  const keyPhrases = extractKeyPhrases(originalText);
  
  // Check which key phrases appear in transcript
  const presentPhrases = keyPhrases.filter(phrase => 
    phraseAppearsInTranscript(phrase, transcriptText)
  );
  
  const missingPhrases = keyPhrases.filter(phrase => 
    !phraseAppearsInTranscript(phrase, transcriptText)
  );
  
  // Calculate content coverage
  const contentCoverage = keyPhrases.length > 0 ? 
    presentPhrases.length / keyPhrases.length : 0;
  
  // Calculate overall similarity score
  const overallSimilarity = stringSimilarity(
    originalText.toLowerCase(), 
    transcriptText.toLowerCase()
  );
  
  // Analyze speaker attribution
  const speakerAccuracy = analyzeSpeakerAttribution(originalText, transcriptText);
  
  // Find incorrectly transcribed segments
  const incorrectTranscriptions = findIncorrectTranscriptions(originalText, transcriptText);
  
  // Calculate coherence score
  const coherence = analyzeCoherence(transcriptText);
  
  // Calculate naturalness score
  const naturalness = analyzeNaturalness(transcriptText);
  
  // Calculate a weighted overall score
  const overallScore = (
    (overallSimilarity * 0.3) + 
    (contentCoverage * 0.3) + 
    (speakerAccuracy * 0.2) +
    (coherence * 0.1) +
    (naturalness * 0.1)
  );
  
  // Return analysis results
  return {
    overallScore,
    contentCoverage,
    speakerAccuracy,
    coherence,
    naturalness,
    presentPhrases,
    missingPhrases,
    incorrectTranscriptions,
    improvementSuggestions: [],
    scores: {
      contentAccuracy: Math.round(contentCoverage * 100),
      speakerAttributionScore: Math.round(speakerAccuracy * 100),
      coherenceScore: Math.round(coherence * 10),
      naturalnessScore: Math.round(naturalness * 10),
      overallScore: Math.round(overallScore * 100)
    }
  };
}

/**
 * Extract key phrases from dialogue text
 */
export function extractKeyPhrases(text) {
  const phrases = [];
  
  // Extract medical terms using regex patterns
  const medicalTerms = extractRegexMatches(text, CONFIG.medicalTermRegex, 0)
    .map(term => term.toLowerCase());
  phrases.push(...medicalTerms);
  
  // Extract phrases with speaker attribution
  const speakerPhrases = text.split('\n')
    .map(line => {
      const parts = line.split(':');
      return parts.length >= 2 ? parts[1].trim() : null;
    })
    .filter(Boolean);
  
  // Break phrases into smaller parts (3-5 words)
  for (const phrase of speakerPhrases) {
    const words = phrase.split(/\s+/);
    if (words.length > 4) {
      for (let i = 0; i < words.length - 3; i++) {
        phrases.push(words.slice(i, i + 4).join(' ').toLowerCase());
      }
    } else {
      phrases.push(phrase.toLowerCase());
    }
  }
  
  // Remove duplicates and trim to reasonable number
  return [...new Set(phrases)].slice(0, 15);
}

/**
 * Extract all regex matches from text
 */
function extractRegexMatches(text, regex, groupIndex) {
  const results = [];
  let match;
  const regexCopy = new RegExp(regex.source, regex.flags);
  
  while ((match = regexCopy.exec(text)) !== null) {
    results.push(match[groupIndex]);
  }
  
  return results;
}

/**
 * Check if a key phrase appears in the transcript
 */
function phraseAppearsInTranscript(phrase, transcript) {
  const lowerPhrase = phrase.toLowerCase();
  const lowerTranscript = transcript.toLowerCase();
  
  // Direct match
  if (lowerTranscript.includes(lowerPhrase)) {
    return true;
  }
  
  // For single words, check similarity with any word in transcript
  const phraseWords = lowerPhrase.split(/\s+/);
  if (phraseWords.length === 1) {
    const transcriptWords = lowerTranscript.split(/\s+/);
    return transcriptWords.some(word => stringSimilarity(word, lowerPhrase) > 0.8);
  }
  
  // For multi-word phrases, use sliding window to check for similar phrases
  const transcriptWords = lowerTranscript.split(/\s+/);
  const phraseLengthWords = phraseWords.length;
  
  // Skip if transcript is too short
  if (transcriptWords.length < phraseLengthWords) return false;
  
  // Check each possible window in transcript
  for (let i = 0; i <= transcriptWords.length - phraseLengthWords; i++) {
    const windowText = transcriptWords.slice(i, i + phraseLengthWords).join(' ');
    if (stringSimilarity(windowText, lowerPhrase) > 0.8) {
      return true;
    }
  }
  
  return false;
}

/**
 * Compare speaker patterns between original dialogue and transcript
 */
function analyzeSpeakerAttribution(originalText, transcriptText) {
  // Extract speaker patterns
  const originalSpeakerPattern = /\b([A-Za-z]+(?:\s[A-Za-z]+)?):\s/g;
  const transcriptSpeakerPattern = /\b([A-Za-z]+(?:\s[A-Za-z]+)?)[,:]\s/g;
  
  // Extract all speaker occurrences
  const originalSpeakers = extractAllMatches(originalText, originalSpeakerPattern, 1);
  const transcriptSpeakers = extractAllMatches(transcriptText, transcriptSpeakerPattern, 1);
  
  // If transcript doesn't have speaker attributions, return 0
  if (transcriptSpeakers.length === 0) {
    return 0;
  }
  
  // Count transitions (speaker changes)
  const originalTransitions = countTransitions(originalSpeakers);
  const transcriptTransitions = countTransitions(transcriptSpeakers);
  
  // Calculate ratio of transitions captured
  const transitionRatio = originalTransitions === 0 ? 
    1 : Math.min(transcriptTransitions / originalTransitions, 1);
  
  // Calculate speaker coverage
  const uniqueOriginalSpeakers = [...new Set(originalSpeakers)];
  const uniqueTranscriptSpeakers = [...new Set(transcriptSpeakers)];
  
  let speakerMatches = 0;
  for (const originalSpeaker of uniqueOriginalSpeakers) {
    for (const transcriptSpeaker of uniqueTranscriptSpeakers) {
      if (transcriptSpeaker === originalSpeaker || 
          stringSimilarity(transcriptSpeaker, originalSpeaker) > 0.8) {
        speakerMatches++;
        break;
      }
    }
  }
  
  const speakerCoverage = uniqueOriginalSpeakers.length === 0 ?
    1 : speakerMatches / uniqueOriginalSpeakers.length;
  
  // Combined score (weighted)
  return (transitionRatio * 0.6) + (speakerCoverage * 0.4);
}

/**
 * Extract all regex matches from text
 */
function extractAllMatches(text, regex, groupIndex) {
  const results = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    results.push(match[groupIndex].toLowerCase());
  }
  
  return results;
}

/**
 * Count number of transitions (changes) in a sequence
 */
function countTransitions(sequence) {
  let transitions = 0;
  
  for (let i = 1; i < sequence.length; i++) {
    if (sequence[i] !== sequence[i-1]) {
      transitions++;
    }
  }
  
  return transitions;
}

/**
 * Analyze coherence of transcript
 */
export function analyzeCoherence(text) {
  // Split into sentences
  const sentences = text.split(/[.!?]+\s+/).filter(s => s.trim().length > 0);
  
  if (sentences.length <= 1) {
    return 0.5; // Not enough sentences to evaluate coherence
  }
  
  // Measure semantic similarity between adjacent sentences
  let totalSimilarity = 0;
  for (let i = 0; i < sentences.length - 1; i++) {
    const similarity = stringSimilarity(
      sentences[i].toLowerCase(), 
      sentences[i + 1].toLowerCase()
    );
    totalSimilarity += similarity;
  }
  
  // Calculate average similarity
  const avgSimilarity = totalSimilarity / (sentences.length - 1);
  
  // Coherence has a sweet spot - not too similar, not too different
  let coherenceScore;
  if (avgSimilarity < 0.1) {
    coherenceScore = avgSimilarity * 5; // Too different
  } else if (avgSimilarity <= 0.4) {
    coherenceScore = 0.5 + ((avgSimilarity - 0.1) * (0.5 / 0.3)); // Optimal
  } else {
    coherenceScore = 1.0 - ((avgSimilarity - 0.4) * (0.5 / 0.6)); // Too similar
  }
  
  // Adjust for topic continuity
  const topicWords = extractTopicWords(text);
  const topicContinuity = analyzeTopicContinuity(sentences, topicWords);
  
  // Final coherence is a weighted combination
  const finalCoherence = (coherenceScore * 0.7) + (topicContinuity * 0.3);
  return Math.max(0, Math.min(1, finalCoherence));
}

/**
 * Extract topic words from text
 */
function extractTopicWords(text) {
  // Extract nouns and important content words
  const words = text.toLowerCase().split(/\s+/);
  
  // Filter out common stop words
  const contentWords = words.filter(word => 
    word.length > 3 && !CONFIG.stopWords.has(word)
  );
  
  // Get frequency count
  const wordFreq = {};
  contentWords.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  
  // Get top words by frequency
  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(entry => entry[0]);
}

/**
 * Analyze topic continuity across sentences
 */
function analyzeTopicContinuity(sentences, topicWords) {
  if (sentences.length <= 1 || topicWords.length === 0) {
    return 0.5;
  }
  
  // Count sentences that contain at least one topic word
  const sentencesWithTopic = sentences.filter(sentence => 
    topicWords.some(word => sentence.toLowerCase().includes(word))
  ).length;
  
  return sentencesWithTopic / sentences.length;
}

/**
 * Analyze naturalness of transcript
 */
export function analyzeNaturalness(text) {
  // Split into sentences
  const sentences = text.split(/[.!?]+\s+/).filter(s => s.trim().length > 0);
  
  if (sentences.length === 0) {
    return 0.5; // Default score for empty text
  }
  
  // 1. Sentence length diversity
  const sentenceLengths = sentences.map(s => s.split(/\s+/).length);
  const avgLength = sentenceLengths.reduce((sum, len) => sum + len, 0) / sentenceLengths.length;
  const lengthVariation = sentenceLengths.map(len => Math.abs(len - avgLength))
    .reduce((sum, diff) => sum + diff, 0) / sentenceLengths.length;
  
  // Normalize length variation
  const lengthVariationScore = lengthVariation < 1 ? 
    lengthVariation : 
    (lengthVariation > 4 ? 1 - ((lengthVariation - 4) / 8) : 1);
  
  // 2. Sentence structure diversity (starter words variety)
  const starterWords = sentences.map(s => {
    const words = s.trim().split(/\s+/);
    return words.length > 0 ? words[0].toLowerCase() : '';
  }).filter(Boolean);
  
  const uniqueStarters = new Set(starterWords);
  const starterDiversityScore = sentences.length <= 3 ? 
    1 : Math.min(uniqueStarters.size / Math.min(sentences.length, 10), 1);
  
  // 3. Word repetition
  const words = text.toLowerCase().split(/\s+/);
  const wordFreq = {};
  for (const word of words) {
    if (word.length > 3) { // Only consider meaningful words
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  }
  
  // Calculate repetition rate
  const meaningfulWords = Object.keys(wordFreq).length;
  const totalMeaningfulWordCount = Object.values(wordFreq).reduce((sum, count) => sum + count, 0);
  const repetitionRate = meaningfulWords / totalMeaningfulWordCount;
  
  // Map repetition rate to score
  let repetitionScore;
  if (repetitionRate < 0.4) {
    repetitionScore = repetitionRate / 0.4; // Too much repetition
  } else if (repetitionRate <= 0.6) {
    repetitionScore = 1; // Optimal range
  } else {
    repetitionScore = 1 - ((repetitionRate - 0.6) / 0.4); // Too little repetition
  }
  
  // 4. Sentence length reasonableness
  const lengthReasonablenessScore = sentenceLengths.map(length => {
    if (length >= 4 && length <= 20) {
      return 1; // Ideal length
    } else if (length < 4) {
      return length / 4; // Too short
    } else {
      return 1 - Math.min((length - 20) / 20, 0.8); // Too long
    }
  }).reduce((sum, score) => sum + score, 0) / sentenceLengths.length;
  
  // Combine scores with different weights
  return (
    (lengthVariationScore * 0.25) + 
    (starterDiversityScore * 0.25) + 
    (repetitionScore * 0.2) + 
    (lengthReasonablenessScore * 0.3)
  );
}

/**
 * Identify incorrectly transcribed segments
 */
export function findIncorrectTranscriptions(originalText, transcriptText) {
  const originalSentences = originalText.match(/[^.!?]+[.!?]+/g) || [];
  const transcriptWords = transcriptText.split(/\s+/);
  const incorrectTranscriptions = [];
  
  for (const sentence of originalSentences) {
    const cleanSentence = sentence.trim();
    if (cleanSentence.length < 10) continue;
    
    const sentenceWords = cleanSentence.split(/\s+/).length;
    if (sentenceWords > transcriptWords.length) continue;
    
    // Find best matching segment
    let bestMatch = '';
    let bestScore = 0;
    
    // Create sliding windows to find best match
    for (let i = 0; i <= transcriptWords.length - sentenceWords; i++) {
      const windowSize = Math.min(sentenceWords * 2, transcriptWords.length - i);
      const windowText = transcriptWords.slice(i, i + windowSize).join(' ');
      const score = stringSimilarity(cleanSentence, windowText);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = windowText;
      }
    }
    
    // If best match is below threshold, consider it incorrect transcription
    if (bestScore > 0.3 && bestScore < 0.8) {
      incorrectTranscriptions.push({
        original: cleanSentence,
        transcribed: bestMatch,
        similarityScore: bestScore
      });
    }
  }
  
  // Sort by similarity score (ascending) and return top 5 worst transcriptions
  return incorrectTranscriptions
    .sort((a, b) => a.similarityScore - b.similarityScore)
    .slice(0, 5);
}

/**
 * Generate improvement suggestions based on analysis
 */
export function generateImprovementSuggestions(analysisResults) {
  const suggestions = [];
  const thresholds = CONFIG.analysis.qualityThresholds;
  
  if (analysisResults.speakerAccuracy < thresholds.speakerAccuracy) {
    suggestions.push("Improve speaker attribution to better distinguish between speakers");
  }
  
  if (analysisResults.contentCoverage < thresholds.contentCoverage) {
    suggestions.push("Increase content coverage by capturing more key information from the original dialogue");
  }
  
  if (analysisResults.coherence < thresholds.coherence) {
    suggestions.push("Improve logical flow and topic continuity between sentences");
  }
  
  if (analysisResults.naturalness < thresholds.naturalness) {
    suggestions.push("Make language more natural by varying sentence structure and length");
  }
  
  if (analysisResults.incorrectTranscriptions.length > 0) {
    suggestions.push("Address incorrect transcriptions, especially medical terminology");
  }
  
  // Add generic suggestion if nothing specific identified
  if (suggestions.length === 0 && analysisResults.overallScore < thresholds.overallScore) {
    suggestions.push("Improve overall transcription accuracy and quality");
  }
  
  return suggestions;
}

// All necessary functions are already exported with the export keyword
// No need for a separate export statement