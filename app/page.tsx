"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useVoiceRecognition } from "./hooks/useVoiceRecognition";
import { 
  Mic, Square, AlignLeft, MousePointer2, Type, RotateCcw, 
  Settings2, X, AlertTriangle, Play, MessageSquare
} from "lucide-react";
import { clsx } from "clsx";
import levenshtein from "fast-levenshtein";

// --- Types ---
type FontSize = "text-xl" | "text-2xl" | "text-4xl" | "text-6xl"; 
type FontFamily = "font-sans" | "font-serif" | "font-mono";
type ColorTheme = "green" | "yellow" | "blue" | "white";

const UNITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

const numberToWords = (numStr: string): string => {
  const n = parseInt(numStr, 10);
  if (isNaN(n)) return numStr;
  if (n < 20) return UNITS[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 !== 0 ? UNITS[n % 10] : "");
  return numStr;
};

const normalizeWord = (w: string) => {
  const clean = w.toLowerCase().replace(/[^a-z0-9]/gi, "");
  if (/^\d+$/.test(clean)) return numberToWords(clean);
  return clean;
};

// True non-lexical filler sounds only — common pronouns/words like "i", "you",
// "so" are real script content and must not be stripped from the spoken stream.
const FILLER = new Set(["um", "uh", "erm", "hmm", "mhm"]);

const MATCH_SHORT_WORD_THRESHOLD = 4;
const MATCH_SHORT_THRESHOLD = 0.95;
const MATCH_LONG_THRESHOLD = 0.82;
const JUMP_WINDOW = 8;
const JUMP_MIN_WORD_LENGTH = 5;
const JUMP_THRESHOLD = 0.9;

const similarity = (a: string, b: string) =>
  a === b ? 1 : 1 - levenshtein.get(a, b) / Math.max(a.length, b.length);

export default function VoiceReader() {
  const { isListening, transcript, error, startListening, stopListening, clearTranscript, hasSupport } =
    useVoiceRecognition();

  const [script, setScript] = useState(
    "Your script goes here. We’ll handle the flow."
  );

  const [activeIndex, setActiveIndex] = useState(-1);
  const [mode, setMode] = useState<"flow" | "highlight" | "caret">("flow");
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>("text-2xl"); 
  const [fontFamily, setFontFamily] = useState<FontFamily>("font-sans");
  const [themeColor, setThemeColor] = useState<ColorTheme>("green");

  const activeWordRef = useRef<HTMLSpanElement | null>(null);
  const wakeLockRef = useRef<any>(null);

  const scriptWords = useMemo(() => script.split(/\s+/).filter(w => w.length > 0), [script]);

  // Normalized once per script edit instead of on every transcript update.
  const cleanScript = useMemo(() => scriptWords.map(normalizeWord), [scriptWords]);

  const scriptChunks = useMemo(() => {
    const chunks = [];
    let currentChunk: { words: string[], startIndex: number } = { words: [], startIndex: 0 };
    scriptWords.forEach((word, index) => {
      currentChunk.words.push(word);
      if (/[.!?]$/.test(word) || currentChunk.words.length > 25) {
        chunks.push(currentChunk);
        currentChunk = { words: [], startIndex: index + 1 };
      }
    });
    if (currentChunk.words.length > 0) chunks.push(currentChunk);
    return chunks;
  }, [scriptWords]);

  const activeChunkIndex = useMemo(() => {
    if (activeIndex === -1) return -1;
    return scriptChunks.findIndex(c => activeIndex >= c.startIndex && activeIndex < c.startIndex + c.words.length);
  }, [activeIndex, scriptChunks]);

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem("syncprompter-state");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.script) setScript(p.script);
        if (p.fontSize) setFontSize(p.fontSize);
        if (p.themeColor) setThemeColor(p.themeColor);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("syncprompter-state", JSON.stringify({ script, fontSize, themeColor }));
  }, [script, fontSize, themeColor]);

  // Wake Lock
  useEffect(() => {
    const req = async () => {
      if (isListening && 'wakeLock' in navigator) {
        try { wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch(e) {}
      }
    };
    req();
    return () => { if (wakeLockRef.current) wakeLockRef.current.release(); };
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

  // --- ANCHOR-BASED MATCHING ENGINE ---
  useEffect(() => {
    if (!isListening || !transcript) return;

    const spokenWords = transcript.split(/\s+/).map(normalizeWord).filter(w => w && !FILLER.has(w));

    let tempIndex = activeIndex;
    let matchOccurred = false;

    for (const spokenWord of spokenWords) {
      // 1. TRY IMMEDIATE NEXT WORD (Priority)
      const nextIdx = tempIndex + 1;
      if (nextIdx < cleanScript.length) {
        const scriptWord = cleanScript[nextIdx];
        const isShort = scriptWord.length <= MATCH_SHORT_WORD_THRESHOLD;
        const threshold = isShort ? MATCH_SHORT_THRESHOLD : MATCH_LONG_THRESHOLD;

        if (similarity(scriptWord, spokenWord) >= threshold) {
          tempIndex = nextIdx;
          matchOccurred = true;
          continue;
        }

        // 1b. TOLERATE A SINGLE SKIPPED SHORT SCRIPT WORD (e.g. "a", "the")
        // that the speaker glossed over or the recognizer merged.
        const skipIdx = nextIdx + 1;
        if (scriptWord.length <= MATCH_SHORT_WORD_THRESHOLD && skipIdx < cleanScript.length) {
          const afterSkip = cleanScript[skipIdx];
          const skipThreshold = afterSkip.length <= MATCH_SHORT_WORD_THRESHOLD ? MATCH_SHORT_THRESHOLD : MATCH_LONG_THRESHOLD;
          if (similarity(afterSkip, spokenWord) >= skipThreshold) {
            tempIndex = skipIdx;
            matchOccurred = true;
            continue;
          }
        }
      }

      // 2. SEARCH FOR JUMP (Only for "Strong Words")
      // We only allow jumping forward if the word is long and unique enough
      if (spokenWord.length >= JUMP_MIN_WORD_LENGTH) {
        for (let i = 2; i <= JUMP_WINDOW; i++) {
          const idx = tempIndex + i;
          if (idx >= cleanScript.length) break;

          const scriptWord = cleanScript[idx];
          // Check if this word is a duplicate in the immediate area
          const occurrences = cleanScript.slice(tempIndex + 1, tempIndex + JUMP_WINDOW + 2).filter(w => w === scriptWord).length;

          // Only jump if the word is unique in the local window (occurrence === 1)
          if (occurrences === 1 && similarity(scriptWord, spokenWord) > JUMP_THRESHOLD) {
            tempIndex = idx;
            matchOccurred = true;
            break;
          }
        }
      }
    }

    if (matchOccurred && tempIndex > activeIndex) {
      setActiveIndex(tempIndex);
      clearTranscript();
    }
  }, [transcript, activeIndex, cleanScript, isListening, clearTranscript]);

  // --- Tally Popup Handler ---
  const openFeedbackForm = () => {
    if (typeof window !== "undefined" && (window as any).Tally) {
      (window as any).Tally.openPopup('0QlVWj', {
        layout: 'modal',
        width: 700,
        autoClose: 5000,
        emoji: {
          text: '👋',
          animation: 'wave'
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

  const activeColor = themeColor === "yellow" ? "#eab308" : themeColor === "blue" ? "#3b82f6" : themeColor === "white" ? "#ffffff" : "#1db954";

  return (
    <div className={`h-[100dvh] w-full bg-[#121212] text-white flex flex-col ${fontFamily} overflow-hidden`}>
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
          <div className="space-y-2"><label className="text-[10px] font-bold text-[#b3b3b3] uppercase">Size</label><div className="flex bg-[#2a2a2a] rounded-lg p-1">{(["text-xl", "text-2xl", "text-4xl", "text-6xl"] as FontSize[]).map((s, i) => (<button key={s} onClick={() => setFontSize(s)} className={clsx("flex-1 py-2 rounded-md text-xs font-bold", fontSize === s ? "bg-[#333] text-white" : "text-[#777]")}>A{i+1}</button>))}</div></div>
          <div className="space-y-2"><label className="text-[10px] font-bold text-[#b3b3b3] uppercase">Color</label><div className="flex justify-between px-2">{(["green", "yellow", "blue", "white"] as ColorTheme[]).map(c => (<button key={c} onClick={() => setThemeColor(c)} className={clsx("w-6 h-6 rounded-full border-2", themeColor === c ? "border-white scale-125" : "border-transparent")} style={{ backgroundColor: c === 'green' ? '#1db954' : c === 'yellow' ? '#eab308' : c === 'blue' ? '#3b82f6' : '#ffffff' }} />))}</div></div>
          <div className="pt-2 border-t border-[#333] flex justify-between items-center"><span className="text-xs text-[#b3b3b3]">Auto-Scroll</span><button onClick={() => setIsAutoScroll(!isAutoScroll)} className="text-xs font-bold" style={{ color: isAutoScroll ? activeColor : '#666' }}>{isAutoScroll ? "ON" : "OFF"}</button></div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth p-6 md:p-12" onClick={() => setShowSettings(false)}>
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          {error && <div className="mb-6 bg-red-900/50 text-red-200 p-4 rounded-xl text-sm w-full"><AlertTriangle className="inline mr-2" size={16}/>{error}</div>}
          
          {!isListening && activeIndex === -1 && (
            <textarea className="w-full bg-[#2a2a2a] text-[#b3b3b3] p-6 rounded-2xl h-40 text-lg mb-8 outline-none focus:ring-1" style={{ '--tw-ring-color': activeColor } as any} value={script} onChange={e => setScript(e.target.value)} />
          )}

          <div className={clsx("w-full font-bold leading-normal flex flex-wrap gap-x-3 gap-y-4 pb-[50vh]", fontSize)}>
            {scriptChunks.map((chunk, cIdx) => {
              const isNear = activeChunkIndex === -1 || Math.abs(cIdx - activeChunkIndex) <= 1;
              const isPast = cIdx < activeChunkIndex;
              
              return chunk.words.map((word, wIdx) => {
                const idx = chunk.startIndex + wIdx;
                const active = idx === activeIndex;
                const past = idx <= activeIndex;
                
                if (!isNear) {
                    return <span key={idx} className={clsx("transition-all", past ? "text-white" : "text-[#404040] blur-[0.5px]")}>{word}</span>;
                }

                return (
                  <span key={idx} data-word-index={idx} aria-current={active ? "true" : undefined} ref={active ? activeWordRef : null} onClick={() => setActiveIndex(idx)} className={clsx("cursor-pointer transition-all duration-200", past ? "text-white blur-0" : "text-[#404040] blur-[0.5px] hover:text-[#777]", active && mode === "flow" && "scale-110")} style={active && mode === "flow" ? { color: activeColor } : {}}>
                    {mode === "highlight" && active ? <span className="px-2 rounded text-black" style={{ backgroundColor: activeColor }}>{word}</span> : word}
                  </span>
                );
              });
            })}
          </div>
        </div>
      </main>

      <footer className="flex-none bg-black border-t border-[#282828] p-6 pb-10">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button onClick={() => { stopListening(); setActiveIndex(-1); }} className="text-[#b3b3b3] hover:text-white p-3"><RotateCcw size={22} /></button>
          {!isListening ? (
            <button onClick={startListening} disabled={!hasSupport || script.trim().length === 0} className="bg-white text-black rounded-full py-4 px-10 font-bold flex items-center gap-2 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              <Play fill="black" size={24}/>Read
            </button>
          ) : (
            <button onClick={stopListening} aria-label="Stop" className="rounded-full p-4 animate-pulse shadow-lg" style={{ backgroundColor: activeColor }}><Square fill="black" size={24}/></button>
          )}
          <div className="flex bg-[#222] p-1 rounded-full border border-[#333]">
            {(["flow", "highlight", "caret"] as any[]).map(m => (
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