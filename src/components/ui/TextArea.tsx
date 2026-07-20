import type { TextareaHTMLAttributes } from "react";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export default function TextArea({ label, style, ...props }: TextAreaProps) {
  const content = (
    <textarea
      style={{
        width: "100%",
        padding: "12px",
        border: "1px solid #d1d5db",
        borderRadius: "8px",
        fontSize: "14px",
        boxSizing: "border-box",
        minHeight: 96,
        resize: "vertical",
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
