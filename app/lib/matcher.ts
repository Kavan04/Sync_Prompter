import levenshtein from "fast-levenshtein";
import { numberWords, ordinalWords } from "./numberWords";

// Matching thresholds. README.md documents these values; change them there too.
// Words of MATCH_SHORT_WORD_THRESHOLD letters or fewer need an exact match.
export const MATCH_SHORT_WORD_THRESHOLD = 4;
export const MATCH_SHORT_THRESHOLD = 0.95;
export const MATCH_LONG_THRESHOLD = 0.82;
// How far ahead of the anchor a word is searched for.
export const JUMP_WINDOW = 8;
// Only spoken words of this many letters or more may jump ahead.
export const JUMP_MIN_WORD_LENGTH = 5;
export const JUMP_THRESHOLD = 0.9;

const FILLER = new Set(["um", "uh", "erm", "hmm", "mhm"]);

export const similarity = (a: string, b: string) =>
  a === b ? 1 : 1 - levenshtein.get(a, b) / Math.max(a.length, b.length);

const isShortWord = (word: string) => word.length <= MATCH_SHORT_WORD_THRESHOLD;

const matchesWord = (scriptWord: string, spoken: string) =>
  similarity(scriptWord, spoken) >= (isShortWord(scriptWord) ? MATCH_SHORT_THRESHOLD : MATCH_LONG_THRESHOLD);

// The script as a flat list of matchable words. A display word can produce
// several entries (for "100", "one" "hundred"), and punctuation-only tokens
// produce none. wordIndex maps each entry back to its display word.
export interface MatchKeys {
  words: string[];
  wordIndex: number[];
}

// The form a token takes for matching: lower case, letters and digits only.
export const cleanWord = (token: string) => token.toLowerCase().replace(/[^a-z0-9]/g, "");

// Spoken or written forms of one whitespace-separated token, as matchable words.
export function wordKeys(token: string): string[] {
  const lower = token.toLowerCase().replace(/(\d),(?=\d)/g, "$1");

  const decimal = /^\D*(\d+)\.(\d+)\D*$/.exec(lower);
  if (decimal) {
    const digits = decimal[2].split("").flatMap(d => numberWords(Number(d)));
    return [...numberWords(Number(decimal[1])), "point", ...digits];
  }

  const clean = cleanWord(lower);
  const ordinal = /^(\d+)(st|nd|rd|th)$/.exec(clean);
  if (ordinal) {
    const words = ordinalWords(Number(ordinal[1]));
    return words ?? [clean];
  }
  if (/^\d+$/.test(clean)) return numberWords(Number(clean));
  return clean ? [clean] : [];
}

export function buildMatchKeys(scriptWords: string[]): MatchKeys {
  const words: string[] = [];
  const wordIndex: number[] = [];
  scriptWords.forEach((token, index) => {
    for (const key of wordKeys(token)) {
      words.push(key);
      wordIndex.push(index);
    }
  });
  return { words, wordIndex };
}

// Position in the key list of the last key at or before a display word, or -1.
export function positionAtWord(keys: MatchKeys, wordIdx: number): number {
  let position = -1;
  for (let p = 0; p < keys.wordIndex.length && keys.wordIndex[p] <= wordIdx; p += 1) {
    position = p;
  }
  return position;
}

// Display index of a key position, or -1 for none.
export function wordAtPosition(keys: MatchKeys, position: number): number {
  return position < 0 ? -1 : keys.wordIndex[position];
}

// Moves the anchor forward for spoken tokens. Each spoken word is judged
// on its own, so a word that matches nothing is simply dropped.
export function advanceMatch(position: number, spokenTokens: string[], keys: MatchKeys): number {
  let current = position;
  for (const token of spokenTokens) {
    for (const spoken of wordKeys(token)) {
      if (FILLER.has(spoken)) continue;
      current = matchSpokenWord(current, spoken, keys.words);
    }
  }
  return current;
}

function matchSpokenWord(position: number, spoken: string, words: string[]): number {
  const next = position + 1;
  if (next >= words.length) return position;

  // 1. The next word.
  if (matchesWord(words[next], spoken)) return next;

  const window = words.slice(next, position + JUMP_WINDOW + 2);
  const isUniqueInWindow = (word: string) => window.filter(w => w === word).length === 1;

  // 2. A later word, past short script words that were not said. One skipped
  // word is always allowed. Further skips need the target to be unique in the
  // window, so a repeated word cannot be reached by skipping short words.
  // Stops at the first long word, which has to be matched or jumped over itself.
  for (let target = next + 1; target < words.length && target <= position + JUMP_WINDOW; target += 1) {
    if (!isShortWord(words[target - 1])) break;
    const allowed = target === next + 1 || isUniqueInWindow(words[target]);
    if (allowed && matchesWord(words[target], spoken)) return target;
  }

  // 3. A long, unique word anywhere in the window.
  if (spoken.length >= JUMP_MIN_WORD_LENGTH) {
    for (let i = 2; i <= JUMP_WINDOW; i += 1) {
      const idx = position + i;
      if (idx >= words.length) break;
      const candidate = words[idx];
      if (isUniqueInWindow(candidate) && similarity(candidate, spoken) > JUMP_THRESHOLD) return idx;
    }
  }

  return position;
}
