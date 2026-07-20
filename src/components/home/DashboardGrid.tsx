import type { ReactNode } from "react";

type DashboardGridProps = {
  left: ReactNode;
  right: ReactNode;
};

export default function DashboardGrid({
  left,
  right,
}: DashboardGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr",
        gap: "24px",
        alignItems: "start",
        marginTop: "24px",
      }}
    >
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}