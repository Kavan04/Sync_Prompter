import { useState, useEffect, useRef, useCallback } from "react";

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
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

export function useVoiceRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldBeListeningRef = useRef(false);
  const isStartedRef = useRef(false);

  useEffect(() => {
    const SpeechRecognitionConstructor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      setError("Browser not supported. Please use Chrome or Safari.");
      return;
    }

    try {
      recognitionRef.current = new SpeechRecognitionConstructor();
      const recognition = recognitionRef.current;

      if (recognition) {
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let currentTranscript = "";
          // We only take the most recent result segment to prevent backlog jumping
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          if (currentTranscript.trim()) {
            setTranscript(currentTranscript.toLowerCase());
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          if (event.error === "aborted") return;
          if (event.error !== "no-speech") {
            console.error("Speech error:", event.error);
          }
        };

        recognition.onstart = () => { isStartedRef.current = true; };
        recognition.onend = () => {
          isStartedRef.current = false;
          if (shouldBeListeningRef.current) {
            try { recognition.start(); } catch (e) {}
          } else {
            setIsListening(false);
          }
        };
      }
    } catch (e) { setError("Failed to initialize speech recognition."); }

    return () => {
      if (recognitionRef.current) {
        shouldBeListeningRef.current = false;
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    setTranscript("");
    if (recognitionRef.current) {
      try {
        shouldBeListeningRef.current = true;
        if (!isStartedRef.current) recognitionRef.current.start();
        setIsListening(true);
      } catch (e) { console.error("Start error:", e); }
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldBeListeningRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      setIsListening(false);
    }
  }, []);

  const clearTranscript = useCallback(() => setTranscript(""), []);

  return { 
    isListening, 
    transcript, 
    error, 
    startListening, 
    stopListening, 
    clearTranscript, // Added for consumption
    hasSupport: !!recognitionRef.current 
  };
}
