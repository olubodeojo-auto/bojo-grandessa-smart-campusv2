import { Search } from "lucide-react";

interface TeacherFiltersProps {
  search: string;
  department: string;
  status: string;
  onSearchChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}

const departmentOptions = [
  "All Departments",
  "Mathematics",
  "English",
  "Science",
  "Arts",
  "Social Studies",
  "Early Childhood",
  "Computer Science",
];

const statusOptions = ["All Statuses", "Active", "Inactive", "On Leave", "Retired"];

export default function TeacherFilters({
  search,
  department,
  status,
  onSearchChange,
  onDepartmentChange,
  onStatusChange,
}: TeacherFiltersProps) {
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
          placeholder="Search by teacher name or employee number..."
          aria-label="Search teachers"
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
        value={department}
        onChange={(event) => onDepartmentChange(event.target.value)}
        aria-label="Filter teachers by department"
        style={{
          padding: "12px 16px",
          borderRadius: 12,
          border: "1px solid #E5E7EB",
          fontFamily: "Poppins",
          minWidth: 180,
        }}
      >
        {departmentOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <select
        value={status}
        onChange={(event) => onStatusChange(event.target.value)}
        aria-label="Filter teachers by status"
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
