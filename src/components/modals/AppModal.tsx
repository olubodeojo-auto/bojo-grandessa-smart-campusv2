import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalSize = "sm" | "md" | "lg" | "xl";

interface AppModalProps {
  open: boolean;
  title?: string;
  size?: ModalSize;
  footer?: ReactNode;
  children: ReactNode;
  onClose: () => void;
}

const sizeStyles: Record<ModalSize, CSSProperties> = {
  sm: { maxWidth: 480 },
  md: { maxWidth: 640 },
  lg: { maxWidth: 840 },
  xl: { maxWidth: 1100 },
};

export default function AppModal({ open, title, size = "md", footer, children, onClose }: AppModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements?.[0] ?? dialogRef.current;
    firstFocusable?.focus();

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      previousActiveElement?.focus();
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const modalContent = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        style={{
          width: "100%",
          background: "#fff",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
          ...sizeStyles[size],
        }}
        onClick={(event) => event.stopPropagation()}
        tabIndex={-1}
      >
        {title ? (
          <div style={{ marginBottom: 16 }}>
            <h2 id={titleId} style={{ margin: 0, fontFamily: "Fredoka" }}>
              {title}
            </h2>
          </div>
        ) : null}

        <div>{children}</div>

        {footer ? <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>{footer}</div> : null}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
