import { Search } from "lucide-react";

interface ClassFiltersProps {
  search: string;
  academicLevel: string;
  status: string;
  onSearchChange: (value: string) => void;
  onAcademicLevelChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}

const academicLevelOptions = [
  "All Levels",
  "Creche",
  "Nursery",
  "Primary",
  "Junior Secondary",
  "Senior Secondary",
];

const statusOptions = ["All Statuses", "Active", "Inactive", "Archived"];

export default function ClassFilters({
  search,
  academicLevel,
  status,
  onSearchChange,
  onAcademicLevelChange,
  onStatusChange,
}: ClassFiltersProps) {
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
          placeholder="Search by class name or stream..."
          aria-label="Search classes"
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
        value={academicLevel}
        onChange={(event) => onAcademicLevelChange(event.target.value)}
        aria-label="Filter classes by academic level"
        style={{
          padding: "12px 16px",
          borderRadius: 12,
          border: "1px solid #E5E7EB",
          fontFamily: "Poppins",
          minWidth: 180,
        }}
      >
        {academicLevelOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <select
        value={status}
        onChange={(event) => onStatusChange(event.target.value)}
        aria-label="Filter classes by status"
        style={{
          padding: "12px 16px",
          borderRadius: 12,
          border: "1px solid #E5E7EB",
          fontFamily: "Poppins",
          minWidth: 180,
        }}
      >
        {statusOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
