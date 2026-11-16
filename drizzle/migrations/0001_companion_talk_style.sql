ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS companion_approach text NOT NULL DEFAULT 'mix',
  ADD COLUMN IF NOT EXISTS companion_tone text NOT NULL DEFAULT 'gentle',
  ADD COLUMN IF NOT EXISTS companion_notes text NOT NULL DEFAULT '';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_companion_approach_check CHECK (companion_approach IN ('validate','advise','mix','explore')),
  ADD CONSTRAINT profiles_companion_tone_check CHECK (companion_tone IN ('gentle','honest','playful')),
  ADD CONSTRAINT profiles_companion_notes_len CHECK (char_length(companion_notes) <= 200);