/* Rio Novo — sistema de feedback global (toasts).
 * Uso: const toast = useToast(); toast.success("Categoria criada");
 * Provider precisa envolver o App (feito em main.tsx). */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type ToastKind = "success" | "info" | "warn" | "error";
export type Toast = {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
};

type ToastApi = {
  push: (t: Omit<Toast, "id">) => number;
  dismiss: (id: number) => void;
  success: (title: string, detail?: string, opts?: Partial<Toast>) => number;
  info:    (title: string, detail?: string, opts?: Partial<Toast>) => number;
  warn:    (title: string, detail?: string, opts?: Partial<Toast>) => number;
  error:   (title: string, detail?: string, opts?: Partial<Toast>) => number;
};

const ToastCtx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastCtx);
  if (!api) throw new Error("useToast() chamado fora do <ToastProvider>");
  return api;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seqRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((t: Omit<Toast, "id">): number => {
    const id = seqRef.current++;
    const duration = t.duration ?? (t.kind === "error" ? 6500 : 4200);
    setToasts((cur) => [...cur, { ...t, id, duration }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((cur) => cur.filter((x) => x.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const api = useMemo<ToastApi>(() => ({
    push,
    dismiss,
    success: (title, detail, opts) => push({ kind: "success", title, detail, ...opts }),
    info:    (title, detail, opts) => push({ kind: "info",    title, detail, ...opts }),
    warn:    (title, detail, opts) => push({ kind: "warn",    title, detail, ...opts }),
    error:   (title, detail, opts) => push({ kind: "error",   title, detail, ...opts }),
  }), [push, dismiss]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastCtx.Provider>
  );
}

function iconFor(kind: ToastKind): string {
  switch (kind) {
    case "success": return "✓";
    case "warn":    return "!";
    case "error":   return "×";
    default:        return "i";
  }
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toast-viewport" role="region" aria-live="polite" aria-label="Notificações">
      {toasts.map((t) => (
        <div key={t.id} className={"toast toast-" + t.kind} role="status">
          <span className={"toast-icon toast-icon-" + t.kind} aria-hidden>{iconFor(t.kind)}</span>
          <div className="toast-body">
            <div className="toast-title">{t.title}</div>
            {t.detail && <div className="toast-detail">{t.detail}</div>}
          </div>
          {t.action && (
            <button
              className="toast-action"
              onClick={() => { t.action!.onClick(); onDismiss(t.id); }}
            >
              {t.action.label}
            </button>
          )}
          <button
            className="toast-close"
            onClick={() => onDismiss(t.id)}
            aria-label="Fechar notificação"
          >
            ×
          </button>
          {t.duration && t.duration > 0 && <ToastProgress duration={t.duration} kind={t.kind} />}
        </div>
      ))}
    </div>
  );
}

function ToastProgress({ duration, kind }: { duration: number; kind: ToastKind }) {
  // anima a barra; respeita prefers-reduced-motion (pula a animação visualmente)
  const [done, setDone] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setDone(true));
    return () => cancelAnimationFrame(r);
  }, []);
  return (
    <span
      className={"toast-progress toast-progress-" + kind}
      style={{
        transition: `transform ${duration}ms linear`,
        transform: done ? "scaleX(0)" : "scaleX(1)",
      }}
    />
  );
}
