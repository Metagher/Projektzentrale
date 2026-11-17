import { useToastStore } from '../../store/toastStore';

/** Kurze Bestätigungen, z.B. wenn der Posteingang automatisch eine Aufgabe/Kommunikation/Notiz
 * angelegt hat — mit optionalem Link direkt zum neuen Eintrag. Global am App-Rand montiert, unten
 * rechts, damit sie keine Ansicht verdecken. */
export default function ToastHost() {
  const { toasts, dismiss } = useToastStore();
  if (toasts.length === 0) return null;

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div className="toast" key={toast.id}>
          <span>{toast.message}</span>
          <div className="toast-actions">
            {toast.onAction && (
              <button type="button" className="toast-action" onClick={() => { toast.onAction?.(); dismiss(toast.id); }}>
                {toast.actionLabel || 'Öffnen'}
              </button>
            )}
            <button type="button" className="toast-dismiss" aria-label="Schließen" onClick={() => dismiss(toast.id)}>×</button>
          </div>
        </div>
      ))}
    </div>
  );
}
