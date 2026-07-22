import FormField, { inputStyle } from "../../../components/forms/FormField";
import SectionCard from "../../../components/ui/SectionCard";
import type { ResultStatus } from "../../../types/result";

type ResultFiltersProps = {
  search: string;
  term: "All" | "First" | "Second" | "Third";
  session: string;
  status: "All" | ResultStatus;
  onSearchChange: (value: string) => void;
  onTermChange: (value: "All" | "First" | "Second" | "Third") => void;
  onSessionChange: (value: string) => void;
  onStatusChange: (value: "All" | ResultStatus) => void;
};

export default function ResultFilters({
  search,
  term,
  session,
  status,
  onSearchChange,
  onTermChange,
  onSessionChange,
  onStatusChange,
}: ResultFiltersProps) {
  return (
    <SectionCard>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
        <FormField label="Search" hint="Student, subject, class or teacher">
          <input
            style={inputStyle}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search results"
            aria-label="Search results"
          />
        </FormField>

        <FormField label="Term">
          <select
            style={inputStyle}
            value={term}
            onChange={(event) => onTermChange(event.target.value as "All" | "First" | "Second" | "Third")}
            aria-label="Filter by term"
          >
            <option value="All">All Terms</option>
            <option value="First">First</option>
            <option value="Second">Second</option>
            <option value="Third">Third</option>
          </select>
        </FormField>

        <FormField label="Session" hint="Academic year">
          <input
            style={inputStyle}
            value={session}
            onChange={(event) => onSessionChange(event.target.value)}
            placeholder="e.g. 2026/2027"
            aria-label="Filter by session"
          />
        </FormField>

        <FormField label="Status">
          <select
            style={inputStyle}
            value={status}
            onChange={(event) => onStatusChange(event.target.value as "All" | ResultStatus)}
            aria-label="Filter by status"
          >
            <option value="All">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Published">Published</option>
            <option value="Approved">Approved</option>
          </select>
        </FormField>
      </div>
    </SectionCard>
  );
}
