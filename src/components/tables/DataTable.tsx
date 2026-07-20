import type { CSSProperties, ReactNode } from "react";

export interface TableColumn<T extends object> {
  key: keyof T;
  header: string;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T extends object> {
  columns: TableColumn<T>[];
  rows: T[];
  emptyMessage?: string;
}

export default function DataTable<T extends object>({ columns, rows, emptyMessage = "No records found." }: DataTableProps<T>) {
  if (rows.length === 0) {
    return <div className="card" style={{ padding: 24 }}>{emptyMessage}</div>;
  }

  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)} style={thStyle}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => (
                <td key={String(column.key)} style={tdStyle}>
                  {column.render ? column.render(row) : String((row[column.key] as unknown) ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle: CSSProperties = {
  padding: "14px",
  textAlign: "left",
  borderBottom: "1px solid #ddd",
  fontWeight: 600,
};

const tdStyle: CSSProperties = {
  padding: "14px",
  borderBottom: "1px solid #eee",
};
