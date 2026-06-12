# SyncPrompter

An intelligent, voice-activated teleprompter that tracks your speech in real-time.

[![Vercel Deployment](https://img.shields.io/badge/deploy-vercel-black?logo=vercel&style=for-the-badge)](https://sync-prompter.vercel.app)
[![GitHub stars](https://img.shields.io/github/stars/kavanvyas/Sync_Prompter?style=for-the-badge)](https://github.com/kavanvyas/Sync_Prompter/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Last Commit](https://img.shields.io/github/last-commit/kavanvyas/Sync_Prompter?style=for-the-badge)](https://github.com/kavanvyas/Sync_Prompter/commits/main)

## 🚀 Live Demo

Try it live:
[https://sync-prompter.vercel.app](https://sync-prompter.vercel.app)

Experience seamless delivery—paste your script and start reading.

---

## 📖 Overview

Traditional teleprompters force you to follow a machine. Speakers frequently find themselves "chasing" a fixed-speed scroll or manually adjusting their pace, leading to robotic delivery, missed cues, and high stress.

**SyncPrompter** reverses this dynamic: the machine follows you. 

Built for content creators, educators, and public speakers, SyncPrompter uses advanced real-time speech recognition and a custom synchronization engine. It listens to your voice and automatically advances the text only as you read it. Pause for effect, take a breath, or ad-lib—SyncPrompter waits for you.

---

## ✨ Features

* **Real-time Voice Tracking:** Highlights your current word with zero-latency synchronization.
* **Anchor-Based Matching:** Intelligent jump prevention ensures the prompter stays glued to your position, even if you mispronounce a word.
* **Smart Auto-Scroll:** Fluid, debounced vertical scrolling keeps your active line at the optimal reading level.
* **Click-to-Jump:** Instantly override the tracker by clicking anywhere in the script.
* **Adaptive Number Detection:** Automatically matches numeric digits (e.g., "13") to their spoken equivalents ("thirteen").
* **Dynamic Customization:** Control font sizes, typography, and contrast themes on the fly.
* **Local Persistence:** Your scripts and settings are automatically saved between sessions.

---

## 🛠 How It Works

1. **Input:** Land on the page and paste your script into the intuitive editor.
2. **Calibrate:** Use the settings menu to adjust text size, font, and color theme.
3. **Initiate:** Click "Read" to grant microphone permissions and activate the engine.
4. **Perform:** Start speaking. The interface transitions into focus mode, tracking your voice and auto-scrolling the text smoothly.

---

## 💻 Tech Stack

**Frontend**
* Next.js 15 (App Router)
* TypeScript
* Tailwind CSS
* Lucide React

**AI & Speech**
* Web Speech API (Native MediaDevices)
* Fast Levenshtein (Fuzzy Matching Engine)

**Deployment**
* Vercel

---

## 📸 Screenshots

### Home Page
*(Add screenshot of the landing page and editor here)*

### Core Feature
*(Add screenshot of the real-time tracking interface here)*

### Settings & Customization
*(Add screenshot of the settings menu and theme selection here)*

---

## 🎯 Use Cases

* **Content Creators:** Record YouTube videos with perfect eye contact and a natural pace, drastically reducing retakes.
* **Keynote Speakers:** Present confidently on stage using a digital podium guide that accommodates natural pauses and audience interaction.
* **Educators:** Record online lectures or conduct live classes smoothly without managing a scrolling teleprompter.
* **Accessibility:** Assist individuals practicing reading fluency with real-time visual feedback and pacing support.

---

## 🏗 Architecture (Simple)

SyncPrompter operates entirely on the client side for maximum privacy and low latency:
1. **Audio Capture:** The browser's native API streams live audio data.
2. **Transcription:** The speech engine converts audio into normalized, interim text blocks.
3. **Synchronization Engine:** A proprietary, anchor-based algorithm fuzzy-matches the incoming transcript against a sliding window of the script.
4. **UI Updates:** The state engine uses sentence-level virtualization to update the active word and trigger smooth scrolling without rendering bottlenecks.

---

## 🗺 Roadmap

**Completed**
* Core real-time voice synchronization
* Anchor-based matching and jump prevention
* Multi-theme UI and local persistence
* Sentence-level DOM virtualization

**In Progress**
* Deepgram WebSocket integration for multi-language support and enhanced accuracy
* Save/Load scripts via Supabase

**Future Ideas**
* Mobile app companion (remote control)
* Eye-tracking integration for extreme accuracy
* Export transcripts and timing data

---

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
