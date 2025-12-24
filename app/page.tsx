"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useVoiceRecognition } from "./hooks/useVoiceRecognition";
import { 
  Mic, Square, AlignLeft, MousePointer2, Type, RotateCcw, 
  Settings2, X
} from "lucide-react";
import { clsx } from "clsx";

// --- Types ---
type FontSize = "text-xl" | "text-2xl" | "text-4xl" | "text-6xl"; 
type FontFamily = "font-sans" | "font-serif" | "font-mono";
type ColorTheme = "green" | "yellow" | "blue" | "white";

export default function VoiceReader() {
  const { isListening, transcript, error, startListening, stopListening, hasSupport, resetTranscript } =
    useVoiceRecognition();

  const [script, setScript] = useState(
    "The sky above the port was the color of television, tuned to a dead channel. It was a bright cold day in April, and the clocks were striking thirteen."
  );

  // --- State ---
  const [activeIndex, setActiveIndex] = useState(-1);
  const [mode, setMode] = useState<"flow" | "highlight" | "caret">("flow");
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>("text-2xl"); 
  const [fontFamily, setFontFamily] = useState<FontFamily>("font-sans");
  const [themeColor, setThemeColor] = useState<ColorTheme>("green");

  // Refs
  const activeWordRef = useRef<HTMLSpanElement | null>(null);
  const wakeLockRef = useRef<any>(null);

  const scriptWords = useMemo(() => script.split(/\s+/), [script]);

  // --- WAKE LOCK ---
  useEffect(() => {
    const requestWakeLock = async () => {
      if (isListening && 'wakeLock' in navigator) {
        try { wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } 
        catch (err) { console.log("Wake Lock rejected"); }
      }
    };
    const releaseWakeLock = async () => {
      if (wakeLockRef.current) { await wakeLockRef.current.release(); wakeLockRef.current = null; }
    };
    if (isListening) requestWakeLock(); else releaseWakeLock();
    return () => { releaseWakeLock(); };
  }, [isListening]);

  // --- AUTO SCROLL ---
  useEffect(() => {
    if (isAutoScroll && activeWordRef.current) {
      activeWordRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIndex, isAutoScroll]);

  // --- MATCHING LOGIC ---
  useEffect(() => {
    if (!isListening || !transcript) return;
    const spokenWords = transcript.toLowerCase().split(/\s+/);
    const cleanScriptWords = scriptWords.map(w => w.toLowerCase().replace(/[.,]/g, ""));
    let tempActiveIndex = activeIndex;
    for (const spokenWord of spokenWords) {
        const nextIndex = tempActiveIndex + 1;
        if (nextIndex >= cleanScriptWords.length) break;
        if (spokenWord.includes(cleanScriptWords[nextIndex]) || cleanScriptWords[nextIndex].includes(spokenWord)) { tempActiveIndex = nextIndex; }
    }
    if (tempActiveIndex > activeIndex) setActiveIndex(tempActiveIndex);
  }, [transcript, activeIndex, scriptWords, isListening]);

  // --- RESET ---
  const handleStart = () => { setActiveIndex(-1); resetTranscript(); startListening(); };
  const getThemeColor = () => {
    switch (themeColor) { case "yellow": return "#eab308"; case "blue": return "#3b82f6"; case "white": return "#ffffff"; default: return "#1db954"; }
  };
  const activeColor = getThemeColor();

  return (
    <div className={`h-[100dvh] w-full bg-[#121212] text-white flex flex-col ${fontFamily} overflow-hidden`}
         style={{ '--selection-color': activeColor } as React.CSSProperties}>
      <style jsx global>{` .no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; } `}</style>

      {/* 1. NEW TOP LOGO HEADER (Fixed Top Bar) */}
      <header className="flex-none bg-[#121212]/90 backdrop-blur-sm border-b border-[#282828] shadow-xl p-4 md:p-5 z-50 sticky top-0">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-4">
          
          {/* Logo and Product Name (Top Left Corner) */}
          <div className="flex items-center gap-3 md:gap-4 selection:bg-black selection:text-[#1db954]">
             {/* We assume the logo is named logo.png in the public folder */}
             <img 
                src="/Image.png" 
                alt="SyncPrompter Logo" 
                className="h-9 md:h-10 w-auto object-contain"
             />
             <h1 className="hidden xs:block text-lg md:text-xl font-extrabold tracking-tight text-white mt-1">
                Sync<span className="text-[#b3b3b3]">Prompter</span>.
             </h1>
          </div>

          {/* Settings Button (Top Right Corner) */}
          <div className="relative">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="bg-[#2a2a2a] p-3 rounded-full text-[#b3b3b3] hover:text-white hover:bg-[#333] transition-all active:scale-90 shadow-lg"
            >
              {showSettings ? <X size={18} /> : <Settings2 size={18} />}
            </button>
            {showSettings && (
              <div className="absolute right-0 top-14 w-64 bg-[#181818] border border-[#333] rounded-2xl shadow-2xl p-4 flex flex-col gap-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="space-y-2"><label className="text-[10px] font-bold text-[#b3b3b3] uppercase">Size</label><div className="flex bg-[#2a2a2a] rounded-lg p-1">{(["text-xl", "text-2xl", "text-4xl", "text-6xl"] as FontSize[]).map((size, idx) => (<button key={size} onClick={() => setFontSize(size)} className={clsx("flex-1 py-2 rounded-md text-xs font-bold", fontSize === size ? "bg-[#333] text-white" : "text-[#777]")}>A{idx + 1}</button>))}</div></div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-[#b3b3b3] uppercase">Color</label><div className="flex justify-between px-2">{(["green", "yellow", "blue", "white"] as ColorTheme[]).map((c) => (<button key={c} onClick={() => setThemeColor(c)} className={clsx("w-6 h-6 rounded-full border-2", themeColor === c ? "border-white scale-125" : "border-transparent")} style={{ backgroundColor: c === 'green' ? '#1db954' : c === 'yellow' ? '#eab308' : c === 'blue' ? '#3b82f6' : '#ffffff' }} />))}</div></div>
                <div className="pt-2 border-t border-[#333] flex justify-between"><span className="text-xs text-[#b3b3b3]">Auto-Scroll</span><button onClick={() => setIsAutoScroll(!isAutoScroll)} className="text-xs font-bold" style={{ color: isAutoScroll ? activeColor : '#666' }}>{isAutoScroll ? "ON" : "OFF"}</button></div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTENT (Scrollable script area) */}
      <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth relative" onClick={() => setShowSettings(false)}>
        <div className="w-full max-w-4xl mx-auto px-4 md:px-6 py-12 flex flex-col items-center min-h-full justify-center">
          {error && <div className="mb-6 bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm text-center">{error}</div>}
          {!isListening && activeIndex === -1 && <div className="w-full mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700"><textarea className="w-full bg-[#2a2a2a] text-[#b3b3b3] p-4 md:p-6 rounded-2xl border-none outline-none focus:ring-1 resize-none h-40 text-lg md:text-xl transition-all shadow-xl font-sans" style={{ '--tw-ring-color': activeColor } as React.CSSProperties} value={script} onChange={(e) => setScript(e.target.value)} placeholder="Paste your script here..."/></div>}
          <div className={clsx("w-full font-bold leading-normal tracking-tight flex flex-wrap gap-x-2 gap-y-3 transition-all pb-[40vh]", fontSize)}>
            {scriptWords.map((word, index) => {
              const isPast = index <= activeIndex; const isActive = index === activeIndex; 
              let wordStyle = "text-[#404040] transition-all duration-300 blur-[0.5px]";
              if (isPast) wordStyle = "text-white opacity-100 blur-0 shadow-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]";
              if (isActive && mode === "flow") wordStyle = `scale-110 blur-0 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]`;
              return (<span key={index} ref={isActive ? activeWordRef : null} className={wordStyle} style={isActive && mode === "flow" ? { color: activeColor } : {}}>{mode === "highlight" && isActive ? (<span className="text-black px-2 rounded inline-block shadow-lg" style={{ backgroundColor: activeColor }}>{word}</span>) : mode === "caret" && isActive ? (<span className="relative text-white">{word}<span className="absolute -right-1 top-0 bottom-0 w-0.5 animate-pulse" style={{ backgroundColor: activeColor, boxShadow: `0 0 8px ${activeColor}` }}/></span>) : (word)}</span>);
            })}
          </div>
        </div>
      </main>

      {/* 3. BOTTOM PLAYER BAR */}
      <footer className="flex-none bg-[#000000] border-t border-[#282828] p-4 pb-8 shadow-2xl z-40">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="hidden md:flex flex-col gap-1 w-[200px]"><div className="text-[10px] text-[#b3b3b3] font-mono uppercase tracking-wider">Progress</div><div className="h-1 w-full bg-[#333] rounded-full overflow-hidden"><div className="h-full transition-all duration-500 ease-out" style={{ width: `${((activeIndex + 1) / scriptWords.length) * 100}%`, backgroundColor: activeColor }} /></div></div>
          <div className="flex items-center gap-6 md:gap-8"><button onClick={() => { stopListening(); setActiveIndex(-1); }} className="text-[#b3b3b3] hover:text-white transition-colors p-3 hover:bg-[#222] rounded-full active:scale-90"><RotateCcw size={22} /></button>{!isListening ? (<button onClick={handleStart} disabled={!hasSupport} className="bg-white text-black rounded-full p-4.5 md:p-4 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 font-bold px-8 shadow-[0_0_20px_rgba(255,255,255,0.2)]"><Mic fill="black" size={26} /><span className="text-lg hidden md:inline">Read</span></button>) : (<button onClick={stopListening} className="text-black rounded-full p-4.5 md:p-4 hover:scale-105 active:scale-95 transition-all shadow-lg animate-pulse" style={{ backgroundColor: activeColor, boxShadow: `0 0 30px ${activeColor}66` }}><Square fill="black" size={26} /></button>)}<div className="flex md:hidden items-center gap-1 bg-[#222] p-1 rounded-full border border-[#333]"><button onClick={() => setMode("flow")} className={clsx("p-3 rounded-full", mode === "flow" ? "bg-[#333] text-white" : "text-[#777]")}><AlignLeft size={18} /></button><button onClick={() => setMode("caret")} className={clsx("p-3 rounded-full", mode === "caret" ? "bg-[#333] text-white" : "text-[#777]")}><MousePointer2 size={18} /></button></div></div>
          <div className="hidden md:flex items-center gap-1 bg-[#222] p-1 rounded-full border border-[#333]"><button onClick={() => setMode("flow")} className={clsx("p-2 rounded-full transition-all", mode === "flow" ? "bg-[#333] text-white" : "text-[#b3b3b3] hover:text-white")} title="Flow"><AlignLeft size={18} /></button><button onClick={() => setMode("highlight")} className={clsx("p-2 rounded-full transition-all", mode === "highlight" ? "bg-[#333] text-white" : "text-[#b3b3b3] hover:text-white")} title="Highlight"><Type size={18} /></button><button onClick={() => setMode("caret")} className={clsx("p-2 rounded-full transition-all", mode === "caret" ? "bg-[#333] text-white" : "text-[#b3b3b3] hover:text-white")} title="Caret"><MousePointer2 size={18} /></button></div>
        </div>
      </footer>
    </div>
  );
}