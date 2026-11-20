/**
 * Zero-Billing Browser-Native Voice I/O (`src/lib/voice.ts`)
 * - 100% Credit-Card-Free: Uses client-side Web Speech APIs (`window.SpeechRecognition` / `webkitSpeechRecognition`
 *   and `window.speechSynthesis` / `SpeechSynthesisUtterance`).
 * - No paid server-side Google Cloud STT or TTS calls.
 * - Explicitly maps all 8 Neeva languages (`en`, `hinglish`, `hi`, `gu`, `mr`, `bn`, `ta`, `te`)
 *   to Indian BCP-47 locale tags (`en-IN`, `hi-IN`, `gu-IN`, `mr-IN`, `bn-IN`, `ta-IN`, `te-IN`).
 */

import type { LangCode } from "./neeva-data";

export const VOICE_MODE = "browser_native" as const;

export const INDIAN_SPEECH_LOCALE_MAP: Record<LangCode, string> = {
  en: "en-IN",
  hinglish: "hi-IN",
  hi: "hi-IN",
  gu: "gu-IN",
  mr: "mr-IN",
  bn: "bn-IN",
  ta: "ta-IN",
  te: "te-IN",
};

export function getSpeechLocaleForLanguage(lang: LangCode): string {
  return INDIAN_SPEECH_LOCALE_MAP[lang] ?? "en-IN";
}

export interface BrowserSpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionResultEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string; confidence?: number }> & { isFinal?: boolean }>;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognitionInstance;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export function isBrowserSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

export function isBrowserSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export interface SpeechRecognitionCallbacks {
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

/**
 * Start client-side Web Speech API Speech-to-Text (`SpeechRecognition` / `webkitSpeechRecognition`)
 * configured for the active Indian locale (`hi-IN`, `gu-IN`, `ta-IN`, `mr-IN`, `bn-IN`, `te-IN`, `en-IN`).
 */
export function startBrowserSpeechRecognition(
  lang: LangCode,
  callbacks: SpeechRecognitionCallbacks
): { stop: () => void; locale: string } | null {
  const Ctor = getSpeechRecognitionConstructor();
  const locale = getSpeechLocaleForLanguage(lang);
  if (!Ctor) {
    callbacks.onError?.("Browser SpeechRecognition is not supported in this browser.");
    return null;
  }

  const recognition = new Ctor();
  recognition.lang = locale;
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: SpeechRecognitionResultEventLike) => {
    let fullTranscript = "";
    let isFinal = false;
    for (let i = 0; i < event.results.length; i++) {
      const res = event.results[i];
      if (res && res[0]) {
        fullTranscript += res[0].transcript;
        if (res.isFinal) isFinal = true;
      }
    }
    if (fullTranscript.trim()) {
      callbacks.onTranscript(fullTranscript.trim(), isFinal);
    }
  };

  recognition.onerror = (event) => {
    callbacks.onError?.(event.error || "speech_recognition_error");
  };

  recognition.onend = () => {
    callbacks.onEnd?.();
  };

  try {
    recognition.start();
  } catch (err) {
    callbacks.onError?.((err as Error).message || "failed_to_start_speech_recognition");
    return null;
  }

  return {
    locale,
    stop: () => {
      try {
        recognition.stop();
      } catch {
        /* ignore stop errors */
      }
    },
  };
}

/**
 * Speak text aloud using client-side `window.speechSynthesis` and `SpeechSynthesisUtterance`
 * with Indian locale voice selection (`hi-IN`, `gu-IN`, `ta-IN`, `mr-IN`, `bn-IN`, `te-IN`, `en-IN`).
 */
export function speakWithBrowserTTS(
  rawText: string,
  lang: LangCode,
  onEnd?: () => void
): boolean {
  if (!isBrowserSpeechSynthesisSupported()) return false;

  const cleanText = rawText
    .replace(/\*\*/g, "")
    .replace(/[_`#>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleanText) return false;

  const synth = window.speechSynthesis;
  synth.cancel();

  const locale = getSpeechLocaleForLanguage(lang);
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = locale;
  utterance.rate = 0.98;
  utterance.pitch = 1.0;

  const voices = synth.getVoices?.() ?? [];
  const exactVoice =
    voices.find((v) => v.lang.toLowerCase() === locale.toLowerCase()) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(locale.split("-")[0]!.toLowerCase())) ??
    voices.find((v) => v.lang.toLowerCase() === "en-in");

  if (exactVoice) {
    utterance.voice = exactVoice;
  }

  if (onEnd) {
    utterance.onend = () => onEnd();
    utterance.onerror = () => onEnd();
  }

  synth.speak(utterance);
  return true;
}

export function stopBrowserTTS(): void {
  if (isBrowserSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}
