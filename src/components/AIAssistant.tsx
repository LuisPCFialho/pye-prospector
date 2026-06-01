import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { askAI } from "../lib/gemini";

export default function AIAssistant() {
  const selectedBuildingId = useAppStore((s) => s.selectedBuildingId);
  const buildings = useAppStore((s) => s.buildings);
  const leads = useAppStore((s) => s.leads);
  const showAIAssistant = useAppStore((s) => s.showAIAssistant);
  const setShowAIAssistant = useAppStore((s) => s.setShowAIAssistant);

  const [response, setResponse] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<"summarize" | "email" | "script" | null>(null);

  if (!showAIAssistant) return null;

  const building = buildings.find((b) => b.id === selectedBuildingId);
  const lead = selectedBuildingId ? leads[selectedBuildingId] : undefined;

  async function run(action: "summarize" | "email" | "script") {
    if (!building) {
      setResponse("Seleciona um edifício no mapa primeiro.");
      return;
    }
    setActiveAction(action);
    setLoading(true);
    setResponse("");
    try {
      const result = await askAI({ action, building, lead });
      setResponse(result);
    } catch (e) {
      setResponse(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(response);
    } catch (e) { console.warn(e); }
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-6">
      <div className="w-[680px] max-h-[88vh] bg-[#1a1a2e] border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 bg-[#12121e] border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <div>
              <h2 className="font-semibold">PYE Assistant</h2>
              <p className="text-[10px] text-slate-400">
                {import.meta.env.VITE_GEMINI_API_KEY ? "Gemini ativo" : "Modo mock (sem chave Gemini)"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAIAssistant(false)}
            className="w-7 h-7 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center"
          >×</button>
        </div>

        <div className="p-4 border-b border-slate-700 grid grid-cols-3 gap-2 shrink-0">
          {[
            { key: "summarize", label: "📊 Resumo Executivo", desc: "Resumo da oportunidade" },
            { key: "email", label: "✉️ Email de Outreach", desc: "Email para o CFO" },
            { key: "script", label: "📞 Script de Chamada", desc: "Cold call 30-60s" },
          ].map((a) => (
            <button
              key={a.key}
              type="button"
              disabled={loading || !building}
              onClick={() => run(a.key as "summarize" | "email" | "script")}
              className={`p-3 rounded-lg border text-left transition ${
                activeAction === a.key
                  ? "bg-brand-500/20 border-brand-500 text-brand-400"
                  : "bg-slate-800/50 border-slate-700 hover:border-brand-500 text-slate-200"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="text-sm font-semibold">{a.label}</div>
              <div className="text-[10px] text-slate-400 mt-1">{a.desc}</div>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
              <span className="animate-pulse">A gerar resposta…</span>
            </div>
          ) : response ? (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
                >
                  📋 Copiar
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-sm text-slate-200 font-sans leading-relaxed">{response}</pre>
            </div>
          ) : (
            <div className="text-center text-slate-500 py-12">
              {building ? (
                <p className="text-sm">Escolhe uma ação acima para gerar conteúdo sobre este edifício.</p>
              ) : (
                <p className="text-sm">Seleciona primeiro um edifício no mapa.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
