import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/db/database';
import { createOperation } from '../lib/db/repositories/operations';
import { createAuditEvent } from '../lib/db/repositories/auditEvents';
import type { ServiceCategory, IssueStatus } from '../types/db';

describe('Customer-Reported Field Service Workflow (End-to-End)', () => {
  beforeEach(async () => {
    await db.inspections.clear();
    await db.operations.clear();
    await db.auditEvents.clear();
    await db.checklistItems.clear();
    await db.notes.clear();
  });

  it('executes full 6-stage workflow: Customer -> Admin -> Supervisor -> Technician -> Supervisor -> Customer', async () => {
    // ── STAGE 1: CUSTOMER RAISES SERVICE ISSUE OFFLINE ───────────────────────
    const issueId = 'issue-network-404';
    const category: ServiceCategory = 'NETWORK';
    const initialStatus: IssueStatus = 'NEW';

    await db.inspections.add({
      id: issueId,
      title: 'Wi-Fi gateway intermittent in Building B',
      siteName: 'HQ Campus — Building B',
      assetId: 'asset-ap-01',
      priority: 'HIGH',
      status: initialStatus,
      category,
      reportedBy: 'Bob Abd',
      customerId: 'cust-bob',
      customerEmail: 'bob@example.com',
      customerPhone: '+1-555-8822',
      customerNotes: 'Frequent packet drops on 5GHz band affecting second floor.',
      assignedTo: [],
      workflowStage: 'RAISED',
      assignedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      serverVersion: 0,
      localVersion: 1,
      syncStatus: 'PENDING',
    });

    await createOperation({
      userId: 'cust-bob',
      entityType: 'INSPECTION',
      entityId: issueId,
      inspectionId: issueId,
      operationType: 'CREATE',
      payload: {
        title: 'Wi-Fi gateway intermittent in Building B',
        category,
        reportedBy: 'Bob Abd',
      },
    });

    await createAuditEvent({
      userId: 'cust-bob',
      userName: 'Bob Abd',
      entityType: 'INSPECTION',
      entityId: issueId,
      inspectionId: issueId,
      action: 'CREATED',
      metadata: { stage: 'CUSTOMER_RAISED', category },
    });

    // Verify persisted in IndexedDB
    const savedIssue = await db.inspections.get(issueId);
    expect(savedIssue).toBeDefined();
    expect(savedIssue?.status).toBe('NEW');
    expect(savedIssue?.category).toBe('NETWORK');
    expect(savedIssue?.reportedBy).toBe('Bob Abd');
    expect(savedIssue?.assignedTo).toHaveLength(0);

    // ── STAGE 2: ADMIN DISPATCHES SUPERVISOR & TECHNICIAN ───────────────────
    await db.inspections.update(issueId, {
      supervisorId: 'sup-abi',
      supervisorName: 'Abi Kumar',
      assignedTo: ['tech-elakkiya'],
      status: 'ASSIGNED',
      workflowStage: 'ASSIGNED',
      updatedAt: new Date().toISOString(),
    });

    await createAuditEvent({
      userId: 'admin-tharun',
      userName: 'Tharun Erodde',
      entityType: 'INSPECTION',
      entityId: issueId,
      inspectionId: issueId,
      action: 'UPDATED',
      metadata: {
        assignedSupervisor: 'Abi Kumar',
        assignedTechnician: 'Elakkiya S',
      },
    });

    const assignedIssue = await db.inspections.get(issueId);
    expect(assignedIssue?.status).toBe('ASSIGNED');
    expect(assignedIssue?.supervisorId).toBe('sup-abi');
    expect(assignedIssue?.assignedTo).toContain('tech-elakkiya');

    // ── STAGE 3: SUPERVISOR REVIEWS & PROVIDES COORDINATION NOTES ───────────
    await db.inspections.update(issueId, {
      supervisorNotes: 'Perform channel analysis, check PoE injector output, and inspect fiber patch cable.',
      supervisedAt: new Date().toISOString(),
      workflowStage: 'COORDINATED',
      updatedAt: new Date().toISOString(),
    });

    const coordinatedIssue = await db.inspections.get(issueId);
    expect(coordinatedIssue?.supervisorNotes).toContain('channel analysis');
    expect(coordinatedIssue?.workflowStage).toBe('COORDINATED');

    // ── STAGE 4: TECHNICIAN PERFORMS FIELD WORK OFFLINE ─────────────────────
    await db.inspections.update(issueId, {
      status: 'IN_PROGRESS',
      workflowStage: 'FIELD_WORK',
      updatedAt: new Date().toISOString(),
    });

    // Add generic checklist item result
    await db.checklistItems.add({
      id: 'chk-01',
      inspectionId: issueId,
      question: 'Measure PoE Voltage and Power Draw',
      type: 'PASS_FAIL',
      required: true,
      order: 1,
      createdAt: new Date().toISOString(),
    });

    // Add technician note
    await db.notes.add({
      id: 'note-01',
      inspectionId: issueId,
      authorId: 'tech-elakkiya',
      authorName: 'Elakkiya S',
      content: 'Replaced crimped RJ45 patch lead. RSSI improved from -81 dBm to -58 dBm.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'PENDING',
    });

    // ── STAGE 5: TECHNICIAN SUBMITS WORK FOR VERIFICATION ───────────────────
    await db.inspections.update(issueId, {
      status: 'PENDING_VERIFICATION',
      workflowStage: 'AWAITING_VERIFICATION',
      technicianCompletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const submittedIssue = await db.inspections.get(issueId);
    expect(submittedIssue?.status).toBe('PENDING_VERIFICATION');
    expect(submittedIssue?.technicianCompletedAt).toBeDefined();

    // ── STAGE 6: SUPERVISOR VERIFIES AND APPROVES RESOLUTION ────────────────
    await db.inspections.update(issueId, {
      status: 'RESOLVED',
      workflowStage: 'RESOLVED',
      verifiedBy: 'sup-abi',
      verifiedByName: 'Abi Kumar',
      verifiedAt: new Date().toISOString(),
      resolutionSummary: 'Verified Wi-Fi coverage across Lab 2. Signal SNR > 28 dB. Approved for customer closure.',
      updatedAt: new Date().toISOString(),
    });

    await createAuditEvent({
      userId: 'sup-abi',
      userName: 'Abi Kumar',
      entityType: 'INSPECTION',
      entityId: issueId,
      inspectionId: issueId,
      action: 'INSPECTION_COMPLETED',
      metadata: { verifiedBy: 'Abi Kumar', resolution: 'APPROVED' },
    });

    // ── FINAL STATE: CUSTOMER CAN VIEW RESOLVED WORK ─────────────────────────
    const finalIssue = await db.inspections.get(issueId);
    expect(finalIssue?.status).toBe('RESOLVED');
    expect(finalIssue?.verifiedByName).toBe('Abi Kumar');
    expect(finalIssue?.resolutionSummary).toContain('Verified Wi-Fi coverage');

    // Verify operations and audit trails preserved
    const auditCount = await db.auditEvents.where('inspectionId').equals(issueId).count();
    expect(auditCount).toBeGreaterThanOrEqual(3);

    const pendingOps = await db.operations.toArray();
    expect(pendingOps.length).toBeGreaterThanOrEqual(1);
  });
});
