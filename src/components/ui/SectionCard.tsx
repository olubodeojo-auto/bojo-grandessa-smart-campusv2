import type { CSSProperties, ReactNode } from "react";

interface SectionCardProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export default function SectionCard({ children, style, className }: SectionCardProps) {
  return (
    <div className={className ? `card ${className}` : "card"} style={style}>
      {children}
    </div>
  );
}
