import { useEffect } from "react";
import { AlertCircle, X } from "lucide-react";

export default function ToastNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, 7000);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);
  if (!message) return null;
  return <div className="veyro-toast-viewport" role="alert" aria-live="assertive"><div className="veyro-toast"><AlertCircle size={18}/><span>{message}</span><button type="button" aria-label="Dismiss error" onClick={onDismiss}><X size={15}/></button></div></div>;
}
