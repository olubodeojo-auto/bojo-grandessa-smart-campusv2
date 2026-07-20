import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function Input({ label, style, ...props }: InputProps) {
  const content = (
    <input
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
    />
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
