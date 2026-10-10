import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Page from "../app/page";
import { FakeSpeechRecognition } from "./setup";

const STORAGE_KEY = "syncprompter-state";
const DEMO_SCRIPT = "Your script goes here. We’ll handle the flow.";

function recognizer() {
  return FakeSpeechRecognition.last();
}

function setScript(text: string) {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: text } });
}

function readButton() {
  return screen.queryByRole("button", { name: "Read" });
}

function stopButton() {
  return screen.getByRole("button", { name: "Stop" });
}

// Index of the word the tracker currently reports as active, or -1 for none.
function activeIndex(): number {
  const el = document.querySelector('[aria-current="true"]');
  return el ? Number(el.getAttribute("data-word-index")) : -1;
}

function wordElement(index: number): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-word-index="${index}"]`);
  if (!el) throw new Error(`no word element for index ${index}`);
  return el;
}

function speak(text: string, isFinal = false) {
  act(() => recognizer().speak(text, isFinal));
  return activeIndex();
}

function renderReader(script: string) {
  render(<Page />);
  setScript(script);
  fireEvent.click(screen.getByRole("button", { name: "Read" }));
}

function startSession(script: string) {
  renderReader(script);
  act(() => recognizer().fireStart());
}

describe("matching engine", () => {
  it("matches each spoken word once when the recognizer re-sends the growing hypothesis (C1, M1)", () => {
    const words = ["we", "discuss", "the", "performance", "of", "the", "team", "today"];
    startSession("We discuss the performance of the team today.");

    const indices = words.map((_, i) => speak(words.slice(0, i + 1).join(" ")));

    expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("follows one new word per result (control, M1b)", () => {
    const words = ["we", "discuss", "the", "performance", "of", "the", "team", "today"];
    startSession("We discuss the performance of the team today.");

    const indices = words.map(word => speak(word, true));

    expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("does not advance when a final result is delivered again with no new speech (M2)", () => {
    startSession("click the button then click the button now");

    speak("click the button", true);
    expect(activeIndex()).toBe(2);

    act(() => recognizer().redeliverLast());
    expect(activeIndex()).toBe(2);

    expect(speak("then click the button now", true)).toBe(7);
  });

  it("does not replay an unmatched transcript when the user clicks a word (m-1)", () => {
    startSession("alpha bravo charlie delta echo foxtrot golf hotel india juliet xylophone kilo lima");

    expect(speak("xylophone")).toBe(-1);

    fireEvent.click(wordElement(6));

    expect(activeIndex()).toBe(6);
  });

  it("keeps the tracker moving after two skipped short words (M5, M6)", () => {
    startSession("we need a good plan now");

    expect(speak("we need plan now", true)).toBe(5);
  });

  it("keeps the existing threshold: a one-letter misspelling of a 5-letter word does not advance (M5 threshold)", () => {
    startSession("the house was big");

    expect(speak("the horse", true)).toBe(0);
  });

  it("does not stall on a spaced em-dash between spoken words (m-2)", () => {
    startSession("yes — — ok now");

    expect(speak("yes ok now", true)).toBe(4);
  });

  // Each spoken word is its own result, so the test checks the position after
  // every word, not only the last one. A number word that is skipped and then
  // jumped over would still land on the right final word, and hide the bug.
  it("keeps a single spaced em-dash tolerated (M16)", () => {
    startSession("yes — ok now");

    const indices = ["yes", "ok", "now"].map(word => speak(word, true));

    expect(indices).toEqual([0, 2, 3]);
  });

  it.each([
    ["in 100 days", "in one hundred days", [0, 1, 1, 2]],
    ["I am 21 years old", "i am twenty one years old", [0, 1, 2, 2, 3, 4]],
    ["in 2026 we shipped", "in twenty twenty six we shipped", [0, 1, 1, 1, 2, 3]],
    ["version 3.5 ships", "version three point five ships", [0, 1, 1, 1, 2]],
    ["we sold 1,000 units", "we sold one thousand units", [0, 1, 2, 2, 3]],
    ["the 21st day", "the twenty first day", [0, 1, 1, 2]],
    ["Chapter 13 starts now", "chapter thirteen starts now", [0, 1, 2, 3]],
  ])("matches number forms word by word: script %j, spoken %j (m-3)", (script, spoken, expected) => {
    startSession(script);

    const indices = spoken.split(" ").map(word => speak(word, true));

    expect(indices).toEqual(expected);
  });

  // Behaviour the audit marks as passing. These must keep passing.
  it("keeps a word that is nearly right within the threshold for its length (M3)", () => {
    startSession("the performance was great");

    const indices = ["the", "performanse", "was", "great"].map(word => speak(word, true));

    expect(indices).toEqual([0, 1, 2, 3]);
  });

  it("keeps a single skipped word tolerated (M7)", () => {
    startSession("we need a plan now");

    const indices = ["we", "need", "plan", "now"].map(word => speak(word, true));

    expect(indices).toEqual([0, 1, 3, 4]);
  });

  it("does not jump to a repeated long word (M8 guard)", () => {
    startSession("start one two three calibrate four calibrate five");

    const indices = ["start", "calibrate"].map(word => speak(word, true));

    expect(indices).toEqual([0, 0]);
  });

  it("does not skip past short words to a repeated word (M8 guard, short words in between)", () => {
    startSession("start a an of in calibrate four calibrate five");

    const indices = ["start", "calibrate"].map(word => speak(word, true));

    expect(indices).toEqual([0, 0]);
  });

  it("ignores empty, punctuation-only and filler speech (M11)", () => {
    startSession("Hello there");

    const indices = ["", "... —", "um uh"].map(text => speak(text, true));

    expect(indices).toEqual([-1, -1, -1]);
  });

  it("does not move backwards and jumps forward only on a unique long word (M12)", () => {
    startSession("alpha bravo charlie delta");

    const indices = ["charlie", "bravo"].map(word => speak(word, true));

    expect(indices).toEqual([2, 2]);
  });

  it("moves the active word when a word anywhere in the script is clicked (M8)", () => {
    startSession("One. Two. Three. Four. Five.");

    fireEvent.click(wordElement(0));
    fireEvent.click(wordElement(4));

    expect(activeIndex()).toBe(4);
  });
});

describe("speech lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops without retrying on not-allowed and says why (M1)", () => {
    renderReader("Some script.");
    act(() => {
      recognizer().fireError("not-allowed");
      recognizer().fireEnd();
      vi.advanceTimersByTime(2000);
    });

    expect(recognizer().startCalls).toBe(1);
    expect(screen.getByText(/microphone/i)).toBeTruthy();
    expect(readButton()).not.toBeNull();
  });

  it("stops without retrying on network and says why (M1)", () => {
    renderReader("Some script.");
    act(() => {
      recognizer().fireError("network");
      recognizer().fireEnd();
      vi.advanceTimersByTime(2000);
    });

    expect(recognizer().startCalls).toBe(1);
    expect(screen.getByText(/network/i)).toBeTruthy();
  });

  it("shows listening only after the session starts (M3)", () => {
    renderReader("Some script.");

    expect(readButton()).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
  });

  it("does not restart after Stop is pressed inside the restart window (M2)", () => {
    startSession("Some script.");
    act(() => {
      recognizer().fireEnd();
    });

    fireEvent.click(stopButton());
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(recognizer().startCalls).toBe(1);
    expect(readButton()).not.toBeNull();
  });

  it("does not restart after unmount (M2)", () => {
    const { unmount } = render(<Page />);
    setScript("Some script.");
    fireEvent.click(screen.getByRole("button", { name: "Read" }));
    act(() => {
      recognizer().fireStart();
      recognizer().fireEnd();
    });

    unmount();
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(recognizer().startCalls).toBe(1);
  });

  it("stops listening and shows an error when a restart start() throws (M3)", () => {
    FakeSpeechRecognition.startError = call => (call === 2 ? new Error("start failed") : null);
    startSession("Some script.");
    act(() => {
      recognizer().fireEnd();
      vi.advanceTimersByTime(1000);
    });

    expect(readButton()).not.toBeNull();
    expect(screen.getByText(/could not restart/i)).toBeTruthy();
  });

  it("stops after five consecutive sessions that never start", () => {
    renderReader("Some script.");
    for (let i = 0; i < 10 && !screen.queryByText(/stopped unexpectedly/i); i += 1) {
      act(() => {
        recognizer().fireEnd();
        vi.advanceTimersByTime(1000);
      });
    }

    expect(recognizer().startCalls).toBe(5);
    expect(screen.getByText(/stopped unexpectedly/i)).toBeTruthy();
  });

  it("keeps restarting while sessions start and end normally", () => {
    startSession("Some script.");
    for (let i = 0; i < 7; i += 1) {
      act(() => {
        recognizer().fireEnd();
        vi.advanceTimersByTime(300);
        recognizer().fireStart();
      });
    }

    expect(recognizer().startCalls).toBe(8);
    expect(screen.queryByText(/stopped unexpectedly/i)).toBeNull();
  });
});

describe("first visit and browser support", () => {
  it("enables Read on a fresh visit with a script (M4)", () => {
    render(<Page />);

    expect(readButton()).toBeTruthy();
    expect((readButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables Read and explains why when speech recognition is missing (L1)", () => {
    const original = Reflect.get(window, "webkitSpeechRecognition");
    Reflect.deleteProperty(window, "webkitSpeechRecognition");
    try {
      render(<Page />);

      expect((readButton() as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByText(/browser not supported/i)).toBeTruthy();
    } finally {
      Reflect.set(window, "webkitSpeechRecognition", original);
    }
  });
});

describe("saved state", () => {
  it("renders when reading storage throws (M6)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    render(<Page />);

    expect(readButton()).not.toBeNull();
  });

  it("keeps the typed script when writing storage throws (m-7)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    render(<Page />);
    setScript("Typed in memory.");

    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Typed in memory.");
  });

  it("falls back to the demo script when the saved script has the wrong type (m-7)", () => {
    window.localStorage.setItem(STORAGE_KEY, '{"script":123}');

    render(<Page />);

    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(DEMO_SCRIPT);
  });

  it("falls back to defaults for invalid settings values and keeps a valid script", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      '{"script":"Kept words.","fontSize":"text-huge","themeColor":5}'
    );

    render(<Page />);

    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Kept words.");
  });

  it("keeps an empty saved script on reload (m-6)", () => {
    window.localStorage.setItem(STORAGE_KEY, '{"script":""}');

    render(<Page />);

    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  });

  it("keeps the saved script under StrictMode (m-8)", () => {
    window.localStorage.setItem(STORAGE_KEY, '{"script":"Saved words here."}');

    render(
      <StrictMode>
        <Page />
      </StrictMode>
    );

    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Saved words here.");
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}").script).toBe("Saved words here.");
  });
});
