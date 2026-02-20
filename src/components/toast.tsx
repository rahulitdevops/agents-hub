"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastContextValue {
  addToast: (type: ToastType, message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({ addToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const TOAST_STYLES: Record<ToastType, { bg: string; icon: string; border: string }> = {
  success: { bg: "bg-emerald-50", icon: "✅", border: "border-emerald-200" },
  error: { bg: "bg-red-50", icon: "❌", border: "border-red-200" },
  info: { bg: "bg-blue-50", icon: "ℹ️", border: "border-blue-200" },
  warning: { bg: "bg-amber-50", icon: "⚠️", border: "border-amber-200" },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.duration, onDismiss]);

  const style = TOAST_STYLES[toast.type];

  return (
    <div
      className={`${style.bg} ${style.border} border rounded-xl px-4 py-3 shadow-lg flex items-start gap-3 animate-slide-in`}
      role="alert"
    >
      <span className="text-base shrink-0">{style.icon}</span>
      <p className="text-sm text-slate-700 flex-1">{toast.message}</p>
      <button
        onClick={onDismiss}
        className="text-slate-400 hover:text-slate-600 text-xs font-medium shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
