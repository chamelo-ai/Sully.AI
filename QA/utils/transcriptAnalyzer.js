/**
 * Transcript analyzer utility with OpenAI API integration
 * Provides comprehensive transcript analysis functionality
 */

import { stringSimilarity } from 'string-similarity-js';
import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

// Get OpenAI API key from environment
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

/**
 * Analyze transcript quality compared to original dialogue
 * Uses OpenAI API if available, falls back to local analysis if not
 * @param {string} transcriptText - Generated transcript text
 * @param {string} originalText - Original dialogue text
 * @returns {Promise<Object>} - Analysis results
 */
async function analyzeTranscriptQuality(transcriptText, originalText) {
  // First try OpenAI-based analysis
  if (OPENAI_API_KEY) {
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
 * @param {string} transcriptText - Generated transcript text
 * @param {string} originalText - Original dialogue text
 * @returns {Promise<Object>} - Analysis results or null if failed
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
      OPENAI_API_ENDPOINT,
      {
        model: 'gpt-4',
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
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
      }
    );
    
    const responseText = response.data.choices[0].message.content.trim();
    
    // Parse the JSON
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
 * @param {string} transcriptText - Generated transcript text
 * @param {string} originalText - Original dialogue text
 * @returns {Promise<Object>} - Analysis results
 */
async function localAnalyzeTranscriptQuality(transcriptText, originalText) {
  // Extract key phrases from original text
  const keyPhrases = extractKeyPhrases(originalText);
  console.log('Extracted key phrases:', keyPhrases);
  
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
    // Will be populated by the quality evaluator
    improvementSuggestions: [],
    // Return scores on 100-point scale
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
 * @param {string} text - Original dialogue text
 * @returns {string[]} - Array of key phrases
 */
function extractKeyPhrases(text) {
  // Simple extraction of medical terms and phrases
  const phrases = [];
  
  // Extract medical terms using regex patterns
  const medicalTermRegex = /\b(diagnos(is|e)|symptom|treatment|medication|condition|pain|discomfort|prescription|chronic|acute|infection|disease|disorder|syndrome|therapy|allergi(c|es)|assessment|examination|test results|prognosis|referral|specialist|surgery|procedure|recovery|follow-up|medical history|vital signs|blood pressure|temperature|pulse|respiration|breath|cough|fatigue|nausea|dizziness|headache|migraine|fever|inflammation|swelling|rash|discharge|bleeding|wound|injury|fracture|strain|sprain|tumor|cancer|diabetes|hypertension|asthma|copd|arthritis|depression|anxiety)\b/gi;
  
  let match;
  while ((match = medicalTermRegex.exec(text)) !== null) {
    phrases.push(match[0].toLowerCase());
  }
  
  // Extract phrases with speaker attribution
  const speakerPhrases = text.split('\n').map(line => {
    const parts = line.split(':');
    if (parts.length >= 2) {
      return parts[1].trim();
    }
    return null;
  }).filter(Boolean);
  
  // Break phrases into smaller parts (3-5 words)
  speakerPhrases.forEach(phrase => {
    const words = phrase.split(/\s+/);
    if (words.length > 4) {
      for (let i = 0; i < words.length - 3; i++) {
        phrases.push(words.slice(i, i + 4).join(' ').toLowerCase());
      }
    } else {
      phrases.push(phrase.toLowerCase());
    }
  });
  
  // Remove duplicates and trim to reasonable number
  return [...new Set(phrases)].slice(0, 15);
}

/**
 * Check if a key phrase appears in the transcript
 * @param {string} phrase - Key phrase to look for
 * @param {string} transcript - Generated transcript
 * @returns {boolean} - Whether the phrase is present
 */
function phraseAppearsInTranscript(phrase, transcript) {
  // Direct match
  if (transcript.toLowerCase().includes(phrase.toLowerCase())) {
    return true;
  }
  
  // Check for high similarity matches (for handling minor transcription errors)
  const transcriptWords = transcript.toLowerCase().split(/\s+/);
  const phraseWords = phrase.toLowerCase().split(/\s+/);
  
  // For single words, check similarity
  if (phraseWords.length === 1) {
    return transcriptWords.some(word => 
      stringSimilarity(word, phrase) > 0.8
    );
  }
  
  // For multi-word phrases, use sliding window to check for similar phrases
  for (let i = 0; i <= transcriptWords.length - phraseWords.length; i++) {
    const windowText = transcriptWords.slice(i, i + phraseWords.length).join(' ');
    if (stringSimilarity(windowText, phrase) > 0.8) {
      return true;
    }
  }
  
  return false;
}

/**
 * Compare speaker patterns between original dialogue and transcript
 * @param {string} originalText - Original dialogue text with speaker labels
 * @param {string} transcriptText - Generated transcript text
 * @returns {number} - Score between 0-1 representing speaker attribution accuracy
 */
function analyzeSpeakerAttribution(originalText, transcriptText) {
  // Extract speaker patterns from original text (using colon format)
  const originalSpeakerPattern = /\b([A-Za-z]+(?:\s[A-Za-z]+)?):\s/g;
  
  // Extract speaker patterns from transcript (supporting both colon and comma formats)
  const transcriptSpeakerPattern = /\b([A-Za-z]+(?:\s[A-Za-z]+)?)[,:]\s/g;
  
  let originalMatch;
  const originalSpeakers = [];
  while ((originalMatch = originalSpeakerPattern.exec(originalText)) !== null) {
    originalSpeakers.push(originalMatch[1].toLowerCase());
  }
  
  let transcriptMatch;
  const transcriptSpeakers = [];
  while ((transcriptMatch = transcriptSpeakerPattern.exec(transcriptText)) !== null) {
    transcriptSpeakers.push(transcriptMatch[1].toLowerCase());
  }
  
  // Log for debugging
  console.log('Original speakers found:', originalSpeakers.length, originalSpeakers);
  console.log('Transcript speakers found:', transcriptSpeakers.length, transcriptSpeakers);
  
  // If transcript doesn't have speaker attributions, return 0
  if (transcriptSpeakers.length === 0) {
    console.log('No speaker attributions found in transcript');
    return 0;
  }
  
  // Count transitions (speaker changes)
  let originalTransitions = 0;
  let transcriptTransitions = 0;
  
  for (let i = 1; i < originalSpeakers.length; i++) {
    if (originalSpeakers[i] !== originalSpeakers[i-1]) {
      originalTransitions++;
    }
  }
  
  for (let i = 1; i < transcriptSpeakers.length; i++) {
    if (transcriptSpeakers[i] !== transcriptSpeakers[i-1]) {
      transcriptTransitions++;
    }
  }
  
  console.log('Original transitions:', originalTransitions);
  console.log('Transcript transitions:', transcriptTransitions);
  
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
  
  console.log('Speaker coverage:', speakerCoverage);
  
  // Combined score (weighted)
  const finalScore = (transitionRatio * 0.6) + (speakerCoverage * 0.4);
  console.log('Final speaker attribution score:', finalScore);
  
  return finalScore;
}

/**
 * Analyze coherence of transcript
 * @param {string} text - Transcript text
 * @returns {number} - Score between 0-1 representing coherence
 */
function analyzeCoherence(text) {
  // Split into sentences
  const sentences = text.split(/[.!?]+\s+/).filter(s => s.trim().length > 0);
  
  if (sentences.length <= 1) {
    return 0.5; // Not enough sentences to evaluate coherence
  }
  
  // Measure semantic similarity between adjacent sentences
  let totalSimilarity = 0;
  for (let i = 0; i < sentences.length - 1; i++) {
    const currentSentence = sentences[i].toLowerCase();
    const nextSentence = sentences[i + 1].toLowerCase();
    
    const similarity = stringSimilarity(currentSentence, nextSentence);
    totalSimilarity += similarity;
  }
  
  // Calculate average similarity
  const avgSimilarity = totalSimilarity / (sentences.length - 1);
  
  // Coherence has a sweet spot - not too similar, not too different
  // Too similar: lacks information progression
  // Too different: lacks logical flow
  let coherenceScore;
  if (avgSimilarity < 0.1) {
    // Too different - scale up linearly from 0 to 0.5
    coherenceScore = avgSimilarity * 5;
  } else if (avgSimilarity <= 0.4) {
    // Optimal range - map 0.1-0.4 to 0.5-1.0
    coherenceScore = 0.5 + ((avgSimilarity - 0.1) * (0.5 / 0.3));
  } else {
    // Too similar - scale down from 1.0 to 0.5 as similarity increases
    coherenceScore = 1.0 - ((avgSimilarity - 0.4) * (0.5 / 0.6));
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
 * @param {string} text - Input text
 * @returns {string[]} - Array of topic words
 */
function extractTopicWords(text) {
  // Extract nouns and important content words
  // This is a simplified approach
  const words = text.toLowerCase().split(/\s+/);
  
  // Filter out common stop words
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by',
    'is', 'are', 'was', 'were', 'be', 'being', 'been', 'have', 'has', 'had',
    'do', 'does', 'did', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their'
  ]);
  
  const contentWords = words.filter(word => 
    word.length > 3 && !stopWords.has(word)
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
 * @param {string[]} sentences - Array of sentences
 * @param {string[]} topicWords - Array of topic words
 * @returns {number} - Score between 0-1 representing topic continuity
 */
function analyzeTopicContinuity(sentences, topicWords) {
  if (sentences.length <= 1 || topicWords.length === 0) {
    return 0.5;
  }
  
  // Count sentences that contain at least one topic word
  let sentencesWithTopic = 0;
  
  sentences.forEach(sentence => {
    const sentenceLower = sentence.toLowerCase();
    const hasTopic = topicWords.some(word => sentenceLower.includes(word));
    if (hasTopic) {
      sentencesWithTopic++;
    }
  });
  
  return sentencesWithTopic / sentences.length;
}

/**
 * Analyze naturalness of transcript
 * @param {string} text - Transcript text
 * @returns {number} - Score between 0-1 representing naturalness
 */
function analyzeNaturalness(text) {
  // Split into sentences
  const sentences = text.split(/[.!?]+\s+/).filter(s => s.trim().length > 0);
  
  if (sentences.length === 0) {
    return 0.5; // Default score for empty text
  }
  
  // 1. Sentence length diversity (natural text has varied sentence lengths)
  const sentenceLengths = sentences.map(s => s.split(/\s+/).length);
  const avgLength = sentenceLengths.reduce((sum, len) => sum + len, 0) / sentenceLengths.length;
  const lengthVariation = sentenceLengths.map(len => Math.abs(len - avgLength)).reduce((sum, diff) => sum + diff, 0) / sentenceLengths.length;
  
  // Normalize length variation: too little or too much variation reduces score
  // Optimal variation is around 2-4 words
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
    1 : // For very short texts, don't penalize
    Math.min(uniqueStarters.size / Math.min(sentences.length, 10), 1);
  
  // 3. Word repetition (natural speech has some repetition but not too much)
  const words = text.toLowerCase().split(/\s+/);
  const wordFreq = {};
  words.forEach(word => {
    if (word.length > 3) { // Only consider meaningful words
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });
  
  // Calculate repetition rate
  const meaningfulWords = Object.keys(wordFreq).length;
  const totalMeaningfulWordCount = Object.values(wordFreq).reduce((sum, count) => sum + count, 0);
  const repetitionRate = meaningfulWords / totalMeaningfulWordCount;
  
  // Map repetition rate to score (0.4-0.6 is ideal range)
  let repetitionScore;
  if (repetitionRate < 0.4) {
    repetitionScore = repetitionRate / 0.4; // Too much repetition
  } else if (repetitionRate <= 0.6) {
    repetitionScore = 1; // Optimal range
  } else {
    repetitionScore = 1 - ((repetitionRate - 0.6) / 0.4); // Too little repetition
  }
  
  // 4. Sentence length reasonableness
  let lengthReasonablenessScore = 0;
  for (const length of sentenceLengths) {
    if (length >= 4 && length <= 20) {
      lengthReasonablenessScore += 1; // Ideal length
    } else if (length < 4) {
      lengthReasonablenessScore += length / 4; // Too short
    } else {
      lengthReasonablenessScore += 1 - Math.min((length - 20) / 20, 0.8); // Too long
    }
  }
  lengthReasonablenessScore /= sentenceLengths.length;
  
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
 * @param {string} originalText - Original dialogue text
 * @param {string} transcriptText - Generated transcript text
 * @returns {Array} - Array of {original, transcribed} objects
 */
function findIncorrectTranscriptions(originalText, transcriptText) {
  const incorrectTranscriptions = [];
  
  // Split into sentences
  const originalSentences = originalText.match(/[^.!?]+[.!?]+/g) || [];
  
  originalSentences.forEach(sentence => {
    const cleanSentence = sentence.trim();
    if (cleanSentence.length < 10) return; // Skip very short sentences
    
    // Find best matching segment in transcript
    let bestMatch = '';
    let bestScore = 0;
    
    // Create sliding windows of transcript text to find best match
    const transcriptWords = transcriptText.split(/\s+/);
    const sentenceWords = cleanSentence.split(/\s+/).length;
    
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
  });
  
  // Sort by similarity score (ascending)
  incorrectTranscriptions.sort((a, b) => a.similarityScore - b.similarityScore);
  
  // Return top 5 worst transcriptions
  return incorrectTranscriptions.slice(0, 5);
}

/**
 * Generate improvement suggestions based on analysis
 * @param {Object} analysisResults - Results from analyzeTranscriptQuality
 * @returns {string[]} - Array of improvement suggestions
 */
function generateImprovementSuggestions(analysisResults) {
  const suggestions = [];
  
  if (analysisResults.speakerAccuracy < 0.7) {
    suggestions.push("Improve speaker attribution to better distinguish between speakers");
  }
  
  if (analysisResults.contentCoverage < 0.7) {
    suggestions.push("Increase content coverage by capturing more key information from the original dialogue");
  }
  
  if (analysisResults.coherence < 0.7) {
    suggestions.push("Improve logical flow and topic continuity between sentences");
  }
  
  if (analysisResults.naturalness < 0.7) {
    suggestions.push("Make language more natural by varying sentence structure and length");
  }
  
  if (analysisResults.incorrectTranscriptions.length > 0) {
    suggestions.push("Address incorrect transcriptions, especially medical terminology");
  }
  
  // Add generic suggestion if nothing specific identified
  if (suggestions.length === 0 && analysisResults.overallScore < 0.8) {
    suggestions.push("Improve overall transcription accuracy and quality");
  }
  
  return suggestions;
}

export {
  analyzeTranscriptQuality,
  extractKeyPhrases,
  findIncorrectTranscriptions,
  analyzeCoherence,
  analyzeNaturalness,
  generateImprovementSuggestions
};