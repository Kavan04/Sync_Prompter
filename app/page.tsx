"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useVoiceRecognition } from "./hooks/useVoiceRecognition";
import { Mic, Square, AlignLeft, MousePointer2, Type, RotateCcw } from "lucide-react";
import { clsx } from "clsx";

export default function VoiceReader() {
  const { isListening, transcript, startListening, stopListening, hasSupport, resetTranscript } =
    useVoiceRecognition();

  const [script, setScript] = useState(
    "The sky above the port was the color of television, tuned to a dead channel."
  );

  // Tracks the index of the last successfully spoken word
  const [activeIndex, setActiveIndex] = useState(-1);

  // Modes: 'flow' (Spotify/Karaoke), 'highlight' (Block Highlight), 'caret' (Cursor)
  const [mode, setMode] = useState<"flow" | "highlight" | "caret">("flow");

  const scriptWords = useMemo(() => script.split(/\s+/), [script]);

  // --- KARAOKE LOGIC (UPDATED) ---
  useEffect(() => {
    if (!isListening || !transcript) return;

    const spokenWords = transcript.toLowerCase().split(/\s+/);
    const cleanScriptWords = scriptWords.map(w => w.toLowerCase().replace(/[.,]/g, ""));
    
    // We start checking from the next word
    let tempActiveIndex = activeIndex;
    
    // Iterate through the words you just spoke to see if they match the UPCOMING script words
    // We try to match a sequence: if you said "The sky above", we tick off "The", then "sky", then "above"
    for (const spokenWord of spokenWords) {
        const nextIndex = tempActiveIndex + 1;
        if (nextIndex >= cleanScriptWords.length) break;

        const expectedWord = cleanScriptWords[nextIndex];

        // "Fuzzy" match: does the spoken word contain the expected word? (e.g. "playing" matches "play")
        // Or exact match
        if (spokenWord.includes(expectedWord) || expectedWord.includes(spokenWord)) {
            tempActiveIndex = nextIndex;
        }
    }

    // Only update state if we actually advanced
    if (tempActiveIndex > activeIndex) {
        setActiveIndex(tempActiveIndex);
    }
  }, [transcript, activeIndex, scriptWords, isListening]);

  // Reset progress when starting over
  const handleStart = () => {
    setActiveIndex(-1);
    resetTranscript();
    startListening();
  };

  // --- KARAOKE LOGIC (UPDATED) ---
  useEffect(() => {
    if (!isListening || !transcript) return;

    const spokenWords = transcript.toLowerCase().split(/\s+/);
    const cleanScriptWords = scriptWords.map(w => w.toLowerCase().replace(/[.,]/g, ""));
    
    // We start checking from the next word
    let tempActiveIndex = activeIndex;
    
    // Iterate through the words you just spoke to see if they match the UPCOMING script words
    // We try to match a sequence: if you said "The sky above", we tick off "The", then "sky", then "above"
    for (const spokenWord of spokenWords) {
        const nextIndex = tempActiveIndex + 1;
        if (nextIndex >= cleanScriptWords.length) break;

        const expectedWord = cleanScriptWords[nextIndex];

        // "Fuzzy" match: does the spoken word contain the expected word? (e.g. "playing" matches "play")
        // Or exact match
        if (spokenWord.includes(expectedWord) || expectedWord.includes(spokenWord)) {
            tempActiveIndex = nextIndex;
        }
    }

    // Only update state if we actually advanced
    if (tempActiveIndex > activeIndex) {
        setActiveIndex(tempActiveIndex);
    }
  }, [transcript, activeIndex, scriptWords, isListening]);

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col font-sans selection:bg-[#1db954] selection:text-white">
      
      {/* 1. Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-4xl mx-auto w-full">
        
        {/* Input Area (Hidden when listening) */}
        {!isListening && activeIndex === -1 && (
          <div className="w-full mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <textarea
              className="w-full bg-[#2a2a2a] text-[#b3b3b3] p-6 rounded-2xl border-none outline-none focus:ring-2 focus:ring-[#1db954] resize-none h-40 text-xl transition-all shadow-xl"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Paste your lyrics or script here..."
            />
          </div>
        )}

        {/* The Reader Display */}
        <div className="w-full text-4xl md:text-5xl font-bold leading-normal tracking-tight flex flex-wrap gap-x-3 gap-y-4 transition-all">
          {scriptWords.map((word, index) => {
            const isPast = index <= activeIndex; // It stays true now!
            const isActive = index === activeIndex; // The exact word just spoken
            
            // --- STYLING LOGIC ---
            
            // Default "Future" style (Dimmed)
            let wordStyle = "text-[#404040] transition-all duration-300 blur-[0.5px]";

            // "Past/Spoken" style (Bright White & Locked In)
            if (isPast) {
              wordStyle = "text-white opacity-100 blur-0 shadow-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]";
            }

            // "Active/Just Hit" style (Green Pop)
            if (isActive && mode === "flow") {
               // The latest word gets the green tint briefly
               wordStyle = "text-[#1db954] scale-110 blur-0 drop-shadow-[0_0_15px_rgba(29,185,84,0.8)]";
            }

            // Mode Overrides
            if (mode === "highlight" && isActive) {
               return (
                 <span key={index} className="bg-[#1db954] text-black px-2 rounded-lg transition-all transform scale-105 shadow-[0_0_20px_rgba(29,185,84,0.6)]">
                   {word}
                 </span>
               );
            }

            if (mode === "caret") {
                return (
                  <span key={index} className={clsx("relative transition-colors", isPast ? "text-white" : "text-[#404040]")}>
                    {word}
                    {isActive && (
                      <span className="absolute -right-2 top-0 h-12 w-1 bg-[#1db954] animate-pulse rounded-full shadow-[0_0_10px_#1db954]" />
                    )}
                  </span>
                )
            }

            return (
              <span key={index} className={wordStyle}>
                {word}
              </span>
            );
          })}
        </div>
      </div>

      {/* 2. Bottom "Player" Bar Controls */}
      <div className="sticky bottom-0 bg-[#000000] border-t border-[#282828] p-6 pb-8 shadow-2xl z-50">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Progress Info */}
          <div className="hidden md:flex flex-col gap-1 w-[200px]">
            <div className="text-xs text-[#b3b3b3] font-mono uppercase tracking-wider">Progress</div>
            <div className="h-1 w-full bg-[#333] rounded-full overflow-hidden">
                <div 
                    className="h-full bg-[#1db954] transition-all duration-500" 
                    style={{ width: `${((activeIndex + 1) / scriptWords.length) * 100}%` }}
                />
            </div>
          </div>

          {/* Main Controls */}
          <div className="flex items-center gap-6">
            <button 
                onClick={() => { stopListening(); setActiveIndex(-1); }}
                className="text-[#b3b3b3] hover:text-white transition-colors"
                title="Reset"
            >
                <RotateCcw size={20} />
            </button>

            {!isListening ? (
              <button
                onClick={handleStart}
                disabled={!hasSupport}
                className="bg-white text-black rounded-full p-4 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 font-bold px-8 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
              >
                <Mic fill="black" size={24} /> 
                <span className="text-lg">Read</span>
              </button>
            ) : (
              <button
                onClick={stopListening}
                className="bg-[#1db954] text-black rounded-full p-4 hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(29,185,84,0.4)] animate-pulse"
              >
                <Square fill="black" size={24} />
              </button>
            )}
          </div>

          {/* View Modes */}
          <div className="flex items-center gap-2 bg-[#222] p-1.5 rounded-full border border-[#333]">
            <button
              onClick={() => setMode("flow")}
              className={clsx("p-2 rounded-full transition-all", mode === "flow" ? "bg-[#333] text-[#1db954]" : "text-[#b3b3b3] hover:text-white")}
              title="Karaoke Flow"
            >
              <AlignLeft size={18} />
            </button>
            <button
              onClick={() => setMode("highlight")}
              className={clsx("p-2 rounded-full transition-all", mode === "highlight" ? "bg-[#333] text-[#1db954]" : "text-[#b3b3b3] hover:text-white")}
              title="Block Highlight"
            >
              <Type size={18} />
            </button>
            <button
              onClick={() => setMode("caret")}
              className={clsx("p-2 rounded-full transition-all", mode === "caret" ? "bg-[#333] text-[#1db954]" : "text-[#b3b3b3] hover:text-white")}
              title="Cursor Tracking"
            >
              <MousePointer2 size={18} />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}