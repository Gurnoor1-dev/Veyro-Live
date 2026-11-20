import { useEffect } from "react";
import { AlertCircle, X } from "lucide-react";
import { chakra } from "@chakra-ui/react";

export default function ToastNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, 7000);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);
  if (!message) return null;
  return <chakra.div className="veyro-toast-viewport" role="alert" aria-live="assertive"><chakra.div className="veyro-toast"><AlertCircle size={18}/><chakra.span>{message}</chakra.span><chakra.button type="button" aria-label="Dismiss error" onClick={onDismiss}><X size={15}/></chakra.button></chakra.div></chakra.div>;
}
