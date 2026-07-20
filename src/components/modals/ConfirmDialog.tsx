import type { ReactNode } from "react";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export default function ConfirmDialog({ title, description, confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, onCancel, children }: ConfirmDialogProps) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 480, width: "100%" }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={{ color: "#4B5563" }}>{description}</p>
      {children}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
        <button type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
