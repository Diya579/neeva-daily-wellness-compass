import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { LangCode, MoodKey } from "./neeva-data";
import type { JournalAnalysis } from "./journal-types";

export type MoodLog = {
  id: string;
  mood: MoodKey;
  intensity: number;
  triggers: string[];
  at: string;
};
export type JournalEntry = {
  id: string;
  prompt: string;
  text: string;
  at: string;
  analysis?: JournalAnalysis;
};
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

type State = {
  moods: MoodLog[];
  points: number;
  focusSessions: number;
  journal: JournalEntry[];
  thoughts: ThoughtEntry[];
  joinedGroups: string[];
  language: LangCode;
  chat: ChatMessage[];
};

const DEFAULT: State = {
  moods: [],
  points: 120,
  focusSessions: 0,
  journal: [],
  thoughts: [],
  joinedGroups: ["campus"],
  language: "en",
  chat: [],
};


type Ctx = State & {
  hydrated: boolean;
  update: (fn: (s: State) => Partial<State>) => void;
  addPoints: (n: number) => void;
  reset: () => void;
};

const NeevaContext = createContext<Ctx | null>(null);

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** On-device activity store, namespaced per signed-in account. */
export function NeevaProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const KEY = `neeva:v2:${userId}`;
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
  }, [KEY]);

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
  }, [state, hydrated, KEY]);

  const update = useCallback((fn: (s: State) => Partial<State>) => {
    setState((s) => ({ ...s, ...fn(s) }));
  }, []);
  const addPoints = useCallback(
    (n: number) => setState((s) => ({ ...s, points: s.points + n })),
    [],
  );
  const reset = useCallback(() => {
    window.localStorage.removeItem(KEY);
    setState(DEFAULT);
  }, [KEY]);

  const value = useMemo(
    () => ({ ...state, hydrated, update, addPoints, reset }),
    [state, hydrated, update, addPoints, reset],
  );
  return <NeevaContext.Provider value={value}>{children}</NeevaContext.Provider>;
}

export function useNeeva() {
  const ctx = useContext(NeevaContext);
  if (!ctx) throw new Error("useNeeva must be used inside NeevaProvider");
  return ctx;
}
