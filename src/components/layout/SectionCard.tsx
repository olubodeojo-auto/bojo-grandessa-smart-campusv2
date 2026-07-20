import type { ReactNode } from "react";

interface SectionCardProps {
  children: ReactNode;
  title?: string;
}

export default function SectionCard({ children, title }: SectionCardProps) {
  return (
    <section className="card" style={{ padding: 24 }}>
      {title ? <h2 style={{ marginTop: 0, marginBottom: 16, fontFamily: "Fredoka" }}>{title}</h2> : null}
      {children}
    </section>
  );
}
