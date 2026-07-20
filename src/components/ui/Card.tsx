import type { ReactNode } from "react";
import grandessaIdentity from "../../config/grandessaIdentity";
import grandessaTheme from "../../config/grandessaTheme";

type CardProps = {
  children: ReactNode;
};

export default function Card({ children }: CardProps) {
  return (
    <section
      style={{
        background: grandessaIdentity.branding.cardColor,
        borderRadius: "20px",
        padding: grandessaTheme.spacing.lg,
        boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
        marginBottom: grandessaTheme.spacing.lg,
      }}
    >
      {children}
    </section>
  );
}