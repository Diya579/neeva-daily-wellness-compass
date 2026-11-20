/**
 * Client-side error telemetry logger (local-only, zero third-party vendor scripts).
 */

export function reportClientError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (typeof console !== "undefined") {
    console.error("[Neeva Client Error]", error, context ?? {});
  }
}

