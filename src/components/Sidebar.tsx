export default function Sidebar() {
  return (
    <aside className="w-80 shrink-0 border-r border-slate-800 bg-slate-900 flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-slate-200">Leads</h2>
        <p className="text-xs text-slate-500 mt-1">
          Lista vazia. Desenha um polígono no mapa para importar edifícios C&amp;I.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-xs text-slate-500">
        <em>Scaffold inicial — sem dados ainda.</em>
      </div>
      <div className="p-3 border-t border-slate-800 flex gap-2">
        <button
          type="button"
          className="flex-1 h-8 rounded bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-semibold transition"
          disabled
          title="Em breve"
        >
          Importar zona
        </button>
        <button
          type="button"
          className="h-8 px-3 rounded border border-slate-700 hover:bg-slate-800 text-xs"
          disabled
          title="Em breve"
        >
          Exportar CSV
        </button>
      </div>
    </aside>
  );
}
