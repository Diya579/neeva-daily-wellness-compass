# Neeva AI — Frontend Integration Guide (Documentation Only)

> **STRICT PRESERVATION NOTICE:**  
> In compliance with **Rule 0 (Absolute Rule: Do Not Touch the Existing Frontend)**, **zero changes** have been made to any file inside `frontend/`. This document defines the exact API contracts, payload formats, mismatches, and step-by-step future changes required when the frontend team is ready to connect `frontend/` to the new Google-only FastAPI backend (`backend/`).

---

## 1. Summary of Current Frontend vs. New Google-Only Backend

| Capability | Current Frozen Frontend (`frontend/`) | New Google-Only Backend (`backend/`) | Compatibility & Migration Strategy |
|---|---|---|---|
| **Authentication** | `@supabase/supabase-js` (`supabase.auth.*`) | **Firebase Authentication** (`firebase-admin` JWT verification) | Replace Supabase client in `src/lib/auth-session.tsx` and `src/routes/auth.tsx` with Firebase Web SDK (`firebase/auth`); pass `await user.getIdToken()` in `Authorization: Bearer <token>`. |
| **User Profile & Companion Settings** | Direct Supabase PostgREST (`supabase.from("profiles")`) | `GET /api/v1/profile`, `PATCH /api/v1/profile`, `DELETE /api/v1/account` | Response fields match `profiles` columns (`display_name`, `goal`, `onboarded`, `companion_*`) plus `preferred_language` and `script_style`. |
| **AI Companion Chat** | `POST /api/chat` calling `@lovable.dev/ai-gateway` (`openai/gpt-6-astra`) | `POST /api/v1/chat` calling **Gemini 2.5 Flash** (`@google/genai` / `google-generativeai`) after **Three-Tier Safety Engine** + **Cloud DLP** | Request body (`companion`, `language`, `script`, `messages`) and streaming `text/plain` response format are **100% wire-compatible**, plus extended support for `hinglish` and `te` (Telugu). |
| **Journal Storage & Analysis** | `localStorage` (`NeevaProvider`) + TanStack Server Fn `analyzeJournal` (`@lovable.dev/ai-gateway`) | `POST /api/v1/journal`, `GET /api/v1/journal`, `PATCH /api/v1/journal/{id}`, `DELETE /api/v1/journal/{id}`, `POST /api/v1/journal/{id}/analyze` | Stores AES-GCM-256 `content_ciphertext` + `content_iv` (base64). Analysis output matches `JOURNAL_ANALYSIS_SCHEMA` (`summary`, `primaryTone`, `valence`, `emotions`, `themes`, `distortions`, `reframes`, `strengths`, `nextStep`) and `{ analysis, source: "ai" \| "offline" }`. |
| **Mood Check-Ins, Analytics & Export** | `localStorage` (`NeevaProvider`) + client CSV/JSON (`src/lib/mood-export.ts`) | `POST /api/v1/moods`, `GET /api/v1/moods`, `GET /api/v1/moods/analytics`, `GET /api/v1/moods/export?format=csv\|json` | Server CSV columns (`date,time,mood,mood_score,intensity,triggers`) and JSON export structure (`{ app: "Neeva", exportedAt, moods }`) match `mood-export.ts` byte-for-byte. |
| **CBT Thought Records** | `localStorage` (`NeevaProvider`) | `POST /api/v1/thought-records`, `GET /api/v1/thought-records`, `PATCH /api/v1/thought-records/{id}`, `DELETE /api/v1/thought-records/{id}` | Maps frontend `ThoughtEntry` (`situation`, `thought` → `automatic_thought`, `emotion` → `emotions`, `before` → `emotion_intensity_before`, `distortions` → `thinking_patterns`, ` realistic` → `balanced_thought`, `after` → `emotion_intensity_after`). |
| **Community Circles & Feed** | Supabase RPCs (`community_feed`, `community_toggle_support`, `community_block_author`, `community_delete_my_post`) | `GET /api/v1/community/feed`, `POST /api/v1/community/posts`, `POST /api/v1/community/posts/{id}/support`, `POST /api/v1/community/posts/{id}/report`, `POST /api/v1/community/posts/{id}/block`, `POST /api/v1/community/circles/{id}/join` | Feed items return the exact fields expected by `community.tsx`: `id`, `alias`, `circle`, `body`, `created_at`, `is_team`, `is_mine`, `support_count`, `supported_by_me` (never exposing `author_id`). |

---

## 2. Documented Contract Mismatches Between Frozen Frontend & Backend

1. **Language Enum in `/api/chat`**:
   - **Frontend issue**: `frontend/src/lib/neeva-data.ts` defines 8 languages (`en`, `hinglish`, `hi`, `gu`, `mr`, `bn`, `ta`, `te`), but `frontend/src/routes/api/chat.ts` line 16 has a narrower Zod enum `z.enum(["en", "hi", "gu", "ta", "mr", "bn"])` which rejects `hinglish` and `te`.
   - **Backend resolution**: `POST /api/v1/chat` accepts all 8 language codes (`en`, `hinglish`, `hi`, `gu`, `mr`, `bn`, `ta`, `te`) and all 3 script styles (`auto`, `roman`, `native`).
2. **Client-Side Encryption in `NeevaProvider`**:
   - **Frontend issue**: Currently `frontend/src/lib/neeva-store.tsx` writes plaintext JSON to `window.localStorage.setItem("neeva:v2:" + userId, JSON.stringify(state))` without WebCrypto AES-GCM-256 encryption.
   - **Backend resolution**: `POST /api/v1/journal` and `POST /api/v1/chat` (when `retain_encrypted=true`) require base64-encoded AES-GCM-256 `content_ciphertext` and 12-byte `content_iv` derived via WebCrypto PBKDF2-SHA256 (`100,000` iterations). Reference WebCrypto snippet is provided in Section 4 below.
3. **Crisis Detection Enforcement**:
   - **Frontend issue**: `frontend/src/lib/crisis.ts` runs client-side in the browser and lacked Telugu (`te`) patterns and Tier 2 passive distress differentiation.
   - **Backend resolution**: The backend enforces the deterministic 8-language + MuRIL ONNX **Three-Tier Safety Engine** server-side before Gemini inference, returning `X-Neeva-Safety-Tier: 3` and `X-Neeva-Crisis-Interrupt: true` headers on acute crisis turns.

---

## 3. Exact Frontend Files Requiring Future Modification (When Unfrozen)

When the frontend freeze is lifted for full-stack cutover, update only these 9 files:

1. `frontend/package.json` — Remove `@supabase/supabase-js`, `@lovable.dev/ai-gateway`, `@lovable.dev/cloud-auth-js`; add `firebase`.
2. `frontend/.env` — Replace `VITE_SUPABASE_*` variables with:
   ```dotenv
   VITE_API_BASE_URL="https://neeva-api-xxxxx-el.a.run.app"
   VITE_FIREBASE_API_KEY="..."
   VITE_FIREBASE_AUTH_DOMAIN="neeva-ai-prod.firebaseapp.com"
   VITE_FIREBASE_PROJECT_ID="neeva-ai-prod"
   ```
3. `frontend/src/lib/auth-session.tsx` — Replace `supabase.auth.onAuthStateChange` with Firebase `onIdTokenChanged(auth, ...)` and expose `getIdToken()`.
4. `frontend/src/routes/auth.tsx` & `frontend/src/routes/reset-password.tsx` — Point sign-in, sign-up, and password reset forms to Firebase Auth SDK and `POST /api/v1/auth/register`.
5. `frontend/src/lib/profile.tsx` — Replace `supabase.from("profiles")` queries with `fetch("${VITE_API_BASE_URL}/api/v1/profile")` (`GET` and `PATCH`).
6. `frontend/src/routes/_authenticated/chat.tsx` — Point fetch URL from `/api/chat` to `${VITE_API_BASE_URL}/api/v1/chat` with Firebase Bearer token; inspect `X-Neeva-Crisis-Interrupt` response header to auto-open `useCrisis()`.
7. `frontend/src/routes/_authenticated/journal.tsx` & `frontend/src/lib/journal.functions.ts` — Encrypt journal entries in the browser with WebCrypto AES-GCM-256 before `POST /api/v1/journal` and call `POST /api/v1/journal/{id}/analyze`.
8. `frontend/src/lib/neeva-store.tsx` — Hydrate and sync moods, thought records, and wellness points with `/api/v1/moods`, `/api/v1/thought-records`, and `/api/v1/wellness/activities`.
9. `frontend/src/routes/_authenticated/community.tsx` — Replace `supabase.rpc("community_feed")` and table inserts with `/api/v1/community/*` REST endpoints.

---

## 4. Reference Browser WebCrypto AES-GCM-256 Implementation (Compatible with Backend)

```typescript
// Compatible with backend/app/privacy/encryption.py (PBKDF2-HMAC-SHA256, 100k iterations, AES-GCM-256, 12-byte IV)
export async function deriveAesKey(passphrase: string, saltBytes: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations: 100_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptForBackend(plaintext: string, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertextBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    content_ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertextBuf))),
    content_iv: btoa(String.fromCharCode(...iv)),
  };
}
```

---

## 5. Example API Requests & Responses

### `POST /api/v1/chat`
**Request:**
```http
POST /api/v1/chat HTTP/1.1
Authorization: Bearer <FIREBASE_ID_TOKEN>
Content-Type: application/json

{
  "companion": {
    "name": "Neeva",
    "vibe": "bestie",
    "length": "balanced",
    "avatar": "bloom",
    "emoji": true,
    "approach": "mix",
    "tone": "gentle",
    "notes": "Preparing for final semester placements"
  },
  "language": "hinglish",
  "script": "roman",
  "messages": [
    { "role": "user", "content": "Yaar placement ka bahut tension ho raha hai" }
  ]
}
```
**Response:** `200 OK` (`text/plain; charset=utf-8` chunked stream, headers `X-Neeva-Safety-Tier: 1`, `X-Neeva-Crisis-Interrupt: false`).

### `POST /api/v1/safety/classify`
**Request:**
```json
{
  "text": "Ab mujhse nahi ho raha yaar"
}
```
**Response (`200 OK`):**
```json
{
  "tier": 2,
  "deterministic_tier": 2,
  "muril_tier": null,
  "confidence": 0.85,
  "should_interrupt": false,
  "crisis_message": null,
  "helplines": [
    {
      "id": "telemanas",
      "name": "Tele-MANAS (Govt. of India)",
      "number": "14416",
      "tel": "14416",
      "hours": "24×7 · free · 20 languages · also 1-800-891-4416",
      "alwaysOpen": true
    }
  ],
  "support_guidance": {
    "breathing_exercise": "4-7-8 Breathing: Inhale quietly through your nose for 4 seconds, hold for 7 seconds, and exhale slowly through your mouth for 8 seconds.",
    "grounding_exercise": "5-4-3-2-1 Grounding: Notice 5 things you can see, 4 things you can touch, 3 things you can hear, 2 things you can smell, and 1 thing you appreciate right now.",
    "recommended_tool": "breathing_478"
  }
}
```

