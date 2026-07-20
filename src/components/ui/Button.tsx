import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  fullWidth?: boolean;
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled,
  style,
  type = "button",
  ...props
}: ButtonProps) {
  const baseStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: fullWidth ? "100%" : "auto",
    padding: size === "sm" ? "10px 14px" : "12px 16px",
    borderRadius: 12,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "0.2s",
    opacity: disabled ? 0.7 : 1,
    border: "1px solid transparent",
  };

  const variantStyle: CSSProperties =
    variant === "secondary"
      ? {
          borderColor: "#d1d5db",
          background: "#fff",
          color: "#374151",
        }
      : {
          background: "#2E7D32",
          color: "#fff",
          borderColor: "#2E7D32",
        };

  return (
    <button type={type} disabled={disabled} style={{ ...baseStyle, ...variantStyle, ...style }} {...props}>
      {children}
    </button>
  );
}