import type { SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export default function Select({ label, style, children, ...props }: SelectProps) {
  const content = (
    <select
      style={{
        width: "100%",
        padding: "12px",
        border: "1px solid #d1d5db",
        borderRadius: "8px",
        fontSize: "14px",
        boxSizing: "border-box",
        ...style,
      }}
      {...props}
    >
      {children}
    </select>
  );

  if (!label) {
    return content;
  }

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span>{label}</span>
      {content}
    </label>
  );
}
