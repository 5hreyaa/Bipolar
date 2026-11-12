import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "lucide-react";
import { useToast } from "../../context/ToastContext";

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  const icons = {
    success: <CheckCircle2 size={18} color="#059669" />,
    error: <AlertCircle size={18} color="#dc2626" />,
    info: <Info size={18} color="#0284c7" />,
    warning: <AlertTriangle size={18} color="#d97706" />,
  };

  return (
    <div className="toast-container" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type}`} role="status">
          <div style={{ marginTop: 2 }}>{icons[toast.type]}</div>
          <div style={{ flex: 1 }}>
            {toast.title && (
              <div style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: 2 }}>
                {toast.title}
              </div>
            )}
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              {toast.message}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

