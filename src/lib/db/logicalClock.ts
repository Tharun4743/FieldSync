import { db } from './schema';
import { getCachedDeviceId } from './device';

const CLOCK_KEY = 'logicalClock';

/**
 * Lamport logical clock for operation ordering.
 *
 * Rules:
 *   - Monotonically increasing per device
 *   - Always persisted to IndexedDB (survives refresh/close)
 *   - On receive: clock = max(local, received) + 1
 *   - On send: clock = clock + 1
 *
 * This gives us a causal ordering of operations without relying
 * solely on wall-clock timestamps, which can drift across devices.
 */
export class LogicalClock {
  private static _value: number | null = null;

  static async initialize(): Promise<void> {
    const record = await db.appMetadata.get(CLOCK_KEY);
    LogicalClock._value = record ? parseInt(record.value, 10) : 0;
  }

  static getValue(): number {
    if (LogicalClock._value === null) {
      throw new Error('[LogicalClock] Not initialized. Call initialize() first.');
    }
    return LogicalClock._value;
  }

  /** Increment and persist — call before creating an operation */
  static async tick(): Promise<number> {
    if (LogicalClock._value === null) await LogicalClock.initialize();
    LogicalClock._value = (LogicalClock._value ?? 0) + 1;
    await db.appMetadata.put({ key: CLOCK_KEY, value: String(LogicalClock._value) });
    return LogicalClock._value;
  }

  /**
   * Merge with a received remote clock value.
   * Per Lamport: local = max(local, remote) + 1
   */
  static async receive(remoteClock: number): Promise<number> {
    if (LogicalClock._value === null) await LogicalClock.initialize();
    LogicalClock._value = Math.max(LogicalClock._value ?? 0, remoteClock) + 1;
    await db.appMetadata.put({ key: CLOCK_KEY, value: String(LogicalClock._value) });
    return LogicalClock._value;
  }
}

/**
 * Build a deterministic, idempotent operation ID.
 * Format: {deviceId}-{entityId}-{logicalClock}
 *
 * The same (device, entity, clock) triple always produces the same ID,
 * making server-side duplicate detection trivial.
 */
export function buildOperationId(entityId: string, logicalClock: number): string {
  const deviceId = getCachedDeviceId();
  return `${deviceId}-${entityId}-${logicalClock}`;
}
