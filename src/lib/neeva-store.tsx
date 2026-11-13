import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Goal, LangCode, MoodKey } from "./neeva-data";
import type { JournalAnalysis } from "./journal-types";

export type MoodLog = { id: string; mood: MoodKey; intensity: number; triggers: string[]; at: string };
export type JournalEntry = { id: string; prompt: string; text: string; at: string; analysis?: JournalAnalysis };
export type ThoughtEntry = {
  id: string;
  situation: string;
  thought: string;
  emotion: string;
  before: number;
  distortions: string[];
  challenge: string;
  realistic: string;
  after: number;
  at: string;
};
export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; at: number };
export type ViewMode = "desktop" | "mobile";

type State = {
  onboarded: boolean;
  name: string;
  goal: Goal;
  moods: MoodLog[];
  points: number;
  focusSessions: number;
  journal: JournalEntry[];
  thoughts: ThoughtEntry[];
  joinedGroups: string[];
  viewMode: ViewMode;
  language: LangCode;
  chat: ChatMessage[];
};

const DEFAULT: State = {
  onboarded: false,
  name: "",
  goal: "stress",
  moods: [],
  points: 120,
  focusSessions: 0,
  journal: [],
  thoughts: [],
  joinedGroups: ["campus"],
  viewMode: "desktop",
  language: "en",
  chat: [],
};

const KEY = "neeva:v1";

type Ctx = State & {
  hydrated: boolean;
  update: (fn: (s: State) => Partial<State>) => void;
  addPoints: (n: number) => void;
  reset: () => void;
};

const NeevaContext = createContext<Ctx | null>(null);

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function NeevaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(DEFAULT);
  const [hydrated, setHydrated] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setState({ ...DEFAULT, ...(JSON.parse(raw) as Partial<State>) });
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable */
    }
  }, [state, hydrated]);

  const update = useCallback((fn: (s: State) => Partial<State>) => {
    setState((s) => ({ ...s, ...fn(s) }));
  }, []);
  const addPoints = useCallback((n: number) => setState((s) => ({ ...s, points: s.points + n })), []);
  const reset = useCallback(() => {
    window.localStorage.removeItem(KEY);
    setState(DEFAULT);
  }, []);

  const value = useMemo(() => ({ ...state, hydrated, update, addPoints, reset }), [state, hydrated, update, addPoints, reset]);
  return <NeevaContext.Provider value={value}>{children}</NeevaContext.Provider>;
}

export function useNeeva() {
  const ctx = useContext(NeevaContext);
  if (!ctx) throw new Error("useNeeva must be used inside NeevaProvider");
  return ctx;
}
