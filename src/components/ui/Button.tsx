import type { ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
};

export default function Button({
  children,
}: ButtonProps) {
  return (
    <button
      style={{
        width: "100%",
        padding: "16px",
        border: "1px solid #E5E7EB",
        borderRadius: "14px",
        background: "#fff",
        fontWeight: 600,
        cursor: "pointer",
        transition: "0.2s",
      }}
    >
      {children}
    </button>
  );
}