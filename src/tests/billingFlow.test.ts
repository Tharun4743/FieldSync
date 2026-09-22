import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/db/database';
import type { Invoice, Inspection } from '@/types/db';

describe('FieldSync Billing, Invoice and QR Payment Workflow Suite', () => {
  beforeEach(async () => {
    await db.invoices.clear();
    await db.inspections.clear();
    await db.users.clear();
  });

  it('generates an invoice with correct itemized charges, 18% GST and dynamic UPI QR payload', async () => {
    const inspectionId = 'insp-billing-001';
    const now = new Date().toISOString();

    const testInspection: Inspection = {
      id: inspectionId,
      title: 'Centrifugal Pump Seal Leakage Remediation',
      siteName: 'Plant Sector 4',
      assetId: 'asset-pump-01',
      status: 'IN_PROGRESS',
      workflowStage: 'AWAITING_VERIFICATION', // Technician completed field work
      priority: 'HIGH',
      assignedTo: ['tech-01'],
      assignedAt: now,
      technicianCompletedAt: now,
      reportedBy: 'Industrial Facilities Corp',
      customerEmail: 'facilities@corp.com',
      createdAt: now,
      updatedAt: now,
      serverVersion: 1,
      localVersion: 1,
      syncStatus: 'SYNCED',
    };
    await db.inspections.put(testInspection);

    // Technician prepares charges
    const labourCharges = 800;
    const partsCharges = 450;
    const travelCharges = 150;
    const otherCharges = 0;
    const discount = 100;
    const subtotal = labourCharges + partsCharges + travelCharges + otherCharges - discount; // 1300
    const taxPercent = 18;
    const taxAmount = Number(((subtotal * taxPercent) / 100).toFixed(2)); // 234.00
    const grandTotal = Number((subtotal + taxAmount).toFixed(2)); // 1534.00
    const invoiceNumber = 'INV-2026-8801';

    const upiMerchantVpa = 'fieldsync@icici';
    const qrPayload = `upi://pay?pa=${upiMerchantVpa}&pn=FieldSync%20Industrial%20Services&am=${grandTotal}&tr=${invoiceNumber}&tn=Bill%20${invoiceNumber}&cu=INR`;

    const invoice: Invoice = {
      id: 'inv-test-01',
      invoiceNumber,
      inspectionId,
      inspectionTitle: testInspection.title,
      customerName: testInspection.reportedBy!,
      customerEmail: testInspection.customerEmail,
      technicianId: 'tech-01',
      technicianName: 'Elakkiya S',
      labourCharges,
      partsCharges,
      travelCharges,
      otherCharges,
      discount,
      taxPercent,
      taxAmount,
      subtotal,
      grandTotal,
      status: 'PAYMENT_PENDING',
      qrPayload,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'PENDING',
    };

    await db.invoices.put(invoice);

    const stored = await db.invoices.get('inv-test-01');
    expect(stored).toBeDefined();
    expect(stored?.subtotal).toBe(1300);
    expect(stored?.taxAmount).toBe(234);
    expect(stored?.grandTotal).toBe(1534);
    expect(stored?.status).toBe('PAYMENT_PENDING');
    expect(stored?.qrPayload).toContain('am=1534');
    expect(stored?.qrPayload).toContain('tr=INV-2026-8801');
  });

  it('completes QR payment flow, transitions invoice to PAID with transaction reference', async () => {
    const invoiceId = 'inv-test-02';
    const now = new Date().toISOString();

    const initialInvoice: Invoice = {
      id: invoiceId,
      invoiceNumber: 'INV-2026-4421',
      inspectionId: 'insp-002',
      inspectionTitle: 'Network Gateway Replacement',
      customerName: 'Acme Logistics',
      technicianId: 'tech-02',
      technicianName: 'Rajesh M',
      labourCharges: 500,
      partsCharges: 200,
      travelCharges: 100,
      otherCharges: 0,
      discount: 0,
      taxPercent: 18,
      taxAmount: 144,
      subtotal: 800,
      grandTotal: 944,
      status: 'PAYMENT_PENDING',
      qrPayload: 'upi://pay?pa=fieldsync@icici&am=944',
      createdAt: now,
      updatedAt: now,
      syncStatus: 'PENDING',
    };
    await db.invoices.put(initialInvoice);

    // Customer scans QR code and confirms payment
    const paymentRef = 'UPI-UTR-9081234471';
    const paidAt = new Date().toISOString();

    await db.invoices.update(invoiceId, {
      status: 'PAID',
      paymentMethod: 'UPI_QR',
      paymentReference: paymentRef,
      paidAt,
      updatedAt: paidAt,
      syncStatus: 'PENDING',
    });

    const updated = await db.invoices.get(invoiceId);
    expect(updated?.status).toBe('PAID');
    expect(updated?.paymentReference).toBe(paymentRef);
    expect(updated?.paymentMethod).toBe('UPI_QR');
    expect(updated?.paidAt).toBe(paidAt);
  });

  it('allows Admin and Customer to query and filter invoices by status', async () => {
    await db.invoices.bulkPut([
      {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        inspectionId: 'insp-1',
        inspectionTitle: 'Air Handler Unit Motor Repair',
        customerId: 'cust-1',
        customerName: 'Customer Alpha',
        technicianId: 'tech-1',
        technicianName: 'Elakkiya S',
        labourCharges: 1000,
        partsCharges: 0,
        travelCharges: 0,
        otherCharges: 0,
        discount: 0,
        taxPercent: 18,
        taxAmount: 180,
        subtotal: 1000,
        grandTotal: 1180,
        status: 'PAID',
        paymentReference: 'UTR-1111',
        paidAt: new Date().toISOString(),
        qrPayload: 'upi://pay?...',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'SYNCED',
      },
      {
        id: 'inv-2',
        invoiceNumber: 'INV-002',
        inspectionId: 'insp-2',
        inspectionTitle: 'Perimeter Camera Re-alignment',
        customerId: 'cust-2',
        customerName: 'Customer Beta',
        technicianId: 'tech-1',
        technicianName: 'Elakkiya S',
        labourCharges: 400,
        partsCharges: 0,
        travelCharges: 50,
        otherCharges: 0,
        discount: 0,
        taxPercent: 18,
        taxAmount: 81,
        subtotal: 450,
        grandTotal: 531,
        status: 'PAYMENT_PENDING',
        qrPayload: 'upi://pay?...',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'PENDING',
      },
    ]);

    const allInvoices = await db.invoices.toArray();
    expect(allInvoices.length).toBe(2);

    const paidInvoices = await db.invoices.where('status').equals('PAID').toArray();
    expect(paidInvoices.length).toBe(1);
    expect(paidInvoices[0].invoiceNumber).toBe('INV-001');

    const pendingInvoices = await db.invoices.where('status').equals('PAYMENT_PENDING').toArray();
    expect(pendingInvoices.length).toBe(1);
    expect(pendingInvoices[0].invoiceNumber).toBe('INV-002');
  });
});
