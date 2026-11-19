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

// A concept is one spoken word or number. Its forms are the ways the recognizer
// may write it, and its keys are the words the matcher sees. Keys are unique
// across concepts, so the expected output of a revision is exact.
interface Concept {
  forms: string[][];
  keys: string[];
}

interface Placed {
  concept: Concept;
  tokens: string[];
}

const NUMBERS: [string, string[]][] = [
  ["10", ["ten"]],
  ["11", ["eleven"]],
  ["12", ["twelve"]],
  ["13", ["thirteen"]],
  ["14", ["fourteen"]],
  ["15", ["fifteen"]],
  ["16", ["sixteen"]],
  ["17", ["seventeen"]],
  ["18", ["eighteen"]],
  ["19", ["nineteen"]],
  ["21", ["twenty", "one"]],
  ["32", ["thirty", "two"]],
  ["43", ["forty", "three"]],
  ["54", ["fifty", "four"]],
  ["65", ["sixty", "five"]],
  ["76", ["seventy", "six"]],
  ["87", ["eighty", "seven"]],
  ["98", ["ninety", "eight"]],
];

const capitalize = (word: string) => word[0].toUpperCase() + word.slice(1);

const wordConcept = (n: number): Concept => {
  const word = `word${n}`;
  return { forms: [[word], [word.toUpperCase()], [`${word}.`]], keys: [word] };
};

const numberConcept = ([digits, spoken]: [string, string[]]): Concept => ({
  forms: [[digits], spoken, spoken.map(capitalize), [spoken.join("-")], [spoken.map(capitalize).join("-")]],
  keys: spoken,
});

// Revises the reported concepts the way a recognizer might: keeps some (in any
// form), replaces some, drops some, inserts new ones at the front and appends
// new ones. expected is the keys after the last kept concept.
function revise(reported: Placed[], random: () => number, fresh: () => Concept, pick: <T>(items: T[]) => T) {
  const place = (concept: Concept): Placed => ({ concept, tokens: pick(concept.forms) });
  const current: Placed[] = [];
  let lastKept = -1;
  if (random() < 0.3) current.push(place(fresh()));
  for (const { concept } of reported) {
    const roll = random();
    if (roll < 0.5) {
      lastKept = current.length;
      current.push(place(concept));
    } else if (roll < 0.75) {
      current.push(place(fresh()));
    }
  }
  while (random() < 0.6) current.push(place(fresh()));
  return { current, expected: current.slice(lastKept + 1).flatMap(({ concept }) => concept.keys) };
}

describe("unreportedWords", () => {
  it("never emits an already reported word across random hypothesis revisions", () => {
    for (let session = 1; session <= 200; session += 1) {
      const random = seededRandom(session);
      const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
      const pool = NUMBERS.map(numberConcept);
      for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      let wordCount = 0;
      const fresh = (): Concept => {
        const number = random() < 0.5 ? pool.pop() : undefined;
        return number ?? wordConcept(wordCount++);
      };
      const emittedBefore = new Set<string>();
      let reported: Placed[] = [];

      for (let step = 0; step < 20; step += 1) {
        const { current, expected } = revise(reported, random, fresh, pick);
        const emitted = unreportedWords(
          reported.flatMap(({ tokens }) => tokens),
          current.flatMap(({ tokens }) => tokens)
        );
        const reportedKeys = reported.flatMap(({ concept }) => concept.keys);

        expect(emitted).toEqual(expected);
        for (const key of emitted) {
          expect(reportedKeys).not.toContain(key);
          expect(emittedBefore.has(key)).toBe(false);
          emittedBefore.add(key);
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

  it("emits nothing when a reported number is revised from words to digits", () => {
    expect(unreportedWords(["twenty", "one"], ["21"])).toEqual([]);
  });

  it("emits nothing when a reported hyphenated number is revised to spaced words", () => {
    expect(unreportedWords(["twenty-one"], ["twenty", "one"])).toEqual([]);
  });

  it("emits only the new number when a revised number is followed by another", () => {
    expect(unreportedWords(["twenty", "one"], ["21", "32"])).toEqual(["thirty", "two"]);
  });
});
