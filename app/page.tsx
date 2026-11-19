"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useVoiceRecognition } from "./hooks/useVoiceRecognition";
import { usePersistedSettings } from "./hooks/usePersistedSettings";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { COLOR_THEMES, FONT_SIZES, type ColorTheme } from "./lib/savedSettings";
import { advanceMatch, buildMatchKeys, positionAtWord, wordAtPosition } from "./lib/matcher";
import {
  Square, AlignLeft, MousePointer2, Type, RotateCcw,
  Settings2, X, AlertTriangle, Play, MessageSquare
} from "lucide-react";
import { clsx } from "clsx";

type Mode = "flow" | "highlight" | "caret";
const MODES: Mode[] = ["flow", "highlight", "caret"];

const COLOR_HEX: Record<ColorTheme, string> = {
  green: "#1db954",
  yellow: "#eab308",
  blue: "#3b82f6",
  white: "#ffffff",
};

interface TallyApi {
  openPopup: (formId: string, options: Record<string, unknown>) => void;
}

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

export default function Page() {
  return (
    <ErrorBoundary>
      <VoiceReader />
    </ErrorBoundary>
  );
}

function VoiceReader() {
  const { settings, updateSettings } = usePersistedSettings();
  const { script, fontSize, themeColor } = settings;

  const [mode, setMode] = useState<Mode>("flow");
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  // Position in the match keys of the last word the tracker has read (-1 for none).
  const [matchPosition, setMatchPosition] = useState(-1);

  const activeWordRef = useRef<HTMLSpanElement | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

  const scriptWords = useMemo(() => script.split(/\s+/).filter(w => w.length > 0), [script]);
  const matchKeys = useMemo(() => buildMatchKeys(scriptWords), [scriptWords]);
  const activeIndex = wordAtPosition(matchKeys, matchPosition);

  // Each result passes only its new words. Matching runs on those words and
  // nothing is kept, so a word is never matched twice.
  const handleSpokenWords = useCallback(
    (tokens: string[]) => setMatchPosition(previous => advanceMatch(previous, tokens, matchKeys)),
    [matchKeys]
  );

  const { isListening, error, hasSupport, startListening, stopListening } =
    useVoiceRecognition(handleSpokenWords);

  const activeColor = COLOR_HEX[themeColor];

  // Wake Lock
  useEffect(() => {
    const wakeLockNavigator = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    };
    let cancelled = false;
    if (isListening && wakeLockNavigator.wakeLock) {
      wakeLockNavigator.wakeLock.request("screen").then(lock => {
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        wakeLockRef.current = lock;
      }).catch(() => {});
    }
    return () => {
      cancelled = true;
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [isListening]);

  // Debounced Auto-Scroll
  useEffect(() => {
    if (isAutoScroll && activeWordRef.current) {
      const tid = setTimeout(() => {
        activeWordRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return () => clearTimeout(tid);
    }
  }, [activeIndex, isAutoScroll]);

  // --- Tally Popup Handler ---
  const openFeedbackForm = () => {
    const tally = (window as Window & { Tally?: TallyApi }).Tally;
    if (tally) {
      tally.openPopup("0QlVWj", {
        layout: "modal",
        width: 700,
        autoClose: 5000,
        emoji: {
          text: "👋",
          animation: "wave"
        },
        hiddenFields: {
          // Passing context to Tally
          theme: themeColor,
          size: fontSize
        }
      });
    } else {
      console.warn("Tally script hasn't loaded yet.");
    }
  };

  return (
    <div className="h-[100dvh] w-full bg-[#121212] text-white flex flex-col font-sans overflow-hidden">
      <header className="flex-none bg-[#121212]/90 backdrop-blur-sm border-b border-[#282828] p-4 md:p-5 z-50">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
             <Image src="/Image.png" alt="Logo" width={460} height={80} priority className="h-9 md:h-10 w-auto" />
             <h1 className="hidden xs:block text-lg font-extrabold">Sync<span className="text-[#b3b3b3]">Prompter</span>.</h1>
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={openFeedbackForm}
              className="bg-[#2a2a2a] px-4 py-2 rounded-full text-xs font-bold text-[#b3b3b3] hover:text-white flex items-center gap-2 transition-colors"
            >
              <MessageSquare size={16} />
              <span className="hidden xs:inline">Feedback</span>
            </button>
            <button onClick={() => setShowSettings(!showSettings)} className="bg-[#2a2a2a] p-3 rounded-full text-[#b3b3b3] hover:text-white">
              {showSettings ? <X size={18} /> : <Settings2 size={18} />}
            </button>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="absolute right-4 top-20 w-64 bg-[#181818] border border-[#333] rounded-2xl shadow-2xl p-4 flex flex-col gap-4 z-50">
          <div className="space-y-2"><label className="text-[10px] font-bold text-[#b3b3b3] uppercase">Size</label><div className="flex bg-[#2a2a2a] rounded-lg p-1">{FONT_SIZES.map((s, i) => (<button key={s} onClick={() => updateSettings({ fontSize: s })} className={clsx("flex-1 py-2 rounded-md text-xs font-bold", fontSize === s ? "bg-[#333] text-white" : "text-[#777]")}>A{i+1}</button>))}</div></div>
          <div className="space-y-2"><label className="text-[10px] font-bold text-[#b3b3b3] uppercase">Color</label><div className="flex justify-between px-2">{COLOR_THEMES.map(c => (<button key={c} onClick={() => updateSettings({ themeColor: c })} className={clsx("w-6 h-6 rounded-full border-2", themeColor === c ? "border-white scale-125" : "border-transparent")} style={{ backgroundColor: COLOR_HEX[c] }} />))}</div></div>
          <div className="pt-2 border-t border-[#333] flex justify-between items-center"><span className="text-xs text-[#b3b3b3]">Auto-Scroll</span><button onClick={() => setIsAutoScroll(!isAutoScroll)} className="text-xs font-bold" style={{ color: isAutoScroll ? activeColor : '#666' }}>{isAutoScroll ? "ON" : "OFF"}</button></div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth p-6 md:p-12" onClick={() => setShowSettings(false)}>
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          {error && <div className="mb-6 bg-red-900/50 text-red-200 p-4 rounded-xl text-sm w-full"><AlertTriangle className="inline mr-2" size={16}/>{error}</div>}

          {!isListening && activeIndex === -1 && (
            <textarea className="w-full bg-[#2a2a2a] text-[#b3b3b3] p-6 rounded-2xl h-40 text-lg mb-8 outline-none focus:ring-1" style={{ '--tw-ring-color': activeColor } as React.CSSProperties} value={script} onChange={e => updateSettings({ script: e.target.value })} />
          )}

          <div className={clsx("w-full font-bold leading-normal flex flex-wrap gap-x-3 gap-y-4 pb-[50vh]", fontSize)}>
            {scriptWords.map((word, idx) => {
              const active = idx === activeIndex;
              const past = idx <= activeIndex;

              return (
                <span
                  key={idx}
                  data-word-index={idx}
                  aria-current={active ? "true" : undefined}
                  ref={active ? activeWordRef : null}
                  onClick={() => setMatchPosition(positionAtWord(matchKeys, idx))}
                  className={clsx("cursor-pointer transition-all duration-200", past ? "text-white blur-0" : "text-[#404040] blur-[0.5px] hover:text-[#777]", active && mode === "flow" && "scale-110")}
                  style={active && mode === "flow" ? { color: activeColor } : {}}
                >
                  {mode === "highlight" && active ? <span className="px-2 rounded text-black" style={{ backgroundColor: activeColor }}>{word}</span> : word}
                </span>
              );
            })}
          </div>
        </div>
      </main>

      <footer className="flex-none bg-black border-t border-[#282828] p-6 pb-10">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button aria-label="Reset" onClick={() => { stopListening(); setMatchPosition(-1); }} className="text-[#b3b3b3] hover:text-white p-3"><RotateCcw size={22} /></button>
          {!isListening ? (
            <button onClick={startListening} disabled={!hasSupport || script.trim().length === 0} className="bg-white text-black rounded-full py-4 px-10 font-bold flex items-center gap-2 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              <Play fill="black" size={24}/>Read
            </button>
          ) : (
            <button onClick={stopListening} aria-label="Stop" className="rounded-full p-4 animate-pulse shadow-lg" style={{ backgroundColor: activeColor }}><Square fill="black" size={24}/></button>
          )}
          <div className="flex bg-[#222] p-1 rounded-full border border-[#333]">
            {MODES.map(m => (
              <button key={m} onClick={() => setMode(m)} className={clsx("p-2 rounded-full", mode === m ? "bg-[#333] text-white" : "text-[#777]")}>
                {m === "flow" ? <AlignLeft size={18}/> : m === "highlight" ? <Type size={18}/> : <MousePointer2 size={18}/>}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
