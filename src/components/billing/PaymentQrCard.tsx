import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, ShieldCheck, Copy, Check, ArrowRight } from 'lucide-react';
import type { Invoice } from '@/types/db';

interface PaymentQrCardProps {
  invoice: Invoice;
  onPaymentConfirmed?: (paymentRef: string) => Promise<void>;
  readOnly?: boolean;
}

export default function PaymentQrCard({
  invoice,
  onPaymentConfirmed,
  readOnly = false,
}: PaymentQrCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [paymentRefInput, setPaymentRefInput] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [showConfirmInput, setShowConfirmInput] = useState(false);

  const isPaid = invoice.status === 'PAID';

  useEffect(() => {
    if (canvasRef.current && invoice.qrPayload) {
      QRCode.toCanvas(canvasRef.current, invoice.qrPayload, {
        width: 220,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      }).catch((err) => {
        console.error('Failed to render payment QR:', err);
      });
    }
  }, [invoice.qrPayload]);

  const copyUpiId = () => {
    navigator.clipboard.writeText('fieldsync@icici');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onPaymentConfirmed) return;
    const ref = paymentRefInput.trim() || `UPI-TXN-${Date.now().toString().slice(-8)}`;
    setIsConfirming(true);
    try {
      await onPaymentConfirmed(ref);
      setShowConfirmInput(false);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs flex flex-col items-center text-center space-y-4">
      {/* Header */}
      <div className="w-full flex items-center justify-between pb-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
            UPI / Instant QR Payment
          </h4>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isPaid
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}
        >
          {isPaid ? 'PAID' : 'PENDING'}
        </span>
      </div>

      {isPaid ? (
        <div className="py-8 flex flex-col items-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-100">
            <CheckCircle2 size={36} />
          </div>
          <div>
            <h5 className="text-base font-bold text-zinc-900">Payment Received</h5>
            <p className="text-xs text-zinc-500 mt-0.5">
              Invoice #{invoice.invoiceNumber} has been settled in full.
            </p>
          </div>
          <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-200 text-xs font-mono text-zinc-700 w-full text-left space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-400">Amount Paid:</span>
              <span className="font-bold text-emerald-700">₹{invoice.grandTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Txn Reference:</span>
              <span className="font-bold text-zinc-800">{invoice.paymentReference || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Settled At:</span>
              <span>{invoice.paidAt ? new Date(invoice.paidAt).toLocaleString() : 'Recent'}</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Amount Showcase */}
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Total Payable Amount
            </span>
            <div className="text-3xl font-black text-zinc-900 font-mono">
              ₹{invoice.grandTotal.toFixed(2)}
            </div>
            <span className="text-[10px] text-zinc-400 block">
              Inclusive of GST (18%) & All Itemized Charges
            </span>
          </div>

          {/* QR Canvas Box */}
          <div className="relative p-3 bg-zinc-50 border-2 border-indigo-100 rounded-2xl shadow-inner flex flex-col items-center">
            <canvas ref={canvasRef} className="rounded-xl shadow-xs" />
            <div className="mt-2 text-[11px] font-mono text-zinc-500 flex items-center gap-1.5">
              <span>UPI: fieldsync@icici</span>
              <button
                type="button"
                onClick={copyUpiId}
                className="hover:text-indigo-600 transition-colors cursor-pointer"
                title="Copy UPI ID"
              >
                {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 max-w-xs">
            Scan using any UPI application (Google Pay, PhonePe, Paytm, or BHIM) to settle invoice.
          </p>

          {/* Pay Link on Mobile or Direct Confirm */}
          <div className="w-full space-y-2 pt-1">
            <a
              href={invoice.qrPayload}
              className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-100 transition-all"
            >
              Open UPI App to Pay <ArrowRight size={14} />
            </a>

            {!readOnly && onPaymentConfirmed && (
              <div>
                {!showConfirmInput ? (
                  <button
                    type="button"
                    onClick={() => setShowConfirmInput(true)}
                    className="w-full text-center text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors pt-1 cursor-pointer"
                  >
                    Customer completed payment? Record confirmation →
                  </button>
                ) : (
                  <form onSubmit={handleConfirmSubmit} className="pt-2 space-y-2 animate-fade-in">
                    <input
                      type="text"
                      placeholder="Bank UTR / Txn Reference (Optional)"
                      value={paymentRefInput}
                      onChange={(e) => setPaymentRefInput(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-zinc-200 text-xs font-mono focus:outline-hidden focus:border-indigo-500"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowConfirmInput(false)}
                        className="flex-1 h-9 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isConfirming}
                        className="flex-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer shadow-sm shadow-emerald-200"
                      >
                        <ShieldCheck size={14} />
                        {isConfirming ? 'Confirming…' : 'Mark as PAID'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
