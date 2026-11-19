// Spoken forms of numbers. A digit token in the script and a spoken number are
// both turned into the same sequence of words, so "100" matches "one hundred"
// and "2026" matches "twenty twenty six". The mapping is fixed, not adaptive.

const UNITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

const ORDINAL_UNITS = ["zeroth", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth"];
const ORDINAL_TENS = ["", "", "twentieth", "thirtieth", "fortieth", "fiftieth", "sixtieth", "seventieth", "eightieth", "ninetieth"];

// Largest value that is spoken in words. Anything bigger keeps its digits.
const MAX_SPOKEN = 999999;

// Words for an integer from 0 to 999,999. Years from 1100 to 2099 use the
// spoken year form ("twenty twenty six"); other values use hundreds and
// thousands ("one hundred", "one thousand").
export function numberWords(n: number): string[] {
  if (n > MAX_SPOKEN) return [String(n)];
  if (n < 20) return [UNITS[n]];
  if (n < 100) {
    const units = n % 10;
    return units === 0 ? [TENS[Math.floor(n / 10)]] : [TENS[Math.floor(n / 10)], UNITS[units]];
  }
  if (n < 1000) {
    const rest = n % 100;
    return [UNITS[Math.floor(n / 100)], "hundred", ...(rest ? numberWords(rest) : [])];
  }
  const rest = n % 100;
  if (n >= 1100 && n <= 2099 && rest !== 0) {
    return [...numberWords(Math.floor(n / 100)), ...(rest < 10 ? ["oh", UNITS[rest]] : numberWords(rest))];
  }
  const remainder = n % 1000;
  return [...numberWords(Math.floor(n / 1000)), "thousand", ...(remainder ? numberWords(remainder) : [])];
}

// Words for an ordinal from 0 to 99 ("21" is "twenty first"). Returns null for
// larger values, which keep their digits.
export function ordinalWords(n: number): string[] | null {
  if (n < 20) return [ORDINAL_UNITS[n]];
  if (n < 100) {
    const units = n % 10;
    return units === 0 ? [ORDINAL_TENS[Math.floor(n / 10)]] : [TENS[Math.floor(n / 10)], ORDINAL_UNITS[units]];
  }
  return null;
}

const NUMBER_PARTS = new Set([
  ...UNITS,
  ...TENS.filter(Boolean),
  ...ORDINAL_UNITS,
  ...ORDINAL_TENS.filter(Boolean),
  "hundred",
  "thousand",
  "oh",
]);

// True for a single word that a spoken number is made of, such as "twenty" or "first".
export const isSpokenNumberPart = (word: string) => NUMBER_PARTS.has(word);
