import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="card" style={{ padding: 30, textAlign: "center" }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {description ? <p style={{ color: "#6B7280" }}>{description}</p> : null}
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </div>
  );
}
