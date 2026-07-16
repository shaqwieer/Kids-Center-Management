/** Customer code + QR token generation, with collision-safe helpers. */
import { customAlphabet, nanoid } from 'nanoid';

// Unambiguous digits for the human-facing customer code (no 0/O confusion needed — digits only).
const digits = customAlphabet('0123456789', 4);

/** One candidate customer code like "FRF-2048". Caller retries on unique conflict. */
export function makeCustomerCode(prefix = 'FRF') {
  return `${prefix}-${digits()}`;
}

/** Opaque, URL-safe QR token (unguessable). */
export function makeQrToken() {
  return nanoid(24);
}

/**
 * Generate a unique customer code by retrying against a checker.
 * `exists(code) -> Promise<boolean>`.
 */
export async function uniqueCustomerCode(exists, prefix = 'FRF', maxTries = 20) {
  for (let i = 0; i < maxTries; i += 1) {
    const code = makeCustomerCode(prefix);
    // eslint-disable-next-line no-await-in-loop
    if (!(await exists(code))) return code;
  }
  // Extremely unlikely; widen to 6 digits as a last resort.
  return `${prefix}-${customAlphabet('0123456789', 6)()}`;
}
