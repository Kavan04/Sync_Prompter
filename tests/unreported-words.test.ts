import { describe, expect, it } from "vitest";
import { unreportedWords } from "../app/hooks/useVoiceRecognition";

// Seeded generator (mulberry32), so every run sees the same revisions.
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Revises the reported words the way a recognizer might: keeps some, replaces
// some, drops some, inserts new words at the front and appends new words. Every
// new word is unique, so a repeated word can only be a re-sent reported word.
// expected is the part of the revision after its last kept word.
function revise(reported: string[], nextWord: () => string, random: () => number) {
  const current: string[] = [];
  let lastKept = -1;
  if (random() < 0.3) current.push(nextWord());
  for (const word of reported) {
    const roll = random();
    if (roll < 0.5) {
      lastKept = current.length;
      current.push(word);
    } else if (roll < 0.75) {
      current.push(nextWord());
    }
  }
  while (random() < 0.6) current.push(nextWord());
  return { current, expected: lastKept < 0 ? current : current.slice(lastKept + 1) };
}

describe("unreportedWords", () => {
  it("never emits an already reported word across random hypothesis revisions", () => {
    for (let session = 1; session <= 200; session += 1) {
      const random = seededRandom(session);
      let count = 0;
      const nextWord = () => `word${count++}`;
      const emittedBefore = new Set<string>();
      let reported: string[] = [];

      for (let step = 0; step < 20; step += 1) {
        const { current, expected } = revise(reported, nextWord, random);
        const emitted = unreportedWords(reported, current);

        expect(emitted).toEqual(expected);
        for (const word of emitted) {
          expect(reported).not.toContain(word);
          expect(emittedBefore.has(word)).toBe(false);
          emittedBefore.add(word);
        }
        reported = current;
      }
    }
  });

  it("emits nothing when the hypothesis is resent unchanged", () => {
    expect(unreportedWords(["the", "big"], ["the", "big"])).toEqual([]);
  });

  it("emits the whole hypothesis when nothing was reported", () => {
    expect(unreportedWords([], ["the", "big"])).toEqual(["the", "big"]);
  });
});
