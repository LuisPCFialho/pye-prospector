import { X } from "lucide-react";

const SHORTCUTS: [string, string][] = [
  ["/", "Focar a pesquisa"],
  ["G", "Get Rooftops (carregar edifícios)"],
  ["T", "Ver tabela"],
  ["M", "Ver mapa"],
  ["F", "Abrir/fechar filtros"],
  ["Shift + clique", "Multi-seleção de edifícios no mapa"],
  ["Esc", "Fechar painel / desselecionar"],
  ["?", "Mostrar esta ajuda"],
];

export default function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute inset-0 z-[90] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Atalhos de teclado"
        className="w-[380px] bg-[#13131f] border border-[#1e1f30] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e1f30]">
          <span className="font-semibold text-sm text-white">Atalhos de teclado</span>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center text-[#8892a4] hover:text-white hover:bg-[#1e1f30] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {SHORTCUTS.map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between text-xs">
              <span className="text-[#c8d0df]">{desc}</span>
              <kbd className="px-2 py-0.5 bg-[#1e1f30] border border-[#2a2b3d] rounded text-[10px] text-[#f97316] font-mono">{key}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
