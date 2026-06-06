import { useEffect } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { useAppStore, type Toast } from "../store/appStore";

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const STYLES = {
  success: "bg-green-900/95 border-green-700 text-green-100",
  error: "bg-red-900/95 border-red-700 text-red-100",
  warning: "bg-amber-900/95 border-amber-700 text-amber-100",
  info: "bg-slate-800/95 border-slate-600 text-slate-100",
} as const;

function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useAppStore((s) => s.dismissToast);
  const Icon = ICONS[toast.severity];

  useEffect(() => {
    // errors persist longer (8s) than other toasts (4.5s)
    const ms = toast.severity === "error" ? 8000 : 4500;
    const t = setTimeout(() => dismissToast(toast.id), ms);
    return () => clearTimeout(t);
  }, [toast.id, toast.severity, dismissToast]);

  return (
    <div
      role="status"
      className={`flex items-start gap-2 px-3 py-2 rounded-lg border shadow-xl text-xs max-w-sm pointer-events-auto animate-[slideIn_0.2s_ease-out] ${STYLES[toast.severity]}`}
    >
      <Icon size={15} className="shrink-0 mt-0.5" />
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        type="button"
        aria-label="Fechar notificação"
        onClick={() => dismissToast(toast.id)}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
