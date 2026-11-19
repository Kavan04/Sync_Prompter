import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { wordKeys } from "../lib/matcher";

// Types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;

  onstart: (() => void) | null;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognition;
interface SpeechRecognitionWindow {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

const UNSUPPORTED_MESSAGE = "Browser not supported. Please use Chrome or Safari.";
const FAILED_INIT_MESSAGE = "Failed to initialize speech recognition.";
const START_FAILED_MESSAGE = "Speech recognition could not start. Press Read to try again.";
const RESTART_FAILED_MESSAGE = "Speech recognition could not restart. Press Read to try again.";
const UNEXPECTED_STOP_MESSAGE = "Speech recognition stopped unexpectedly. Please try again.";

// Errors that stop listening at once. Retrying them would fail the same way.
const FATAL_ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow the microphone for this site, then press Read.",
  "service-not-allowed": "The browser's speech service is not allowed here. Try Chrome on a secure (https) page.",
  "audio-capture": "No microphone was found, or it could not be used. Check your microphone, then press Read.",
  network: "Speech recognition lost its network connection to the browser's speech service. Check your connection, then press Read.",
};

// Sessions that end without ever starting, in a row, before listening gives up.
const MAX_CONSECUTIVE_FAILURES = 5;
const RESTART_DELAY_MS = 300;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};

// Match keys of `current` after the earliest point where the keys of `reported`
// are all aligned with it, in a longest common subsequence. Keys are the matcher's
// own forms, so "21" and "twenty one" are the same words. The recognizer may
// extend, revise or shorten its hypothesis, so the reported words are aligned by
// content rather than counted.
export function unreportedWords(reported: string[], current: string[]): string[] {
  const reportedKeys = reported.flatMap(wordKeys);
  const currentKeys = current.flatMap(wordKeys);
  const lengths = Array.from({ length: reportedKeys.length + 1 }, () => new Array<number>(currentKeys.length + 1).fill(0));
  for (let i = 1; i <= reportedKeys.length; i += 1) {
    for (let j = 1; j <= currentKeys.length; j += 1) {
      lengths[i][j] =
        reportedKeys[i - 1] === currentKeys[j - 1]
          ? lengths[i - 1][j - 1] + 1
          : Math.max(lengths[i - 1][j], lengths[i][j - 1]);
    }
  }
  const row = lengths[reportedKeys.length];
  return currentKeys.slice(row.indexOf(row[currentKeys.length]));
}

type SupportState = "unknown" | "supported" | "unsupported";

// "unknown" on the server, so the first render matches the server output.
const getSupportState = (): SupportState => (getSpeechRecognitionConstructor() ? "supported" : "unsupported");

interface SpeechSetup {
  recognition: SpeechRecognition | null;
  error: string | null;
}

function createSpeechRecognition(): SpeechSetup {
  const Constructor = getSpeechRecognitionConstructor();
  if (!Constructor) return { recognition: null, error: null };
  try {
    return { recognition: new Constructor(), error: null };
  } catch (e) {
    console.error("Speech recognition init error:", e);
    return { recognition: null, error: FAILED_INIT_MESSAGE };
  }
}

// Calls onWords with the words that are new since the previous result. The
// recognizer re-sends the in-progress hypothesis, so words that were already
// reported in this session are left out.
export function useVoiceRecognition(onWords: (tokens: string[]) => void) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const support = useSyncExternalStore(noopSubscribe, getSupportState, (): SupportState => "unknown");
  const [speech] = useState(createSpeechRecognition);
  const hasSupport = support === "supported" && speech.recognition !== null;

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onWordsRef = useRef(onWords);
  const shouldBeListeningRef = useRef(false);
  // start() has been called and onend has not fired yet.
  const sessionActiveRef = useRef(false);
  // onstart has fired for the current start() call.
  const sessionStartedRef = useRef(false);
  const failedStartsRef = useRef(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Words already reported in the current session, by result index.
  const reportedRef = useRef<string[][]>([]);

  useEffect(() => {
    onWordsRef.current = onWords;
  }, [onWords]);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const stopWithError = useCallback(
    (message: string) => {
      shouldBeListeningRef.current = false;
      clearRestartTimer();
      setIsListening(false);
      setError(message);
    },
    [clearRestartTimer]
  );

  // Returns false when the browser refuses to start the recognizer.
  const beginSession = useCallback((): boolean => {
    const recognition = recognitionRef.current;
    if (!recognition) return false;
    sessionActiveRef.current = true;
    sessionStartedRef.current = false;
    try {
      recognition.start();
      return true;
    } catch (e) {
      sessionActiveRef.current = false;
      console.error("Start error:", e);
      return false;
    }
  }, []);

  const scheduleRestart = useCallback(() => {
    clearRestartTimer();
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (!shouldBeListeningRef.current) return;
      if (!beginSession()) stopWithError(RESTART_FAILED_MESSAGE);
    }, RESTART_DELAY_MS);
  }, [beginSession, clearRestartTimer, stopWithError]);

  useEffect(() => {
    // Read back through the ref: the recognizer is configured here, and a
    // value returned by useState must not be mutated directly.
    recognitionRef.current = speech.recognition;
    const recognition = recognitionRef.current;
    if (!recognition) return;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      sessionStartedRef.current = true;
      reportedRef.current = [];
      if (shouldBeListeningRef.current) setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const reported = reportedRef.current;
      const previous = reported.slice(event.resultIndex).flat();
      reported.length = event.resultIndex;
      const current: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const words = event.results[i][0].transcript.split(/\s+/).filter(word => word.length > 0);
        reported[i] = words;
        current.push(...words);
      }
      const tokens = unreportedWords(previous, current);
      if (tokens.length === 0) return;

      failedStartsRef.current = 0;
      if (shouldBeListeningRef.current) onWordsRef.current(tokens);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      console.error("Speech error:", event.error);
      const message = FATAL_ERROR_MESSAGES[event.error];
      if (message) stopWithError(message);
    };

    recognition.onend = () => {
      sessionActiveRef.current = false;
      if (!shouldBeListeningRef.current) {
        setIsListening(false);
        return;
      }
      // A session that never started counts against the restart limit.
      // Sessions that start and then end (silence) do not.
      if (!sessionStartedRef.current) failedStartsRef.current += 1;
      if (failedStartsRef.current >= MAX_CONSECUTIVE_FAILURES) {
        stopWithError(UNEXPECTED_STOP_MESSAGE);
        return;
      }
      scheduleRestart();
    };

    return () => {
      shouldBeListeningRef.current = false;
      clearRestartTimer();
      sessionActiveRef.current = false;
      recognitionRef.current = null;
      try {
        recognition.abort();
      } catch {
        // Already stopped.
      }
    };
  }, [speech, clearRestartTimer, scheduleRestart, stopWithError]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    setError(null);
    shouldBeListeningRef.current = true;
    failedStartsRef.current = 0;
    clearRestartTimer();
    // Already starting or running. onstart and onend update the state.
    if (sessionActiveRef.current) return;
    if (!beginSession()) stopWithError(START_FAILED_MESSAGE);
  }, [beginSession, clearRestartTimer, stopWithError]);

  const stopListening = useCallback(() => {
    shouldBeListeningRef.current = false;
    clearRestartTimer();
    if (sessionActiveRef.current) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Already stopped.
      }
    }
    setIsListening(false);
  }, [clearRestartTimer]);

  return {
    isListening,
    error: error ?? (support === "supported" ? speech.error : null) ?? (support === "unsupported" ? UNSUPPORTED_MESSAGE : null),
    hasSupport,
    startListening,
    stopListening,
  };
}
