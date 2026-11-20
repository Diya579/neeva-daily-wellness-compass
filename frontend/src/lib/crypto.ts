/**
 * Client-Edge Zero-Knowledge Vault (Web Crypto API)
 * - Key Derivation: PBKDF2 with 100,000 iterations, SHA-256, 16-byte random salt
 * - Key Isolation: AES-GCM-256 CryptoKey derived with extractable: false (cannot be exported)
 * - Cipher: AES-GCM (256-bit key, 12-byte random IV, 128-bit authentication tag)
 * - Telemetry: High-resolution performance.now() timing (< 11.4ms target)
 * - Recovery: 12-word CSPRNG recovery phrase (zero server-side key escrow)
 */

export const PBKDF2_ITERATIONS = 100_000;
export const SALT_BYTE_LENGTH = 16;
export const IV_BYTE_LENGTH = 12;
export const AES_KEY_BITS = 256;
export const GCM_TAG_BITS = 128;

export interface EncryptedVaultPayload {
  ciphertext: string; // Base64-encoded AES-GCM ciphertext + 128-bit auth tag
  iv: string; // Base64-encoded 12-byte IV
  salt: string; // Base64-encoded 16-byte PBKDF2 salt
  durationMs: number; // Measured encryption duration via performance.now()
  algorithm: "AES-GCM-256";
  kdf: "PBKDF2-SHA256-100000";
}

export interface DecryptedVaultPayload {
  plaintext: string;
  durationMs: number;
}

// Curated 256-word deterministic recovery wordlist (256 = 2^8 -> 1 byte of entropy per word Index)
const RECOVERY_WORDLIST: readonly string[] = [
  "amber", "anchor", "apple", "aroma", "arrow", "aspen", "atlas", "aurora",
  "autumn", "bamboo", "Banyan", "beacon", "berry", "Birch", "blossom", "breeze",
  "bridge", "brook", "calm", "candle", "canyon", "cedar", "chakra", "cherry",
  "chime", "citrus", "cloud", "clover", "cobalt", "coral", "cosmos", "cotton",
  "cradle", "creek", "crest", "crystal", "cypress", "dahlia", "dawn", "delta",
  "dewdrop", "diya", "dolphin", "dream", "drift", "drizzle", "dune", "dusk",
  "earth", "echo", "eclipse", "ember", "emerald", "estuary", "feather", "fern",
  "field", "firefly", "fjord", "flame", "flora", "flute", "forest", "fountain",
  "frost", "galaxy", "garden", "garnet", "gazelle", "gentle", "glacier", "glade",
  "glimmer", "glow", "granite", "grove", "harbor", "harmony", "harvest", "haven",
  "hazel", "hearth", "heather", "hibiscus", "horizon", "humble", "indigo", "island",
  "ivory", "jasmine", "jasper", "journey", "juniper", "karma", "kindred", "lagoon",
  "lantern", "lark", "laurel", "lavender", "leaf", "legacy", "lemon", "liberty",
  "lilac", "lily", "linen", "lotus", "lullaby", "lumen", "lunar", "lychee",
  "magnolia", "mango", "mantra", "maple", "marble", "marigold", "meadow", "melody",
  "meridian", "meteor", "mimosa", "mindful", "mineral", "mirage", "mist", "monsoon",
  "moon", "morning", "moss", "mountain", "myrtle", "nebula", "nectar", "nirvana",
  "noble", "nomad", "north", "nutmeg", "oasis", "Amla", "ocean", "olive",
  "onyx", "opal", "orbit", "orchid", "origami", "osprey", "palm", "papaya",
  "parish", "pastel", "path", "patience", "peace", "peach", "pearl", "pebble",
  "peony", "pepper", "petal", "phoenix", "pillar", "pine", "planet", "plaza",
  "plum", "podium", "poet", "pollen", "pond", "poplar", "poppy", "portal",
  "prairie", "prism", "pulse", "quartz", "quiet", "quilt", "radiant", "rain",
  "rainbow", "ravine", "redwood", "reef", "refuge", "relief", "renewal", "repose",
  "resonance", "rest", "rhythm", "ribbon", "ridge", "ripple", "river", "robin",
  "rose", "rosemary", "ruby", "saffron", "sage", "sahara", "Sandal", "sanctuary",
  "sapphire", "saturn", "savanna", "scarlet", "season", "seed", "serene", "shadow",
  "shelter", "shimmer", "shore", "sierra", "silence", "silver", "sky", "slumber",
  "snow", "solace", "solstice", "sonnet", "soothe", "spark", "sparrow", "spirit",
  "spring", "sprout", "star", "stillness", "stone", "stream", "summit", "sunbeam",
  "Asha", "sunrise", "sunset", "swallow", "sycamore", "tamarind", "temple", "terra",
  "thistle", "thunder", "thyme", "tide", "timber", "topaz", "tranquil", "tulsi"
].map((w) => w.toLowerCase());

function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis !== "undefined" && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error("Web Crypto API (crypto.subtle) is not available in this environment.");
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  if (typeof btoa === "function") {
    return btoa(binary);
  }
  return Buffer.from(bytes).toString("base64");
}

export function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/** Generate a cryptographically random 16-byte salt (or custom length). */
export function generateSalt(byteLength: number = SALT_BYTE_LENGTH): Uint8Array {
  const salt = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(salt);
  return salt;
}

/** Generate a cryptographically random 12-byte AES-GCM IV. */
export function generateIV(byteLength: number = IV_BYTE_LENGTH): Uint8Array {
  const iv = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(iv);
  return iv;
}

/**
 * Derive a NON-EXTRACTABLE AES-GCM-256 CryptoKey using PBKDF2-SHA256 with 100,000 iterations.
 * Because `extractable` is strictly `false`, `crypto.subtle.exportKey` will throw an InvalidAccessError,
 * preventing XSS key exfiltration.
 */
export async function deriveVaultKey(
  passphrase: string,
  salt: Uint8Array = generateSalt(SALT_BYTE_LENGTH)
): Promise<{ key: CryptoKey; salt: Uint8Array; durationMs: number }> {
  const start = performance.now();
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const baseKey = await subtle.importKey(
    "raw",
    encoder.encode(passphrase.normalize("NFKC")),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const key = await subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    {
      name: "AES-GCM",
      length: AES_KEY_BITS,
    },
    false, // NON-EXTRACTABLE
    ["encrypt", "decrypt"]
  );

  const durationMs = Number((performance.now() - start).toFixed(3));
  return { key, salt, durationMs };
}

/**
 * Encrypt plaintext with a non-extractable AES-GCM-256 CryptoKey.
 * Measures execution time via performance.now() to verify the < 11.4ms benchmark.
 */
export async function encryptPayload(
  plaintext: string,
  key: CryptoKey,
  salt?: Uint8Array
): Promise<EncryptedVaultPayload> {
  if (key.extractable) {
    throw new Error("Security violation: Vault CryptoKey must be non-extractable (extractable: false).");
  }
  const subtle = getSubtleCrypto();
  const iv = generateIV(IV_BYTE_LENGTH);
  const actualSalt = salt ?? generateSalt(SALT_BYTE_LENGTH);
  const encoded = new TextEncoder().encode(plaintext);

  const start = performance.now();
  const cipherBuffer = await subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource,
      tagLength: GCM_TAG_BITS,
    },
    key,
    encoded
  );
  const durationMs = Number((performance.now() - start).toFixed(3));

  return {
    ciphertext: bytesToBase64(new Uint8Array(cipherBuffer)),
    iv: bytesToBase64(iv),
    salt: bytesToBase64(actualSalt),
    durationMs,
    algorithm: "AES-GCM-256",
    kdf: "PBKDF2-SHA256-100000",
  };
}

/**
 * Decrypt an AES-GCM-256 EncryptedVaultPayload.
 * Throws a cryptographic authentication error if the ciphertext, auth tag, or IV is tampered with.
 */
export async function decryptPayload(
  payload: Pick<EncryptedVaultPayload, "ciphertext" | "iv">,
  key: CryptoKey
): Promise<DecryptedVaultPayload> {
  const subtle = getSubtleCrypto();
  const cipherBytes = base64ToBytes(payload.ciphertext);
  const ivBytes = base64ToBytes(payload.iv);

  const start = performance.now();
  const plainBuffer = await subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBytes as BufferSource,
      tagLength: GCM_TAG_BITS,
    },
    key,
    cipherBytes as BufferSource
  );
  const durationMs = Number((performance.now() - start).toFixed(3));
  const plaintext = new TextDecoder().decode(plainBuffer);

  return { plaintext, durationMs };
}

/**
 * Generate a 12-word recovery phrase using CSPRNG (`crypto.getRandomValues`).
 */
export function generateRecoveryPhrase(): string {
  const randomBytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes)
    .map((b) => RECOVERY_WORDLIST[b % RECOVERY_WORDLIST.length]!)
    .join(" ");
}

/**
 * Validate a 12-word recovery phrase.
 */
export function isValidRecoveryPhrase(phrase: string): boolean {
  const words = phrase
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length !== 12) return false;
  return words.every((w) => RECOVERY_WORDLIST.includes(w));
}

/**
 * Recover a non-extractable AES-GCM-256 key from the user's 12-word recovery phrase and 16-byte salt.
 */
export async function deriveKeyFromRecoveryPhrase(
  recoveryPhrase: string,
  salt?: Uint8Array
): Promise<{ key: CryptoKey; salt: Uint8Array; durationMs: number }> {
  const normalized = recoveryPhrase.trim().toLowerCase().replace(/\s+/g, " ");
  return deriveVaultKey(normalized, salt);
}

// ============================================================================
// Session Key Isolation: In-Memory + IndexedDB Non-Extractable Key Store
// (Never stores raw key material in localStorage)
// ============================================================================

const IDB_DB_NAME = "neeva_zk_keystore";
const IDB_STORE_NAME = "keys";

interface VaultSessionEntry {
  key: CryptoKey;
  saltBase64: string;
}

const memoryKeyCache = new Map<string, VaultSessionEntry>();

function openKeyDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Store a non-extractable CryptoKey in memory and IndexedDB structured clone storage.
 */
export async function storeVaultSessionKey(
  userId: string,
  key: CryptoKey,
  salt: Uint8Array
): Promise<void> {
  if (key.extractable) {
    throw new Error("Cannot store an extractable CryptoKey in the zero-knowledge vault.");
  }
  const entry: VaultSessionEntry = { key, saltBase64: bytesToBase64(salt) };
  memoryKeyCache.set(userId, entry);

  const db = await openKeyDatabase();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, "readwrite");
      tx.objectStore(IDB_STORE_NAME).put(entry, userId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

/**
 * Retrieve or automatically initialize the user's non-extractable CryptoKey.
 */
export async function getOrCreateVaultSessionKey(
  userId: string,
  passphraseFallback?: string
): Promise<{ key: CryptoKey; salt: Uint8Array; recoveryPhrase?: string }> {
  const mem = memoryKeyCache.get(userId);
  if (mem) {
    return { key: mem.key, salt: base64ToBytes(mem.saltBase64) };
  }

  const db = await openKeyDatabase();
  if (db) {
    const loaded = await new Promise<VaultSessionEntry | null>((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE_NAME, "readonly");
        const req = tx.objectStore(IDB_STORE_NAME).get(userId);
        req.onsuccess = () => {
          db.close();
          resolve((req.result as VaultSessionEntry) ?? null);
        };
        req.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch {
        db.close();
        resolve(null);
      }
    });
    if (loaded && loaded.key) {
      memoryKeyCache.set(userId, loaded);
      return { key: loaded.key, salt: base64ToBytes(loaded.saltBase64) };
    }
  }

  const recoveryPhrase = passphraseFallback || generateRecoveryPhrase();
  const { key, salt } = await deriveVaultKey(recoveryPhrase);
  await storeVaultSessionKey(userId, key, salt);
  return { key, salt, recoveryPhrase };
}

/**
 * DPDP Act 2023 Right to Erasure:
 * Cryptographically erases all in-memory keys, drops the IndexedDB keystore,
 * and removes all Neeva keys from localStorage / sessionStorage.
 */
export async function cryptographicEraseLocalVault(): Promise<void> {
  memoryKeyCache.clear();

  if (typeof indexedDB !== "undefined") {
    await new Promise<void>((resolve) => {
      try {
        const req = indexedDB.deleteDatabase(IDB_DB_NAME);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  if (typeof window !== "undefined") {
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && (k.startsWith("neeva:") || k.startsWith("sb-"))) {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => window.localStorage.removeItem(k));
      window.sessionStorage.clear();
    } catch {
      /* ignore storage errors */
    }
  }
}

