import type { CSSProperties, ReactNode } from "react";

interface StatusBadgeProps {
  children: ReactNode;
  tone?: "success" | "warning" | "neutral";
}

export default function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps) {
  const styles: Record<"success" | "warning" | "neutral", CSSProperties> = {
    success: { background: "#E8F5E9", color: "#2E7D32", border: "1px solid #C8E6C9" },
    warning: { background: "#FFF3E0", color: "#EF6C00", border: "1px solid #FFE0B2" },
    neutral: { background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB" },
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 700, ...styles[tone] }}>
      {children}
    </span>
  );
}
