import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db/database';
import { useAuthStore } from '../../stores/authStore';
import { Send, User } from 'lucide-react';

interface Props {
  inspectionId: string;
  onSubmit: (content: string) => Promise<void>;
}

export default function NotesTab({ inspectionId, onSubmit }: Props) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuthStore();

  const notes = useLiveQuery(
    () => db.notes
      .where('inspectionId')
      .equals(inspectionId)
      .sortBy('createdAt'),
    [inspectionId]
  );

  const users = useLiveQuery(() => db.users.toArray(), []);
  const userMap = Object.fromEntries(users?.map(u => [u.id, u]) ?? []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(content.trim());
      setContent('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Note compose */}
      <form onSubmit={handleSubmit} className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">Add Inspector Note</label>
        <textarea
          className="w-full p-3 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-900 resize-none focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
          rows={3}
          placeholder="Describe your equipment observation or anomaly…"
          value={content}
          onChange={e => setContent(e.target.value)}
          id="note-input"
        />
        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] font-medium text-zinc-400">
            Committed to IndexedDB immediately · replicated via CRDT
          </p>
          <button
            type="submit"
            className="h-9 px-4 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 disabled:opacity-40 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-100"
            disabled={!content.trim() || submitting}
            id="btn-add-note"
          >
            <Send size={13} />
            {submitting ? 'Saving…' : 'Add Note'}
          </button>
        </div>
      </form>

      {/* Notes list */}
      <div className="space-y-3">
        {notes?.length === 0 && (
          <div className="text-center text-zinc-400 py-12 bg-white rounded-2xl border border-zinc-200/80 p-8 shadow-sm">
            <p className="font-semibold text-sm">No notes recorded yet. Add your first note above.</p>
          </div>
        )}
        {notes?.map(note => {
          const author = userMap[note.authorId];
          const isOwn = note.authorId === user?.id;
          return (
            <div key={note.id} className="bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-sm space-y-2.5" id={`note-${note.id}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-center text-indigo-700 shrink-0 font-bold text-xs">
                    <User size={14} />
                  </div>
                  <span className="text-xs font-bold text-zinc-900">
                    {author?.fullName ?? 'Inspector'}{isOwn ? ' (you)' : ''}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-zinc-400">
                  {formatDateTime(note.createdAt)}
                </span>
              </div>
              <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap pl-9">
                {note.content}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}
