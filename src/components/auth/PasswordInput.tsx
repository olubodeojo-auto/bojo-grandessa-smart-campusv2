import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "new-password" | "current-password";
  minLength?: number;
  disabled?: boolean;
};

export default function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  minLength,
  disabled = false,
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label htmlFor={id} style={{ fontWeight: 600 }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          type={isVisible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          style={{ width: "100%", boxSizing: "border-box", paddingRight: 44 }}
          disabled={disabled}
          required
        />
        <button
          type="button"
          onClick={() => setIsVisible((current) => !current)}
          aria-label={isVisible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          style={{
            position: "absolute",
            top: "50%",
            right: 8,
            transform: "translateY(-50%)",
            border: 0,
            background: "transparent",
            cursor: "pointer",
            padding: 6,
          }}
          disabled={disabled}
        >
          {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}