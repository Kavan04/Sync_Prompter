import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom does not implement scrollIntoView, which the auto-scroll effect calls.
Element.prototype.scrollIntoView = () => {};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
  FakeSpeechRecognition.reset();
});

// Minimal stand-in for the Web Speech API. Results are cumulative within a
// session, the way Chrome reports them: an in-progress segment is re-sent with
// its whole hypothesis, and a final segment is appended to the results list.
// Chrome may also send an in-progress segment as a stable and an unstable
// result, and then close it as one final result at the lower index.
export class FakeSpeechRecognition {
  static instances: FakeSpeechRecognition[] = [];
  static startError: ((call: number) => Error | null) | null = null;

  static reset() {
    FakeSpeechRecognition.instances = [];
    FakeSpeechRecognition.startError = null;
  }

  static last(): FakeSpeechRecognition {
    const instance = FakeSpeechRecognition.instances.at(-1);
    if (!instance) throw new Error("no recognizer was created");
    return instance;
  }

  continuous = false;
  interimResults = false;
  lang = "";
  startCalls = 0;
  stopCalls = 0;
  abortCalls = 0;
  results: { isFinal: boolean; 0: { transcript: string; confidence: number } }[] = [];

  onstart: (() => void) | null = null;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;

  constructor() {
    FakeSpeechRecognition.instances.push(this);
  }

  start() {
    this.startCalls += 1;
    const error = FakeSpeechRecognition.startError?.(this.startCalls);
    if (error) throw error;
  }

  stop() {
    this.stopCalls += 1;
  }

  abort() {
    this.abortCalls += 1;
  }

  // The browser reports that a session has begun.
  fireStart() {
    this.onstart?.();
  }

  // Speech in the current segment. Interim text replaces the in-progress
  // segment; a final segment is closed and the next speech starts a new one.
  speak(text: string, isFinal = false) {
    this.replaceInProgress([{ isFinal, 0: { transcript: text, confidence: 0.9 } }]);
  }

  // Interim speech in the current segment, sent as a stable and an unstable
  // result from the same result index.
  speakSplit(stable: string, unstable: string) {
    this.replaceInProgress([
      { isFinal: false, 0: { transcript: stable, confidence: 0.9 } },
      { isFinal: false, 0: { transcript: unstable, confidence: 0.9 } },
    ]);
  }

  // The recognizer delivers the last result again with no new speech.
  redeliverLast() {
    this.emitResult(this.results.length - 1);
  }

  fireError(error: string) {
    this.onerror?.({ error });
  }

  fireEnd() {
    this.onend?.();
  }

  private replaceInProgress(results: FakeSpeechRecognition["results"]) {
    const inProgress = this.results.findIndex(result => !result.isFinal);
    const start = inProgress === -1 ? this.results.length : inProgress;
    this.results.splice(start, this.results.length - start, ...results);
    this.emitResult(start);
  }

  private emitResult(resultIndex: number) {
    this.onresult?.({ resultIndex, results: this.results });
  }
}

Object.defineProperty(window, "webkitSpeechRecognition", {
  configurable: true,
  writable: true,
  value: FakeSpeechRecognition,
});
