import { useState, useEffect } from "react";
import { useAppStore } from "../store/appStore";
import { addNote, getNotesByLead, deleteNote } from "../db/database";

interface Props {
  leadId: string;
}

export default function NotesAndTasks({ leadId }: Props) {
  const notesByLead = useAppStore((s) => s.notes);
  const addNoteToStore = useAppStore((s) => s.addNoteToStore);
  const setNotes = useAppStore((s) => s.setNotes);

  const [newNote, setNewNote] = useState("");

  const notes = notesByLead[leadId] ?? [];

  useEffect(() => {
    if (notes.length === 0) {
      getNotesByLead(leadId)
        .then((list) => {
          if (list.length > 0) setNotes({ ...notesByLead, [leadId]: list });
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  async function handleAddNote() {
    if (!newNote.trim()) return;
    try {
      const note = await addNote(leadId, newNote.trim());
      addNoteToStore(note);
      setNewNote("");
    } catch {
      // no Tauri — keep in memory only
      const note = {
        id: crypto.randomUUID(),
        leadId,
        author: "Eu",
        body: newNote.trim(),
        createdAt: new Date().toISOString(),
      };
      addNoteToStore(note);
      setNewNote("");
    }
  }

  async function handleDeleteNote(noteId: string) {
    try { await deleteNote(noteId); } catch { /* no tauri */ }
    setNotes({ ...notesByLead, [leadId]: notes.filter((n) => n.id !== noteId) });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAddNote(); }}
          placeholder="Adicionar nota… (Ctrl+Enter para guardar)"
          rows={2}
          className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500 resize-none"
        />
        <button
          type="button"
          onClick={handleAddNote}
          className="px-3 self-stretch rounded bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-semibold"
        >
          +
        </button>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {notes.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-3 text-center">Sem notas ainda.</p>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="bg-slate-800/50 rounded p-2.5 border border-slate-700/50">
              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                <span>{n.author} · {new Date(n.createdAt).toLocaleString("pt-PT")}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteNote(n.id)}
                  className="hover:text-red-400 text-base leading-none"
                  aria-label="Apagar nota"
                >×</button>
              </div>
              <p className="text-xs text-slate-200 whitespace-pre-wrap">{n.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
