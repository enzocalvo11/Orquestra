import { Info, X } from "lucide-react";

export function NoticeToast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="toast" role="status">
      <Info size={17} aria-hidden="true" />
      {message}
      <button onClick={onClose} aria-label="Fechar aviso">
        <X size={15} />
      </button>
    </div>
  );
}
