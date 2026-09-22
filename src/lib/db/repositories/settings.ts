import { db } from '../schema';
import type { UserSettings } from '@/types/db';

// ============================================================
// User Settings Repository
// Persists local offline settings (e.g. language, sound) in IndexedDB
// ============================================================

export async function getSetting(key: string, defaultValue: string = ''): Promise<string> {
  const setting: UserSettings | undefined = await db.userSettings.get(key);
  return setting ? setting.value : defaultValue;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const record: UserSettings = { key, value };
  await db.userSettings.put(record);
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const all: UserSettings[] = await db.userSettings.toArray();
  const map: Record<string, string> = {};
  for (const s of all) {
    map[s.key] = s.value;
  }
  return map;
}
