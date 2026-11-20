/**
 * Drizzle ORM Schema — Zero-Knowledge Ciphertext-Only Vault & K-Anonymity (K >= 50) Telemetry
 * - `encryptedJournals` stores ONLY { id, userId, ciphertext, iv, salt, algorithm, kdf, createdAt }.
 *   Plaintext journal entries NEVER touch the database schema.
 * - `campusAnonymizedTelemetry` supports the K-Anonymity (HAVING COUNT(DISTINCT user_id) >= 50) campus view.
 */

import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),
  displayName: text("display_name").default("").notNull(),
  goal: text("goal").default("stress").notNull(),
  onboarded: boolean("onboarded").default(false).notNull(),
  companionName: text("companion_name").default("Neeva").notNull(),
  companionVibe: text("companion_vibe").default("bestie").notNull(),
  companionLength: text("companion_length").default("balanced").notNull(),
  companionAvatar: text("companion_avatar").default("bloom").notNull(),
  companionEmoji: boolean("companion_emoji").default(true).notNull(),
  companionApproach: text("companion_approach").default("mix").notNull(),
  companionTone: text("companion_tone").default("gentle").notNull(),
  companionNotes: text("companion_notes").default("").notNull(),
  companionConfigured: boolean("companion_configured").default(false).notNull(),
  dpdpConsentGrantedAt: timestamp("dpdp_consent_granted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Zero-Knowledge Ciphertext-Only Journal Vault Table.
 * Contains NO plaintext column — decryption keys reside exclusively in client-edge Web Crypto (extractable: false).
 */
export const encryptedJournals = pgTable("encrypted_journals", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  salt: text("salt").notNull(),
  algorithm: text("algorithm").default("AES-GCM-256").notNull(),
  kdf: text("kdf").default("PBKDF2-SHA256-100000").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Anonymized Campus Telemetry Table for K-Anonymity (K >= 50) Aggregation View:
 * SQL View Definition:
 *   CREATE VIEW campus_k50_analytics AS
 *   SELECT department, cohort_year,
 *          COUNT(DISTINCT user_id) AS distinct_users,
 *          AVG(mood_score) AS avg_mood_score,
 *          AVG(burnout_index) AS avg_burnout_index
 *   FROM campus_anonymized_telemetry
 *   GROUP BY department, cohort_year
 *   HAVING COUNT(DISTINCT user_id) >= 50;
 */
export const campusAnonymizedTelemetry = pgTable("campus_anonymized_telemetry", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  department: text("department").notNull(),
  cohortYear: text("cohort_year").notNull(),
  moodScore: integer("mood_score").notNull(),
  burnoutIndex: doublePrecision("burnout_index").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
});
