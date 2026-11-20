# Neeva AI — Initial Repository Audit

**Audit performed:** 20 November 2026  
**Auditor:** Backend Architect (Antigravity Agent)  
**Frontend integrity:** 169 files catalogued, SHA-256 baseline recorded at `docs/backend/frontend-hash-baseline.json`. **No frontend files modified.**

---

## 1. Repository Structure

```
frontend/                    ← entire existing application (read-only)
  .legacy-prototype/                  ← legacy-prototype platform metadata
  drizzle/                   ← DB schema & migrations (Supabase/legacy-prototype managed)
    migrations/
      0000_create_profiles.sql
      0001_companion_talk_style.sql
      0002_community_circles_moderation.sql
    schema.ts                ← auto-generated placeholder (blank)
  src/
    ai-gateway.types.ts
    components/
      ai-elements/           ← chat streaming UI
      neeva/                 ← app-level components (AppShell, CrisisDialog, etc.)
      ui/                    ← shadcn/ui primitives (40+ components)
    generated/ai-gateway/    ← auto-generated types
    hooks/use-mobile.tsx
    integrations/
      legacy-prototype/               ← legacy-prototype AI gateway client
      supabase/              ← Supabase auth + DB client
    lib/
      ai.server.ts           ← server-only AI call (via legacy-prototype gateway)
      ambient-audio.ts
      auth-session.tsx       ← Supabase auth session provider
      chat-prompt.ts         ← companion system-prompt builder
      companion.ts           ← companion types, defaults, sanitisation
      companion.test.ts
      crisis.ts              ← deterministic crisis detection (regex patterns)
      crisis.test.ts
      error-capture.ts
      journal-local.ts       ← offline local analysis fallback
      journal-types.ts       ← JournalAnalysis type + JSON schema
      journal.functions.ts   ← server function wrapper for journal analysis
      mood-export.ts         ← CSV/JSON export helpers
      mood-export.test.ts
      neeva-data.ts          ← all static data (moods, groups, meditations, helplines)
      neeva-store.tsx        ← localStorage-based activity store (NeevaProvider)
      profile.tsx            ← Supabase profile read/write + ProfileProvider
      utils.ts
    routeTree.gen.ts         ← TanStack Router auto-generated route tree
    router.tsx
    routes/
      __root.tsx
      _authenticated/        ← auth-gated pages (chat, community, hub, journal, settings, today)
      api/chat.ts            ← the only server API route (POST /api/chat)
      auth.tsx               ← login / signup / password reset page
      index.tsx              ← landing page
      reset-password.tsx
    server.ts
    start.ts
    styles.css
    test/
  supabase/config.toml
  .env                       ← Supabase credentials (project + publishable key)
  package.json               ← Bun + TanStack Start + React 19 + Supabase + legacy-prototype AI
  vite.config.ts
  drizzle.config.ts
```

---

## 2. What Already Exists

### Authentication
- **Implementation:** Supabase Auth via `@supabase/supabase-js`.
- **Status:** Functional for login, signup, password reset, session management.
- **Provider:** `AuthSessionProvider` wraps the app; listens to `onAuthStateChange`.
- **Profile creation:** Postgres trigger `on_auth_user_created` auto-creates a row in `public.profiles`.

### AI Companion Chat
- **Route:** `POST /api/chat` (TanStack Start server handler).
- **Auth:** Validates bearer token against Supabase before calling the model.
- **Model:** `openai/gpt-6-astra` via **legacy-prototype AI Gateway** (`legacy-prototype-pkg`).  
  > ⚠️ This is a **strictly prohibited** service under the new Google-only policy.
- **Streaming:** Server-sent text stream using `ReadableStream`.
- **Request schema:** `companion`, `language` (`en|hi|gu|ta|mr|bn`), `script`, `messages[]`.
- **System prompt:** Built by `therapistInstructions()` in `chat-prompt.ts`.

### Journal Analysis
- **Server function:** `analyzeJournal` in `journal.functions.ts`.
- **Model call:** `generateResponse()` via legacy-prototype gateway with strict JSON schema.
- **Fallback:** `analyzeLocally()` — pure deterministic lexical analysis when AI is unreachable.
- **Storage:** ⚠️ **On-device only** — `localStorage` via `NeevaProvider`.

### Mood Tracking
- **Storage:** ⚠️ **On-device only** — `localStorage` via `NeevaProvider`.
- **Export:** Client-side CSV/JSON generation (`mood-export.ts`).
- **No server persistence.**

### Thought Records
- **Storage:** ⚠️ **On-device only** — `localStorage` via `NeevaProvider`.
- **No server persistence.**

### Chat History
- **Storage:** ⚠️ **On-device only** — `localStorage` via `NeevaProvider` (key `neeva:v2:{userId}`).

### Wellness Points / Focus Sessions
- **Storage:** ⚠️ **On-device only** — `localStorage`.

### Community
- **Implementation:** Supabase Postgres tables + RLS policies + stored functions.
- **Tables:** `community_posts`, `community_members`, `community_supports`, `community_reports`, `community_blocks`.
- **Features:** Anonymous posts (alias, no author leakage in feed function), circles, support reactions, reporting, auto-hide on report threshold, block/unblock.
- **Status:** Functional via Supabase direct client calls.

### Profile / Companion Settings
- **Implementation:** Supabase table `public.profiles` with RLS (own-row).
- **Fields:** `display_name`, `goal`, `onboarded`, `companion_*` (name, vibe, length, avatar, emoji, approach, tone, notes).
- **Status:** Functional via Supabase direct client calls.

### Crisis Detection
- **Implementation:** Deterministic regex patterns in `src/lib/crisis.ts`.
- **Coverage:** English + Hinglish + Hindi (Devanagari) + Gujarati (Gujlish + script) + Marathi + Tamil (Tanglish + script) + Bengali (Banglish + script).
- **Functions:** `detectCrisis(text)` → boolean; `assessSafety(answers)` → `urgent|support|steady`.
- **Status:** Implemented and tested (`crisis.test.ts`).
- **Note:** Currently client-side only — not enforced server-side before AI inference.

### Languages Supported
`en`, `hinglish`, `hi`, `gu`, `mr`, `bn`, `ta`, `te` — plus Roman/native script toggle.

### Helplines (verified 19 Nov 2026)
- Tele-MANAS: 14416 / 1-800-891-4416
- iCall (TISS): 9152987821
- Emergency: 112
- Vandrevala Foundation: +91 9999 666 555

---

## 3. What Is Simulated / On-Device Only

| Feature | Storage | Server persistence |
|---|---|---|
| Mood logs | localStorage | ❌ |
| Journal entries | localStorage | ❌ |
| Thought records | localStorage | ❌ |
| Chat history | localStorage | ❌ |
| Wellness points | localStorage | ❌ |
| Focus sessions | localStorage | ❌ |

> These features will be lost if the user clears browser storage or switches devices.

---

## 4. What Requires Persistent Backend Storage (New Backend)

All items from Section 3, plus:
- Mood analytics (server-side aggregation, streak calculation, timezone-aware)
- Journal AI analysis metadata (server-side cache, with consent)
- Thought record history across devices
- Wellness activity history (points, streaks)

---

## 5. What Requires AI Inference (New Backend)

| Capability | Current model | Required Google model |
|---|---|---|
| Chat companion | legacy-prototype → openai/gpt-6-astra | Gemini 2.5 Flash (via Google AI Studio) |
| Journal analysis | legacy-prototype → openai/gpt-6-astra | Gemini 2.5 Flash |
| Crisis classification | Regex only | Google MuRIL (multilingual) |
| Moderation / emotion tagging | None | Gemma 2 2B-IT (Vertex AI) |

---

## 6. What Requires Google Cloud Infrastructure

- **Google Cloud SQL for PostgreSQL** — replace Supabase Postgres
- **Firebase Authentication** — replace Supabase Auth
- **Google AI Studio / Gemini 2.5 Flash** — replace legacy-prototype AI Gateway
- **Vertex AI** — MuRIL, Gemma 2 model serving
- **Google Cloud Run** — backend API deployment
- **Google Cloud DLP** — PII detection/redaction for community posts
- **Google Cloud Secret Manager** — credential management
- **Google Artifact Registry** — container image storage
- **Google Cloud Build** — CI/CD pipeline
- **Google Cloud Logging + Monitoring** — observability

---

## 7. Existing Dependencies to Replace

| Existing | Replacement |
|---|---|
| `@supabase/supabase-js` (auth) | Firebase Admin SDK + Firebase Auth |
| `@supabase/supabase-js` (database) | SQLAlchemy + psycopg2 → Cloud SQL |
| `legacy-prototype-pkg` | `google-generativeai` Python SDK |
| `legacy-prototype-pkg` | Firebase Auth client SDK (frontend keeps as-is; backend replaces verification) |

> **Important:** The frontend currently uses Supabase auth and direct Supabase client calls. These cannot be changed under this assignment. The new backend will operate independently; frontend integration will require future changes documented in `docs/backend/frontend-integration-guide.md`.

---

## 8. API Contracts the Frontend Currently Expects

### Supabase Direct Calls (not via REST API)
The frontend uses Supabase client SDK directly:
- `supabase.auth.*` — login, signup, session, password reset
- `supabase.from("profiles").select/update/insert` — profile CRUD
- `supabase.rpc("community_feed")` — anonymous feed
- `supabase.rpc("community_toggle_support")` — support reaction
- `supabase.rpc("community_block_author")` — block
- `supabase.rpc("community_delete_my_post")` — delete own post
- `supabase.from("community_posts").insert` — create post
- `supabase.from("community_reports").insert` — report post
- `supabase.from("community_members").insert/delete` — join/leave circle

### TanStack Start Server Routes
- `POST /api/chat` — streaming chat with companion

### TanStack Start Server Functions
- `analyzeJournal({text, prompt})` — journal AI analysis (server function, not REST)

---

## 9. Frontend Features That Cannot Connect to New Backend Without Frontend Changes

| Feature | Reason |
|---|---|
| Auth (login/signup/session) | Frontend uses Supabase Auth client; must change to Firebase Auth SDK |
| Profile read/write | Frontend calls `supabase.from("profiles")` directly |
| Community feed, posts, reactions | Frontend uses Supabase RPC functions directly |
| Journal analysis | Frontend calls TanStack server function; must change to REST call |
| Mood/journal/thought persistence | Currently localStorage-only; must add API calls |
| Chat | Frontend calls `/api/chat` with Supabase bearer token; must change to Firebase token |

> All these integration points are documented in `docs/backend/frontend-integration-guide.md`. **No frontend files will be changed during this assignment.**

---

## 10. Architecture Assessment

### Strengths of Existing Frontend
- Well-structured React with TanStack Router
- Solid crisis detection (regex-based, multilingual, tested)
- Good companion system-prompt engineering
- Anonymous community with privacy-respecting feed function
- Accurate helpline data (verified Nov 2026)
- Offline fallback for journal analysis

### Gaps the New Backend Must Address
1. All activity data is localStorage-only — no cross-device sync, no analytics
2. AI calls go through legacy-prototype (prohibited) — must move to Google AI Studio
3. No server-side safety enforcement — crisis detection must be enforced before AI inference
4. No PII scrubbing before AI processing
5. No server-side encryption of sensitive content
6. Auth relies on Supabase — must rebuild with Firebase
7. No rate limiting, usage tracking, or abuse prevention on AI endpoints
8. No server-side audit logging of safety events

---

## 11. Frontend Integrity

- **169 frontend files** catalogued.
- **SHA-256 baseline** stored at `docs/backend/frontend-hash-baseline.json`.
- **Git baseline commit** created with message `"baseline: initial untouched frontend"`.
- **Zero modifications** made to any existing frontend file during this audit.

Final verification will be performed after backend implementation is complete (Phase 9).

