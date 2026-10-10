import { describe, expect, it } from "vitest";
import { advanceMatch, buildMatchKeys, wordKeys } from "../app/lib/matcher";
import { numberWords, ordinalWords } from "../app/lib/numberWords";

describe("numberWords", () => {
  it.each([
    [0, "zero"],
    [7, "seven"],
    [13, "thirteen"],
    [21, "twenty one"],
    [100, "one hundred"],
    [105, "one hundred five"],
    [1000, "one thousand"],
    [1005, "one thousand five"],
    [2026, "twenty twenty six"],
    [2005, "twenty oh five"],
    [1100, "one thousand one hundred"],
  ])("%i is spoken as %j", (n, spoken) => {
    expect(numberWords(n).join(" ")).toBe(spoken);
  });

  it("gives ordinals as multi-word forms", () => {
    expect(ordinalWords(1)).toEqual(["first"]);
    expect(ordinalWords(21)).toEqual(["twenty", "first"]);
    expect(ordinalWords(100)).toBeNull();
  });
});

describe("wordKeys", () => {
  it("drops punctuation-only tokens", () => {
    expect(wordKeys("—")).toEqual([]);
    expect(wordKeys("...")).toEqual([]);
  });

  it("expands decimals, years and thousands separators", () => {
    expect(wordKeys("3.5")).toEqual(["three", "point", "five"]);
    expect(wordKeys("2026")).toEqual(["twenty", "twenty", "six"]);
    expect(wordKeys("1,000")).toEqual(["one", "thousand"]);
  });

  it("gives digits and number words the same keys", () => {
    expect(wordKeys("100")).toEqual(["one", "hundred"]);
    expect(wordKeys("thirteen")).toEqual(["thirteen"]);
  });
});

describe("advanceMatch", () => {
  const keysFor = (script: string) => buildMatchKeys(script.split(/\s+/).filter(Boolean));

  it("moves only for words that are spoken, in order", () => {
    const keys = keysFor("we discuss the performance of the team today.");
    expect(advanceMatch(-1, ["we", "discuss"], keys)).toBe(1);
  });

  it("returns the same position for unmatched speech", () => {
    const keys = keysFor("alpha bravo charlie");
    expect(advanceMatch(0, ["zebra"], keys)).toBe(0);
  });

  it("skips up to two short words before a match and keeps the position otherwise", () => {
    const keys = keysFor("we need a good plan now");
    expect(advanceMatch(1, ["plan"], keys)).toBe(4);
  });

  it("does not skip past a long unmatched word", () => {
    const keys = keysFor("alpha bravo charlie delta echo");
    expect(advanceMatch(0, ["echo"], keys)).toBe(0);
  });
});
