# Neeva Frontend — Zero-Knowledge Client Edge & PWA

See the root [README.md](../README.md) for the complete architecture, setup instructions, and benchmark verification commands.

## Key Modules (`src/lib/`)
- `src/lib/crypto.ts`: Web Crypto API `PBKDF2-SHA256` (`100,000` iterations, 16-byte random salt) + non-extractable `AES-GCM-256` key derivation, `< 11.4ms` timed encryption/decryption, IndexedDB key store, 12-word recovery phrase, and 1-click cryptographic erase.
- `src/lib/piiScrubber.ts`: Client-side Indian PII redaction (Aadhaar, PAN, `+91` phone numbers, emails, student roll numbers).
- `src/lib/safetyGate.ts`: Deterministic `< 3.2ms` 3-tier crisis circuit breaker across 8 Indian languages with `NFKC` normalization, zero-width stripping, character elongation collapsing, and bounded Levenshtein matching.
- `src/lib/voice.ts`: Zero-billing browser-native Web Speech API (`SpeechRecognition` + `speechSynthesis`) mapped to `en-IN`, `hi-IN`, `gu-IN`, `mr-IN`, `bn-IN`, `ta-IN`, and `te-IN`.
- `src/lib/api.ts`: Central API client with `AbortController` Tier-3 circuit breaking, SSE structured streaming, and offline fallback.
