import { db } from '../db/schema';

export interface SearchResultItem {
  id: string;
  type: 'ASSET' | 'INSPECTION' | 'CHECKLIST_ITEM' | 'CHECKLIST' | 'NOTE';
  title: string;
  subtitle: string;
  siteName: string;
  assetCode?: string;
  inspectionId?: string;
  inspectionCount?: number;
  unresolvedIssuesCount?: number;
  lastInspectionDate?: string;
  matchedField: string;
  badge?: string;
}

/**
 * Searches locally cached records in IndexedDB with ZERO network requests.
 */
export async function searchLocalDatabase(query: string): Promise<SearchResultItem[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const [assets, inspections, checklistItems, conflicts] = await Promise.all([
    db.assets.toArray(),
    db.inspections.toArray(),
    db.checklistItems.toArray(),
    db.conflicts.toArray(),
  ]);

  const results: SearchResultItem[] = [];
  const addedIds = new Set<string>();

  // Count open conflicts per inspection
  const openConflictsByInspection = new Map<string, number>();
  for (const c of conflicts) {
    if (c.status === 'OPEN' || c.status === ('PENDING' as string)) {
      openConflictsByInspection.set(
        c.inspectionId,
        (openConflictsByInspection.get(c.inspectionId) ?? 0) + 1
      );
    }
  }

  // 1. Search Assets
  for (const asset of assets) {
    const codeMatch = asset.assetCode.toLowerCase().includes(q);
    const nameMatch = asset.name.toLowerCase().includes(q);
    const locationMatch = asset.location.toLowerCase().includes(q);
    const typeMatch = asset.type.toLowerCase().includes(q);

    if (codeMatch || nameMatch || locationMatch || typeMatch) {
      const assetInspections = inspections.filter((i) => i.assetId === asset.id);
      let openIssues = 0;
      for (const insp of assetInspections) {
        openIssues += openConflictsByInspection.get(insp.id) ?? 0;
      }

      const latestInspection = assetInspections.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0];

      results.push({
        id: asset.id,
        type: 'ASSET',
        title: asset.name,
        subtitle: `${asset.assetCode} · ${asset.type}`,
        siteName: asset.location,
        assetCode: asset.assetCode,
        inspectionId: latestInspection?.id,
        inspectionCount: assetInspections.length,
        unresolvedIssuesCount: openIssues,
        lastInspectionDate: latestInspection?.updatedAt,
        matchedField: codeMatch
          ? `Asset Code: ${asset.assetCode}`
          : nameMatch
          ? `Asset Name: ${asset.name}`
          : `Location: ${asset.location}`,
      });
      addedIds.add(`asset-${asset.id}`);
    }
  }

  // 2. Search Inspections
  for (const inspection of inspections) {
    const titleMatch = inspection.title.toLowerCase().includes(q);
    const siteMatch = inspection.siteName.toLowerCase().includes(q);
    const idMatch = inspection.id.toLowerCase().includes(q);

    if (titleMatch || siteMatch || idMatch) {
      const asset = assets.find((a) => a.id === inspection.assetId);
      const openIssues = openConflictsByInspection.get(inspection.id) ?? 0;

      results.push({
        id: inspection.id,
        type: 'INSPECTION',
        title: inspection.title,
        subtitle: asset ? `${asset.assetCode} · ${inspection.status}` : inspection.status,
        siteName: inspection.siteName,
        assetCode: asset?.assetCode,
        inspectionId: inspection.id,
        unresolvedIssuesCount: openIssues,
        lastInspectionDate: inspection.updatedAt,
        matchedField: titleMatch
          ? `Inspection Title: ${inspection.title}`
          : siteMatch
          ? `Site: ${inspection.siteName}`
          : `Inspection ID: ${inspection.id}`,
      });
      addedIds.add(`inspection-${inspection.id}`);
    }
  }

  // 3. Search Checklist items
  for (const item of checklistItems) {
    if (item.question.toLowerCase().includes(q)) {
      const inspection = inspections.find((i) => i.id === item.inspectionId);
      const asset = inspection ? assets.find((a) => a.id === inspection.assetId) : undefined;

      results.push({
        id: item.id,
        type: 'CHECKLIST_ITEM',
        title: item.question,
        subtitle: inspection?.title ?? 'Checklist Item',
        siteName: inspection?.siteName ?? '',
        assetCode: asset?.assetCode,
        inspectionId: item.inspectionId,
        matchedField: `Checklist Question: "${item.question}"`,
      });
    }
  }

  return results;
}
