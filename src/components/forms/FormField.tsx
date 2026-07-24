/* eslint-disable react-refresh/only-export-components */

import type { CSSProperties, ReactNode } from "react";

interface FormFieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
  fullWidth?: boolean;
}

export default function FormField({ label, children, hint, fullWidth = false }: FormFieldProps) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        gridColumn: fullWidth ? "1 / -1" : "auto",
      }}
    >
      <span style={{ fontWeight: 600, color: "#374151" }}>{label}</span>
      {children}
      {hint ? <span style={{ fontSize: 12, color: "#6b7280" }}>{hint}</span> : null}
    </label>
  );
}

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  fontSize: "14px",
  boxSizing: "border-box",
  background: "#fff",
};
