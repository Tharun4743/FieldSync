import { db } from '../schema';
import type { OfflineWorkPackage } from '@/types/db';

// ============================================================
// Offline Work Package Repository
// Manages downloaded inspection bundles prepared for offline use
// ============================================================

export async function saveOfflinePackage(pkg: OfflineWorkPackage): Promise<void> {
  await db.offlinePackages.put(pkg);
}

export async function getOfflinePackage(id: string): Promise<OfflineWorkPackage | undefined> {
  return db.offlinePackages.get(id);
}

export async function getAllOfflinePackages(): Promise<OfflineWorkPackage[]> {
  return db.offlinePackages.orderBy('downloadedAt').reverse().toArray();
}

export async function deleteOfflinePackage(id: string): Promise<void> {
  await db.offlinePackages.delete(id);
}
