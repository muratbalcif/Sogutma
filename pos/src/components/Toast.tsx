import { useEffect } from "react";

export function Toast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onClose, 4000);
    return () => window.clearTimeout(t);
  }, [message, onClose]);

  return (
    <div
      role="status"
      className="fixed bottom-20 left-1/2 z-[60] max-w-lg -translate-x-1/2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-lg"
    >
      {message}
      <button
        type="button"
        className="ml-4 underline"
        onClick={onClose}
      >
        Kapat
      </button>
    </div>
  );
}
