import FormField, { inputStyle } from "../../../components/forms/FormField";
import SectionCard from "../../../components/ui/SectionCard";
import type { ResultStatus } from "../../../types/result";

type ReportFilter = "All" | "Midterm" | "End-of-Term";

type ResultFiltersProps = {
  search: string;
  term: "All" | "First" | "Second" | "Third";
  session: string;
  sessions: string[];
  classId: string;
  classes: Array<{ id: string; class_name: string }>;
  report: ReportFilter;
  status: "All" | ResultStatus;
  onSearchChange: (value: string) => void;
  onTermChange: (value: "All" | "First" | "Second" | "Third") => void;
  onSessionChange: (value: string) => void;
  onClassChange: (value: string) => void;
  onReportChange: (value: ReportFilter) => void;
  onStatusChange: (value: "All" | ResultStatus) => void;
};

export default function ResultFilters({
  search,
  term,
  session,
  sessions,
  classId,
  classes,
  report,
  status,
  onSearchChange,
  onTermChange,
  onSessionChange,
  onClassChange,
  onReportChange,
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

        <FormField label="Session">
          <select
            style={inputStyle}
            value={session}
            onChange={(event) => onSessionChange(event.target.value)}
            aria-label="Filter by session"
          >
            <option value="">All Sessions</option>
            {sessions.map((academicYear) => (
              <option key={academicYear} value={academicYear}>{academicYear}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Class">
          <select
            style={inputStyle}
            value={classId}
            onChange={(event) => onClassChange(event.target.value)}
            aria-label="Filter by class"
          >
            <option value="">All Classes</option>
            {classes.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.class_name}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Report type">
          <select
            style={inputStyle}
            value={report}
            onChange={(event) => onReportChange(event.target.value as ReportFilter)}
            aria-label="Filter by report type"
          >
            <option value="All">All Report Types</option>
            <option value="Midterm">Midterm Report</option>
            <option value="End-of-Term">End-of-Term Report</option>
          </select>
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
            <option value="Submitted">Submitted</option>
            <option value="Returned">Returned</option>
            <option value="Published">Published</option>
            <option value="Approved">Approved (legacy)</option>
          </select>
        </FormField>
      </div>
    </SectionCard>
  );
}
