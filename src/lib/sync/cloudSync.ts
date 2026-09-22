import { supabase } from '../auth/supabaseClient';
import { db } from '../db/schema';
import { seedLocalDatabase, ensureDefaultUsers } from '../db/seed';
import type { Inspection, Asset, ChecklistItem, AuditEvent } from '@/types/db';

export async function syncFromSupabase(): Promise<boolean> {
  try {
    // 1. Fetch remote inspections
    const { data: remoteInspections, error: inspErr } = await supabase
      .from('inspections')
      .select('*');

    if (inspErr || !remoteInspections || remoteInspections.length === 0) {
      console.info('[CloudSync] No remote inspections found in Supabase. Ensuring local seed data...');
      await ensureLocalSeedIfEmpty();
      return false;
    }

    const localInspections: Inspection[] = remoteInspections.map((row) => ({
      id: row.id,
      title: row.title,
      siteName: row.site_name,
      assetId: row.asset_id ?? '',
      category: row.category ?? 'GENERAL',
      status: row.status ?? 'PENDING',
      issueStatus: row.issue_status ?? 'NEW',
      priority: row.priority ?? 'MEDIUM',
      workflowStage: row.workflow_stage ?? 'RAISED',
      assignedTo: row.assigned_to ? [row.assigned_to] : [],
      assignedAt: row.assigned_at ?? row.created_at,
      supervisorId: row.supervisor_id ?? undefined,
      supervisorName: row.supervisor_name ?? undefined,
      supervisorNotes: row.supervisor_notes ?? undefined,
      supervisedAt: row.supervised_at ?? undefined,
      reportedBy: row.reported_by ?? undefined,
      customerId: row.customer_id ?? undefined,
      customerEmail: row.customer_email ?? undefined,
      customerPhone: row.customer_phone ?? undefined,
      customerNotes: row.customer_notes ?? undefined,
      technicianCompletedAt: row.technician_completed_at ?? undefined,
      reworkReason: row.rework_reason ?? undefined,
      verifiedBy: row.verified_by ?? undefined,
      verifiedByName: row.verified_by_name ?? undefined,
      verifiedAt: row.verified_at ?? undefined,
      resolutionSummary: row.resolution_summary ?? undefined,
      scheduledDate: row.scheduled_date ?? undefined,
      version: row.version ?? 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      serverVersion: row.version ?? 1,
      localVersion: row.version ?? 1,
      syncStatus: 'SYNCED',
    }));

    await db.inspections.bulkPut(localInspections);
    console.info(`[CloudSync] Synced ${localInspections.length} inspections from Supabase.`);

    // 2. Fetch remote assets
    const { data: remoteAssets } = await supabase.from('assets').select('*');
    if (remoteAssets && remoteAssets.length > 0) {
      const localAssets: Asset[] = remoteAssets.map((row) => ({
        id: row.id,
        name: row.name,
        assetCode: row.asset_code,
        location: row.location,
        type: row.type,
        manufacturer: row.manufacturer ?? undefined,
        model: row.model ?? undefined,
        installDate: row.install_date ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
      await db.assets.bulkPut(localAssets);
    }

    // 3. Fetch remote checklist items
    const { data: remoteItems } = await supabase.from('checklist_items').select('*');
    if (remoteItems && remoteItems.length > 0) {
      const localItems: ChecklistItem[] = remoteItems.map((row) => ({
        id: row.id,
        inspectionId: row.inspection_id,
        question: row.question,
        type: row.type,
        required: row.required ?? true,
        order: row.sort_order ?? 0,
        unit: row.unit ?? undefined,
        minValue: row.min_value ?? undefined,
        maxValue: row.max_value ?? undefined,
        options: row.options ?? undefined,
        createdAt: row.created_at,
      }));
      await db.checklistItems.bulkPut(localItems);
    }

    // 4. Fetch remote audit events directly from Supabase database
    const { data: remoteAuditEvents } = await supabase
      .from('audit_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (remoteAuditEvents && remoteAuditEvents.length > 0) {
      const localAuditEvents: AuditEvent[] = remoteAuditEvents.map((row) => ({
        id: row.id,
        operationId: row.operation_id ?? undefined,
        userId: row.user_id ?? '',
        userName: row.user_name || 'Staff Member',
        deviceId: row.device_id ?? 'device-cloud',
        entityType: row.entity_type ?? 'INSPECTION',
        entityId: row.entity_id ?? row.id,
        inspectionId: row.inspection_id ?? row.entity_id ?? '',
        action: (row.action ?? 'UPDATED') as import('@/types/db').AuditAction,
        field: row.field ?? undefined,
        beforeValue: row.before_value ?? undefined,
        afterValue: row.after_value ?? undefined,
        createdAt: row.created_at,
      }));
      await db.auditEvents.bulkPut(localAuditEvents);
      console.info(`[CloudSync] Synced ${localAuditEvents.length} audit events directly from Supabase.`);
    }

    return true;
  } catch (err) {
    console.warn('[CloudSync] Failed to sync from Supabase, falling back to local database:', err);
    await ensureLocalSeedIfEmpty();
    return false;
  }
}

export async function ensureLocalSeedIfEmpty(): Promise<void> {
  await ensureDefaultUsers();
  const count = await db.inspections.count();
  const auditCount = await db.auditEvents.count();
  if (count === 0 || auditCount === 0) {
    console.info('[CloudSync] Ensuring local database records are seeded...');
    await seedLocalDatabase(undefined, undefined, false);
  }
}

