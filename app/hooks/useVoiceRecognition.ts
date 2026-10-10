import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

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

// Words of `current` that were not reported yet. The recognizer may extend its
// hypothesis, revise its front, or resend a shorter part of it, so the reported
// words are compared by content rather than counted.
function unreportedWords(reported: string[], current: string[]): string[] {
  for (let at = 0; at + current.length <= reported.length; at += 1) {
    if (current.every((word, i) => reported[at + i] === word)) return [];
  }
  for (let overlap = Math.min(reported.length, current.length); overlap > 0; overlap -= 1) {
    const tail = reported.length - overlap;
    if (current.slice(0, overlap).every((word, i) => reported[tail + i] === word)) return current.slice(overlap);
  }
  return current;
}

type SupportState = "unknown" | "supported" | "unsupported";

// "unknown" on the server, so the first render matches the server output.
const getSupportState = (): SupportState => (getSpeechRecognitionConstructor() ? "supported" : "unsupported");

// Calls onWords with the words that are new since the previous result. The
// recognizer re-sends the in-progress hypothesis, so words that were already
// reported in this session are left out.
export function useVoiceRecognition(onWords: (tokens: string[]) => void) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const support = useSyncExternalStore(noopSubscribe, getSupportState, (): SupportState => "unknown");
  const hasSupport = support === "supported";

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onWordsRef = useRef(onWords);
  const shouldBeListeningRef = useRef(false);
  // start() has been called and onend has not fired yet.
  const sessionActiveRef = useRef(false);
  // onstart has fired for the current start() call.
  const sessionStartedRef = useRef(false);
  const failedStartsRef = useRef(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Words already reported for each result index in the current session.
  const reportedRef = useRef(new Map<number, string[]>());

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
    const Constructor = getSpeechRecognitionConstructor();
    if (!Constructor) return;

    // If the constructor throws, the error reaches the page's error boundary.
    const recognition = new Constructor();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      sessionStartedRef.current = true;
      reportedRef.current.clear();
      if (shouldBeListeningRef.current) setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const tokens: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const words = event.results[i][0].transcript.split(/\s+/).filter(word => word.length > 0);
        tokens.push(...unreportedWords(reportedRef.current.get(i) ?? [], words));
        reportedRef.current.set(i, words);
      }
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
  }, [clearRestartTimer, scheduleRestart, stopWithError]);

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
    error: error ?? (support === "unsupported" ? UNSUPPORTED_MESSAGE : null),
    hasSupport,
    startListening,
    stopListening,
  };
}
