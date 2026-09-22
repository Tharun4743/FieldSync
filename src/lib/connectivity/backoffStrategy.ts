/**
 * Exponential backoff strategy for sync retries.
 * Base: 1s, max: 5min, factor: 2, jitter: ±20%
 */

export interface BackoffState {
  attempts: number;
  nextDelayMs: number;
}

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 5 * 60 * 1_000; // 5 minutes
const FACTOR = 2;
const JITTER = 0.2; // ±20%

export function createBackoffState(): BackoffState {
  return { attempts: 0, nextDelayMs: BASE_DELAY_MS };
}

export function nextBackoffDelay(state: BackoffState): number {
  const jitter = 1 + (Math.random() * 2 - 1) * JITTER;
  const delay = Math.min(state.nextDelayMs * jitter, MAX_DELAY_MS);
  return Math.round(delay);
}

export function advanceBackoff(state: BackoffState): BackoffState {
  return {
    attempts: state.attempts + 1,
    nextDelayMs: Math.min(state.nextDelayMs * FACTOR, MAX_DELAY_MS),
  };
}

export function resetBackoff(): BackoffState {
  return createBackoffState();
}

export function shouldGiveUp(state: BackoffState, maxAttempts = 10): boolean {
  return state.attempts >= maxAttempts;
}

/**
 * Sleep for the current backoff delay, then advance state.
 * Returns the new state.
 */
export async function backoffAndAdvance(state: BackoffState): Promise<BackoffState> {
  const delay = nextBackoffDelay(state);
  await new Promise(resolve => setTimeout(resolve, delay));
  return advanceBackoff(state);
}
