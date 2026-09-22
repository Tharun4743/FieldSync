import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import { useAuthStore } from '@/stores/authStore';
import { createOperation } from '@/lib/db/repositories/operations';
import { createAuditEvent } from '@/lib/db/repositories/auditEvents';
import { syncManager } from '@/lib/sync/syncManager';
import {
  Receipt,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
} from 'lucide-react';
import InvoiceViewModal from '../billing/InvoiceViewModal';
import type { Invoice, InvoiceStatus } from '@/types/db';

interface AdminInvoicesTabProps {
  showMessage: (type: 'success' | 'error', text: string) => void;
}

export default function AdminInvoicesTab({ showMessage }: AdminInvoicesTabProps) {
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | InvoiceStatus>('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Query all invoices from Dexie
  const invoices = useLiveQuery(() => db.invoices.toArray(), []) as Invoice[] | undefined;

  const filtered = (invoices ?? []).filter((inv) => {
    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q) ||
      inv.technicianName.toLowerCase().includes(q) ||
      (inv.inspectionTitle || '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  // Calculate totals
  const totalBilled = (invoices ?? []).reduce((sum, inv) => sum + Number(inv.grandTotal || 0), 0);
  const totalCollected = (invoices ?? [])
    .filter((inv) => inv.status === 'PAID')
    .reduce((sum, inv) => sum + Number(inv.grandTotal || 0), 0);
  const totalPending = totalBilled - totalCollected;

  const handleMarkPaid = async (inv: Invoice, paymentRef: string) => {
    if (!user) return;
    const now = new Date().toISOString();
    await db.invoices.update(inv.id, {
      status: 'PAID',
      paymentReference: paymentRef,
      paymentMethod: 'UPI_QR',
      paidAt: now,
      updatedAt: now,
      syncStatus: 'PENDING',
    });

    await createOperation({
      userId: user.id,
      inspectionId: inv.inspectionId,
      entityType: 'invoice',
      entityId: inv.id,
      operationType: 'UPDATE',
      payload: {
        id: inv.id,
        status: 'PAID',
        paymentReference: paymentRef,
        paidAt: now,
      },
    });

    await createAuditEvent({
      userId: user.id,
      userName: user.fullName,
      inspectionId: inv.inspectionId,
      entityType: 'INVOICE',
      entityId: inv.id,
      action: 'UPDATED',
      field: 'status',
      afterValue: `Invoice #${inv.invoiceNumber} marked PAID by Admin ${user.fullName}`,
    });

    showMessage('success', `Invoice #${inv.invoiceNumber} marked as PAID.`);
    void syncManager.syncNow();
  };

  const handleCancelInvoice = async (inv: Invoice) => {
    if (!user) return;
    const now = new Date().toISOString();
    await db.invoices.update(inv.id, {
      status: 'CANCELLED',
      updatedAt: now,
      syncStatus: 'PENDING',
    });

    await createOperation({
      userId: user.id,
      inspectionId: inv.inspectionId,
      entityType: 'invoice',
      entityId: inv.id,
      operationType: 'UPDATE',
      payload: { id: inv.id, status: 'CANCELLED' },
    });

    await createAuditEvent({
      userId: user.id,
      userName: user.fullName,
      inspectionId: inv.inspectionId,
      entityType: 'INVOICE',
      entityId: inv.id,
      action: 'UPDATED',
      field: 'status',
      afterValue: `Invoice #${inv.invoiceNumber} CANCELLED by Admin ${user.fullName}`,
    });

    showMessage('success', `Invoice #${inv.invoiceNumber} has been cancelled.`);
    void syncManager.syncNow();
  };

  return (
    <div className="space-y-6">
      {/* Revenue KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-zinc-200/80 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
            Total Revenue Billed
          </span>
          <div className="text-2xl font-black font-mono text-zinc-900 mt-1">
            ₹{totalBilled.toFixed(2)}
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">{invoices?.length ?? 0} total invoices issued</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-zinc-200/80 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-emerald-600 block tracking-wider">
            Settled / Collected (UPI & QR)
          </span>
          <div className="text-2xl font-black font-mono text-emerald-700 mt-1">
            ₹{totalCollected.toFixed(2)}
          </div>
          <p className="text-[11px] text-emerald-600 mt-0.5">
            {(invoices ?? []).filter((i) => i.status === 'PAID').length} paid receipts
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-zinc-200/80 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-amber-600 block tracking-wider">
            Outstanding Receivables
          </span>
          <div className="text-2xl font-black font-mono text-amber-700 mt-1">
            ₹{totalPending.toFixed(2)}
          </div>
          <p className="text-[11px] text-amber-600 mt-0.5">
            {(invoices ?? []).filter((i) => i.status === 'PAYMENT_PENDING' || i.status === 'GENERATED').length} awaiting customer payment
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-zinc-200/80 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search invoice #, customer, tech…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-zinc-200 text-xs focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto w-full sm:w-auto">
          {(['ALL', 'PAYMENT_PENDING', 'PAID', 'CANCELLED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-zinc-900 text-white shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-2xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-400">
            <Receipt size={32} className="mx-auto mb-2 opacity-30 text-zinc-500" />
            <p className="font-semibold text-zinc-600">No invoices found matching criteria.</p>
            <p className="text-[11px] mt-0.5">
              Technicians generate invoices upon completing assigned service tickets.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-400 uppercase text-[10px] font-bold">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Technician</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Payment Ref</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {filtered.map((inv) => {
                  const isPaid = inv.status === 'PAID';
                  return (
                    <tr key={inv.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 font-bold text-zinc-900">
                        {inv.customerName}
                        {inv.customerEmail && (
                          <span className="block font-normal text-[10px] text-zinc-400">
                            {inv.customerEmail}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-zinc-600">{inv.technicianName}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-zinc-900">
                        ₹{Number(inv.grandTotal).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : inv.status === 'CANCELLED'
                              ? 'bg-zinc-100 text-zinc-600'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {isPaid ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-500">
                        {inv.paymentReference || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoice(inv)}
                            className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600 cursor-pointer"
                            title="View / Print Invoice"
                          >
                            <Eye size={13} />
                          </button>
                          {!isPaid && inv.status !== 'CANCELLED' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleMarkPaid(inv, `ADMIN-REC-${Date.now().toString().slice(-6)}`)}
                                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                                title="Mark Paid"
                              >
                                Mark Paid
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelInvoice(inv)}
                                className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                                title="Cancel Invoice"
                              >
                                <XCircle size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Detail Modal for View & Print */}
      {selectedInvoice && (
        <InvoiceViewModal
          isOpen={Boolean(selectedInvoice)}
          onClose={() => setSelectedInvoice(null)}
          invoice={selectedInvoice}
          onPaymentConfirmed={async (ref) => {
            await handleMarkPaid(selectedInvoice, ref);
            setSelectedInvoice(null);
          }}
        />
      )}
    </div>
  );
}
