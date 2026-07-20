import { Search } from "lucide-react";

interface StudentFiltersProps {
  search: string;
  className: string;
  onSearchChange: (value: string) => void;
  onClassChange: (value: string) => void;
}

const classOptions = [
  "All Classes",
  "Creche",
  "Pre-Nursery",
  "Nursery 1",
  "Nursery 2",
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "Primary 6",
];

export default function StudentFilters({
  search,
  className,
  onSearchChange,
  onClassChange,
}: StudentFiltersProps) {
  return (
    <div
      className="card"
      style={{
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 260,
          display: "flex",
          alignItems: "center",
          gap: 10,
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          padding: "12px 16px",
        }}
      >
        <Search size={18} color="#6B7280" />

        <input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by student name or admission number..."
          aria-label="Search students"
          style={{
            border: "none",
            outline: "none",
            width: "100%",
            fontSize: 15,
            fontFamily: "Poppins",
            background: "transparent",
          }}
        />
      </div>

      <select
        value={className}
        onChange={(event) => onClassChange(event.target.value)}
        aria-label="Filter students by class"
        style={{
          padding: "12px 16px",
          borderRadius: 12,
          border: "1px solid #E5E7EB",
          fontFamily: "Poppins",
          minWidth: 180,
        }}
      >
        {classOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}