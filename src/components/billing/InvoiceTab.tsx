import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import { useAuthStore } from '@/stores/authStore';
import { createOperation } from '@/lib/db/repositories/operations';
import { createAuditEvent } from '@/lib/db/repositories/auditEvents';
import { syncManager } from '@/lib/sync/syncManager';
import { Receipt, Lock, Printer } from 'lucide-react';
import InvoiceGenerationModal from './InvoiceGenerationModal';
import InvoiceViewModal from './InvoiceViewModal';
import PaymentQrCard from './PaymentQrCard';
import type { Inspection, Invoice } from '@/types/db';

interface InvoiceTabProps {
  inspection: Inspection;
  readOnly?: boolean;
}

export default function InvoiceTab({ inspection, readOnly = false }: InvoiceTabProps) {
  const { user } = useAuthStore();
  const [showGenModal, setShowGenModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);

  // Query invoice for this inspection from Dexie
  const invoice = useLiveQuery(
    () => db.invoices.where('inspectionId').equals(inspection.id).first(),
    [inspection.id]
  ) as Invoice | undefined;

  // Validation: Work must be completed before generating invoice
  // Allowed stages: AWAITING_VERIFICATION, RESOLVED, or status COMPLETED
  const isWorkCompleted =
    inspection.workflowStage === 'AWAITING_VERIFICATION' ||
    inspection.workflowStage === 'RESOLVED' ||
    inspection.status === 'COMPLETED' ||
    Boolean(inspection.technicianCompletedAt);

  const isCustomer = user?.role === 'CUSTOMER';
  const isPaid = invoice?.status === 'PAID';

  const handlePaymentConfirmed = async (paymentRef: string) => {
    if (!invoice || !user) return;

    const now = new Date().toISOString();
    await db.invoices.update(invoice.id, {
      status: 'PAID',
      paymentReference: paymentRef,
      paymentMethod: 'UPI_QR',
      paidAt: now,
      updatedAt: now,
      syncStatus: 'PENDING',
    });

    await createOperation({
      userId: user.id,
      inspectionId: inspection.id,
      entityType: 'invoice',
      entityId: invoice.id,
      operationType: 'UPDATE',
      payload: {
        id: invoice.id,
        status: 'PAID',
        paymentReference: paymentRef,
        paymentMethod: 'UPI_QR',
        paidAt: now,
      },
    });

    await createAuditEvent({
      userId: user.id,
      userName: user.fullName,
      inspectionId: inspection.id,
      entityType: 'INVOICE',
      entityId: invoice.id,
      action: 'UPDATED',
      field: 'status',
      beforeValue: invoice.status,
      afterValue: `PAID (Ref: ${paymentRef}) confirmed by ${user.fullName}`,
    });

    void syncManager.syncNow();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-zinc-900">Billing, Invoices & QR Settlement</h3>
            {invoice && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isPaid
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {invoice.status}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Real-time itemized billing, instant UPI QR generation, and permanent Supabase audit records.
          </p>
        </div>

        {invoice && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowViewModal(true)}
              className="h-9 px-4 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Receipt size={14} /> View Invoice & Print
            </button>
          </div>
        )}
      </div>

      {/* When Work is NOT completed yet */}
      {!isWorkCompleted && !invoice && (
        <div className="p-8 rounded-3xl bg-zinc-50 border border-dashed border-zinc-200 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
            <Lock size={22} />
          </div>
          <h4 className="text-sm font-bold text-zinc-800">Invoice Generation Locked</h4>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Invoices can only be generated after the assigned field technician completes diagnostic tests,
            checklist items, and submits field work for quality review.
          </p>
          <span className="inline-block text-[11px] font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 mt-1">
            Current Stage: {inspection.workflowStage || inspection.status}
          </span>
        </div>
      )}

      {/* When Work IS completed, but no invoice exists yet */}
      {isWorkCompleted && !invoice && (
        <div className="p-8 rounded-3xl bg-indigo-50/50 border border-indigo-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-md shadow-indigo-100">
            <Receipt size={24} />
          </div>
          <div>
            <h4 className="text-base font-bold text-zinc-900">Work Completed — Ready for Invoicing</h4>
            <p className="text-xs text-zinc-600 max-w-md mx-auto mt-1">
              Field work has been completed. Review labour, replaced components, and travel charges to generate
              the official customer invoice and payment QR.
            </p>
          </div>

          {!readOnly && (
            <button
              type="button"
              onClick={() => setShowGenModal(true)}
              className="h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-md shadow-indigo-200 cursor-pointer transition-all"
            >
              <Receipt size={16} /> Generate Invoice Now
            </button>
          )}
        </div>
      )}

      {/* When Invoice exists */}
      {invoice && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1 & 2: Invoice Summary Details */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                  Official Bill Number
                </span>
                <h4 className="text-lg font-black font-mono text-zinc-900">{invoice.invoiceNumber}</h4>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                  Grand Total
                </span>
                <span className="text-2xl font-black font-mono text-indigo-600">
                  ₹{invoice.grandTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="border border-zinc-200/80 rounded-2xl overflow-hidden text-xs">
              <div className="p-3 bg-zinc-50 border-b border-zinc-200 flex justify-between font-bold text-zinc-600 text-[11px] uppercase">
                <span>Charge Component</span>
                <span>Amount</span>
              </div>
              <div className="divide-y divide-zinc-100 p-1">
                <div className="p-2.5 flex justify-between">
                  <span className="text-zinc-600">Labour & Service Fees:</span>
                  <span className="font-mono font-bold text-zinc-900">₹{invoice.labourCharges.toFixed(2)}</span>
                </div>
                {invoice.partsCharges > 0 && (
                  <div className="p-2.5 flex justify-between">
                    <span className="text-zinc-600">Replaced Parts & Materials:</span>
                    <span className="font-mono font-bold text-zinc-900">₹{invoice.partsCharges.toFixed(2)}</span>
                  </div>
                )}
                {invoice.travelCharges > 0 && (
                  <div className="p-2.5 flex justify-between">
                    <span className="text-zinc-600">Travel & Technical Transport:</span>
                    <span className="font-mono font-bold text-zinc-900">₹{invoice.travelCharges.toFixed(2)}</span>
                  </div>
                )}
                {invoice.otherCharges > 0 && (
                  <div className="p-2.5 flex justify-between">
                    <span className="text-zinc-600">Other Charges:</span>
                    <span className="font-mono font-bold text-zinc-900">₹{invoice.otherCharges.toFixed(2)}</span>
                  </div>
                )}
                {invoice.discount > 0 && (
                  <div className="p-2.5 flex justify-between text-emerald-700 bg-emerald-50/40">
                    <span>Discount:</span>
                    <span className="font-mono font-bold">-₹{invoice.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="p-2.5 flex justify-between border-t border-zinc-200 bg-zinc-50/50">
                  <span className="text-zinc-500">GST Tax ({invoice.taxPercent}%):</span>
                  <span className="font-mono font-bold text-zinc-900">₹{invoice.taxAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Meta info */}
            <div className="grid grid-cols-2 gap-4 text-xs text-zinc-600">
              <div>
                <span className="text-zinc-400 block text-[10px]">Technician:</span>
                <span className="font-bold text-zinc-900">{invoice.technicianName}</span>
              </div>
              <div className="text-right">
                <span className="text-zinc-400 block text-[10px]">Date Issued:</span>
                <span className="font-bold text-zinc-900">
                  {new Date(invoice.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setShowViewModal(true)}
                className="h-10 px-4 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-xs font-bold text-zinc-700 flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} /> Full Invoice & Print
              </button>
            </div>
          </div>

          {/* Column 3: Live QR Payment Card */}
          <div>
            <PaymentQrCard
              invoice={invoice}
              onPaymentConfirmed={handlePaymentConfirmed}
              readOnly={readOnly || isCustomer}
            />
          </div>
        </div>
      )}

      {/* Generation Modal */}
      <InvoiceGenerationModal
        isOpen={showGenModal}
        onClose={() => setShowGenModal(false)}
        inspection={inspection}
        onInvoiceCreated={() => {
          // Live query auto updates
        }}
      />

      {/* View & Print Modal */}
      {invoice && (
        <InvoiceViewModal
          isOpen={showViewModal}
          onClose={() => setShowViewModal(false)}
          invoice={invoice}
          onPaymentConfirmed={handlePaymentConfirmed}
          readOnly={readOnly || isCustomer}
        />
      )}
    </div>
  );
}
