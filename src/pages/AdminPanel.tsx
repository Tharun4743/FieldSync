import { useState } from 'react';
import { db } from '@/lib/db/database';
import { seedDatabase } from '@/lib/db/seed';
import {
  Database,
  Download,
  RefreshCw,
  CheckCircle,
  Shield,
} from 'lucide-react';

export default function AdminPanel() {
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSeedData() {
    setSeeding(true);
    setMessage(null);
    try {
      await seedDatabase();
      setMessage({ type: 'success', text: 'Factory inspection data initialized successfully into IndexedDB.' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Initialization failed.' });
    } finally {
      setSeeding(false);
    }
  }

  async function handleExportData() {
    try {
      const dump = {
        exportedAt: new Date().toISOString(),
        inspections: await db.inspections.toArray(),
        checklistItems: await db.checklistItems.toArray(),
        results: await db.inspectionResults.toArray(),
        notes: await db.notes.toArray(),
        media: await db.media.toArray(),
        operations: await db.operations.toArray(),
        conflicts: await db.conflicts.toArray(),
        auditEvents: await db.auditEvents.toArray(),
      };

      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fieldsync-db-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Export failed.' });
    }
  }

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-2.5">
          <Shield className="text-indigo-600" />
          Admin & Maintenance Panel
        </h1>
        <p className="text-zinc-500 text-xs sm:text-sm font-medium mt-1">
          Database management, schema state controls, and offline inspection backups.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-2 text-xs font-bold ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <CheckCircle size={16} />
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Seed Data */}
        <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 text-zinc-900 font-bold mb-1.5 text-base">
              <Database size={18} className="text-indigo-600" />
              Initialize Industrial Inspections
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed font-medium">
              Populates IndexedDB with standard rotating equipment assets (Motors, Compressors, Pumps), checklist verification questions, and operational bounds.
            </p>
          </div>

          <button
            onClick={() => void handleSeedData()}
            disabled={seeding}
            className="h-10 px-4 rounded-xl font-bold text-xs bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <RefreshCw size={14} className={seeding ? 'animate-spin' : ''} />
            {seeding ? 'Initializing…' : 'Initialize Sample Equipment'}
          </button>
        </div>

        {/* Export Data */}
        <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 text-zinc-900 font-bold mb-1.5 text-base">
              <Download size={18} className="text-sky-600" />
              Export Local Inspection Database
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed font-medium">
              Download the entire client-side IndexedDB snapshot (inspections, checklists, audit trails, and conflict logs) as a structured JSON file.
            </p>
          </div>

          <button
            onClick={() => void handleExportData()}
            className="h-10 px-4 rounded-xl font-bold text-xs bg-white text-zinc-800 border border-zinc-200 hover:bg-zinc-50 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
          >
            <Download size={14} />
            Export Database Snapshot (.json)
          </button>
        </div>
      </div>
    </div>
  );
}
