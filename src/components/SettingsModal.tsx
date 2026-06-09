import { useState, useRef } from "react";
import { X, Trash2, KeyRound, Download, Upload } from "lucide-react";
import { useAppStore } from "../store/appStore";
import { config } from "../config";
import { downloadBackup, restoreBackup, readJsonFile } from "../lib/backup";
import { getAllBuildings, getAllLeads, getAllNotes } from "../db/database";

export default function SettingsModal() {
  const setShowSettings = useAppStore((s) => s.setShowSettings);
  const setBuildings = useAppStore((s) => s.setBuildings);
  const setLeads = useAppStore((s) => s.setLeads);
  const setNotes = useAppStore((s) => s.setNotes);
  const selectBuilding = useAppStore((s) => s.selectBuilding);
  const notify = useAppStore((s) => s.notify);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  async function handleBackup() {
    try {
      const n = await downloadBackup();
      notify(`Backup criado (${n} leads)`, "success");
    } catch (e) {
      notify(`Erro no backup: ${e instanceof Error ? e.message : "desconhecido"}`, "error");
    }
  }

  async function handleRestore(file: File) {
    try {
      const raw = await readJsonFile(file);
      const r = await restoreBackup(raw);
      // Reload store from DB
      setBuildings(await getAllBuildings());
      setLeads(await getAllLeads());
      setNotes(await getAllNotes());
      notify(`Restaurado: ${r.leads} leads, ${r.buildings} edifícios, ${r.notes} notas`, "success");
    } catch (e) {
      notify(`Erro ao restaurar: ${e instanceof Error ? e.message : "ficheiro inválido"}`, "error");
    }
  }

  const [geminiKey, setGeminiKey] = useState(() => {
    try { return localStorage.getItem("pye:geminiKey") ?? ""; } catch { return ""; }
  });

  function saveKey() {
    try {
      if (geminiKey.trim()) localStorage.setItem("pye:geminiKey", geminiKey.trim());
      else localStorage.removeItem("pye:geminiKey");
      notify("Chave Gemini guardada", "success");
    } catch {
      notify("Não foi possível guardar a chave", "error");
    }
  }

  function clearMapCache() {
    try { localStorage.removeItem("pye:mapview"); } catch { /* ignore */ }
    selectBuilding(null); // clear ghost selection before removing buildings
    setBuildings([]);
    notify("Cache do mapa limpa (edifícios em memória removidos)", "info");
  }

  const envKeyActive = !!config && !!import.meta.env.VITE_GEMINI_API_KEY;

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/50"
      onClick={() => setShowSettings(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Definições"
        className="w-[440px] bg-[#13131f] border border-[#1e1f30] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e1f30]">
          <span className="font-semibold text-sm text-white">Definições</span>
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setShowSettings(false)}
            className="w-6 h-6 rounded flex items-center justify-center text-[#8892a4] hover:text-white hover:bg-[#1e1f30] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Gemini API key */}
          <section>
            <label className="flex items-center gap-1.5 text-[10px] text-[#8892a4] uppercase tracking-wide mb-2">
              <KeyRound size={11} /> Chave API Gemini (deteção de empresas por IA)
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder={envKeyActive ? "(a usar chave do .env)" : "AIza…"}
                className="flex-1 h-8 bg-[#1e1f30] border border-[#2a2b3d] rounded-lg px-3 text-xs text-white placeholder-[#4a5160] focus:outline-none focus:border-[#f97316]/50"
              />
              <button
                type="button"
                onClick={saveKey}
                className="px-3 h-8 bg-[#f97316] hover:bg-[#ea6d0e] rounded-lg text-xs text-white font-semibold"
              >
                Guardar
              </button>
            </div>
            <p className="text-[10px] text-[#4a5160] mt-1.5">
              Obtém uma chave gratuita em aistudio.google.com. Guardada localmente neste PC.
            </p>
          </section>

          {/* Backup / Restore */}
          <section>
            <label className="block text-[10px] text-[#8892a4] uppercase tracking-wide mb-2">
              Backup
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleBackup}
                className="flex items-center gap-2 px-3 h-8 bg-[#1e1f30] hover:bg-[#252637] border border-[#2a2b3d] rounded-lg text-xs text-[#c8d0df] transition-colors"
              >
                <Download size={13} /> Exportar backup
              </button>
              <button
                type="button"
                onClick={() => restoreInputRef.current?.click()}
                className="flex items-center gap-2 px-3 h-8 bg-[#1e1f30] hover:bg-[#252637] border border-[#2a2b3d] rounded-lg text-xs text-[#c8d0df] transition-colors"
              >
                <Upload size={13} /> Restaurar
              </button>
              <input
                ref={restoreInputRef}
                type="file"
                accept="application/json"
                aria-label="Ficheiro de backup"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRestore(f); e.target.value = ""; }}
              />
            </div>
            <p className="text-[10px] text-[#4a5160] mt-1.5">
              Exporta/restaura todos os edifícios, leads e notas como ficheiro .json.
            </p>
          </section>

          {/* Cache */}
          <section>
            <label className="block text-[10px] text-[#8892a4] uppercase tracking-wide mb-2">
              Dados
            </label>
            <button
              type="button"
              onClick={clearMapCache}
              className="flex items-center gap-2 px-3 h-8 bg-[#1e1f30] hover:bg-[#252637] border border-[#2a2b3d] rounded-lg text-xs text-[#c8d0df] transition-colors"
            >
              <Trash2 size={13} /> Limpar edifícios em memória
            </button>
            <p className="text-[10px] text-[#4a5160] mt-1.5">
              Remove os edifícios carregados do mapa. Os leads guardados na base de dados mantêm-se.
            </p>
          </section>

          <div className="text-[10px] text-[#4a5160] pt-2 border-t border-[#1e1f30]">
            {config.appName} v{config.appVersion}
          </div>
        </div>
      </div>
    </div>
  );
}
