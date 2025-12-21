// hooks/useVoiceRecognition.ts
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
  
  // Refs to handle "keep-alive" logic without triggering re-renders
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldBeListeningRef = useRef(false);

  useEffect(() => {
    // Cross-browser support (Chrome/Safari/Edge)
    const SpeechRecognitionConstructor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      setError("Browser not supported. Please use Chrome or Safari.");
      return;
    }

    recognitionRef.current = new SpeechRecognitionConstructor();
    const recognition = recognitionRef.current;

    if (recognition) {
      recognition.continuous = true; // Essential for long scripts
      recognition.interimResults = true; // Faster feedback
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const alt = result[0];
          
          // Sensitivity Check: Ignore low-confidence murmurs (< 50% confidence)
          // Note: 'interim' results often have low confidence, so we only filter 'final' results hard.
          if (result.isFinal && alt.confidence < 0.5) {
             continue; 
          }
          interimTranscript += alt.transcript;
        }
        setTranscript(interimTranscript.toLowerCase());
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // "no-speech" is common when the user pauses. We ignore it to keep the UI clean.
        if (event.error !== "no-speech") {
          console.error("Speech error:", event.error);
          // Only show fatal errors
          if (event.error === "not-allowed" || event.error === "service-not-allowed") {
             setError("Microphone permission denied.");
             setIsListening(false);
             shouldBeListeningRef.current = false;
          }
        }
      };

      // Auto-restart logic for Safari (which stops listening after silence)
      recognition.onend = () => {
        if (shouldBeListeningRef.current) {
          try {
            recognition.start();
          } catch (e) {
            // Ignore errors if it's already started
          }
        } else {
          setIsListening(false);
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    if (recognitionRef.current) {
      try {
        shouldBeListeningRef.current = true;
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Start error:", e);
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      shouldBeListeningRef.current = false;
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  const resetTranscript = () => setTranscript("");

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    resetTranscript,
    hasSupport: !!recognitionRef.current,
  };
}