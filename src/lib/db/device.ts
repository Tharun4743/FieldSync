import { v4 as uuidv4 } from 'uuid';
import { db } from './schema';

const DEVICE_ID_KEY = 'deviceId';

/**
 * Initialize device ID on first installation.
 * Subsequent calls return the same ID — never generates a new one.
 *
 * The device ID is critical for:
 * - Operation identification (operationId = `${deviceId}-${entityId}-${clock}`)
 * - Conflict tracking (which device created which operation)
 * - Audit history (who/where changed what)
 * - Sync debugging
 */
export async function initDeviceId(): Promise<string> {
  const existing = await db.appMetadata.get(DEVICE_ID_KEY);
  if (existing) {
    return existing.value;
  }

  const deviceId = `device-${uuidv4()}`;
  await db.appMetadata.put({ key: DEVICE_ID_KEY, value: deviceId });

  // Initialize sync state for this device
  await db.syncState.put({
    deviceId,
    pendingOperations: 0,
    pendingMedia: 0,
    conflictCount: 0,
    syncStatus: 'OFFLINE',
  });

  // Store schema version
  await db.appMetadata.put({
    key: 'schemaVersion',
    value: '2',
  });

  // Store app version
  await db.appMetadata.put({
    key: 'appVersion',
    value: import.meta.env.VITE_APP_VERSION ?? '1.0.0',
  });

  console.info(`[FieldSync] New device registered: ${deviceId}`);
  return deviceId;
}

/**
 * Get the device ID — throws if not initialized yet.
 * Call initDeviceId() first during app bootstrap.
 */
export async function getDeviceId(): Promise<string> {
  const record = await db.appMetadata.get(DEVICE_ID_KEY);
  if (!record) {
    // Fallback: initialize now
    return initDeviceId();
  }
  return record.value;
}

/**
 * Synchronous version — returns cached value from module state.
 * Only safe to call after initDeviceId() has resolved.
 */
let _cachedDeviceId: string | null = null;

export function getCachedDeviceId(): string {
  if (!_cachedDeviceId) {
    throw new Error('[FieldSync] Device ID not initialized. Call initDeviceId() first.');
  }
  return _cachedDeviceId;
}

export async function bootstrapDevice(): Promise<string> {
  const id = await initDeviceId();
  _cachedDeviceId = id;
  return id;
}
