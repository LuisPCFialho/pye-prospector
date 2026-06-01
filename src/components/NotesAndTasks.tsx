import { useState, useEffect } from "react";
import { useAppStore } from "../store/appStore";
import {
  addNote, getNotesByLead,
  addTask, getTasksByLead, toggleTaskDone, deleteTask, deleteNote,
} from "../db/database";

interface Props {
  leadId: string;
}

export default function NotesAndTasks({ leadId }: Props) {
  const notesByLead = useAppStore((s) => s.notes);
  const tasksByLead = useAppStore((s) => s.tasks);
  const addNoteToStore = useAppStore((s) => s.addNoteToStore);
  const addTaskToStore = useAppStore((s) => s.addTaskToStore);
  const updateTaskInStore = useAppStore((s) => s.updateTaskInStore);
  const setNotes = useAppStore((s) => s.setNotes);
  const setTasks = useAppStore((s) => s.setTasks);

  const [newNote, setNewNote] = useState("");
  const [newTask, setNewTask] = useState("");
  const [tab, setTab] = useState<"notes" | "tasks">("notes");

  const notes = notesByLead[leadId] ?? [];
  const tasks = tasksByLead[leadId] ?? [];

  // Lazy-load when opened
  useEffect(() => {
    if (notes.length === 0) {
      getNotesByLead(leadId)
        .then((list) => {
          if (list.length > 0) setNotes({ ...notesByLead, [leadId]: list });
        })
        .catch(() => {});
    }
    if (tasks.length === 0) {
      getTasksByLead(leadId)
        .then((list) => {
          if (list.length > 0) setTasks({ ...tasksByLead, [leadId]: list });
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
    } catch (e) {
      console.warn("Failed to add note (no Tauri?)", e);
    }
  }

  async function handleAddTask() {
    if (!newTask.trim()) return;
    try {
      const task = await addTask(leadId, newTask.trim());
      addTaskToStore(task);
      setNewTask("");
    } catch (e) {
      console.warn("Failed to add task (no Tauri?)", e);
    }
  }

  async function handleToggleTask(taskId: string, done: boolean) {
    try {
      await toggleTaskDone(taskId, done);
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        updateTaskInStore({
          ...task,
          done,
          completedAt: done ? new Date().toISOString() : undefined,
        });
      }
    } catch (e) {
      console.warn(e);
    }
  }

  async function handleDeleteTask(taskId: string) {
    try {
      await deleteTask(taskId);
      setTasks({ ...tasksByLead, [leadId]: tasks.filter((t) => t.id !== taskId) });
    } catch (e) { console.warn(e); }
  }

  async function handleDeleteNote(noteId: string) {
    try {
      await deleteNote(noteId);
      setNotes({ ...notesByLead, [leadId]: notes.filter((n) => n.id !== noteId) });
    } catch (e) { console.warn(e); }
  }

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        <button
          type="button"
          onClick={() => setTab("notes")}
          className={`px-4 py-2 text-xs font-medium ${
            tab === "notes"
              ? "text-brand-400 border-b-2 border-brand-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          📝 Notas ({notes.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("tasks")}
          className={`px-4 py-2 text-xs font-medium ${
            tab === "tasks"
              ? "text-brand-400 border-b-2 border-brand-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          ✓ Tarefas ({tasks.filter((t) => !t.done).length} pendentes)
        </button>
      </div>

      {tab === "notes" ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
              placeholder="Adicionar nota…"
              className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
            />
            <button
              type="button"
              onClick={handleAddNote}
              className="px-3 py-1.5 rounded bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-semibold"
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
                    >×</button>
                  </div>
                  <p className="text-xs text-slate-200 whitespace-pre-wrap">{n.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
              placeholder="Nova tarefa…"
              className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
            />
            <button
              type="button"
              onClick={handleAddTask}
              className="px-3 py-1.5 rounded bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-semibold"
            >
              +
            </button>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {tasks.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-3 text-center">Sem tarefas.</p>
            ) : (
              tasks.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center gap-2 bg-slate-800/50 rounded p-2 border border-slate-700/50 ${
                    t.done ? "opacity-60" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={(e) => handleToggleTask(t.id, e.target.checked)}
                    className="accent-brand-500"
                  />
                  <span className={`flex-1 text-xs ${t.done ? "line-through text-slate-500" : "text-slate-200"}`}>
                    {t.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(t.id)}
                    className="text-slate-500 hover:text-red-400 text-base leading-none"
                  >×</button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
