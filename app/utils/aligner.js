import levenshtein from 'fast-levenshtein';

export const normalize = (text) => {
  return text
    .toLowerCase()
    .replace(/[^\w\s]|_/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

export const findBestMatch = (scriptSentences, transcript, currentIndex) => {
  const cleanTranscript = normalize(transcript);
  if (!cleanTranscript) return currentIndex;

  // We only look at a window of sentences around the current index
  // to prevent jumping to the wrong "The" or "And" later in the script.
  const searchWindow = 3; 
  const start = Math.max(0, currentIndex - 1);
  const end = Math.min(scriptSentences.length, currentIndex + searchWindow);

  let bestMatchIndex = currentIndex;
  let bestScore = Infinity; // Lower levenshtein distance is better

  for (let i = start; i < end; i++) {
    const cleanScript = normalize(scriptSentences[i]);
    
    // Calculate distance
    const distance = levenshtein.get(cleanScript, cleanTranscript);
    
    // We normalize the score by length to handle short vs long sentences
    const relativeScore = distance / cleanScript.length;

    // Threshold: If the match is reasonably close (e.g., < 0.6 error rate)
    if (relativeScore < 0.6 && distance < bestScore) {
      bestScore = distance;
      bestMatchIndex = i;
    }
  }

  // Only advance if we found a better match ahead
  return bestMatchIndex > currentIndex ? bestMatchIndex : currentIndex;
};