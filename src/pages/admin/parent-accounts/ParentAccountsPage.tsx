import { ExternalLink, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { createParentPortalAccount, resendParentPortalInvite } from "../../../services/parentAccountService";
import {
  getParentAccountDirectory,
  type ParentAccountDirectoryEntry,
  type ParentAccountStatus,
} from "../../../services/parentAccountDirectoryService";

const statusLabels: Record<ParentAccountStatus | "all", string> = {
  all: "All",
  not_created: "No Account",
  invited: "Invitation Pending",
  active: "Active",
};

const statusColors: Record<ParentAccountStatus, { background: string; color: string }> = {
  not_created: { background: "#f1f5f9", color: "#475569" },
  invited: { background: "#fef3c7", color: "#92400e" },
  active: { background: "#dcfce7", color: "#166534" },
};

function displayName(entry: ParentAccountDirectoryEntry): string {
  return [entry.contact.first_name, entry.contact.last_name].filter(Boolean).join(" ") || "Unnamed contact";
}

function studentDisplayName(student: ParentAccountDirectoryEntry["students"][number]): string {
  return [student.first_name, student.last_name].filter(Boolean).join(" ") || "Unnamed student";
}

function matchesSearch(entry: ParentAccountDirectoryEntry, value: string): boolean {
  const haystack = [
    displayName(entry),
    entry.contact.email,
    entry.contact.phone,
    ...entry.students.flatMap((student) => [studentDisplayName(student), student.admission_number, student.class_name]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(value);
}

export default function ParentAccountsPage() {
  const [entries, setEntries] = useState<ParentAccountDirectoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ParentAccountStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [workingContactId, setWorkingContactId] = useState("");
  const [error, setError] = useState("");

  const loadDirectory = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError("");

    try {
      setEntries(await getParentAccountDirectory());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load parent accounts.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const filteredEntries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return entries.filter((entry) =>
      (statusFilter === "all" || entry.account_status === statusFilter) &&
      (!normalizedSearch || matchesSearch(entry, normalizedSearch)),
    );
  }, [entries, search, statusFilter]);

  async function manageAccount(entry: ParentAccountDirectoryEntry): Promise<void> {
    setWorkingContactId(entry.contact.id);
    setError("");

    try {
      if (entry.account_status === "not_created") {
        await createParentPortalAccount(entry.contact.id);
      } else if (entry.account_status === "invited") {
        await resendParentPortalInvite(entry.contact.id);
      }
      await loadDirectory();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to manage this parent account.");
    } finally {
      setWorkingContactId("");
    }
  }

  return (
    <section style={{ display: "grid", gap: 20 }}>
      <header className="card" style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "Fredoka", fontSize: 32 }}>Parent Accounts</h1>
          <p style={{ margin: "8px 0 0", color: "#666", fontFamily: "Poppins" }}>
            Manage parent and guardian portal accounts and linked students.
          </p>
        </div>
        <Link to="/admin/students" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <ExternalLink size={16} />
          Open Students
        </Link>
      </header>

      <section className="card" style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 280px" }}>
            <Search size={18} color="#64748b" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search parent, email, phone or student"
              aria-label="Search parent accounts"
              style={{ width: "100%", padding: "12px", border: "1px solid #d1d5db", borderRadius: 8, boxSizing: "border-box" }}
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ParentAccountStatus | "all")}
            aria-label="Filter parent accounts by status"
            style={{ minWidth: 190, padding: "12px", border: "1px solid #d1d5db", borderRadius: 8 }}
          >
            {(Object.keys(statusLabels) as Array<ParentAccountStatus | "all">).map((status) => (
              <option key={status} value={status}>{statusLabels[status]}</option>
            ))}
          </select>
        </div>

        {error ? <p role="alert" style={{ margin: 0, color: "#991b1b" }}>{error}</p> : null}

        {loading ? <p style={{ margin: 0 }}>Loading parent accounts...</p> : filteredEntries.length === 0 ? (
          <div style={{ padding: 24, border: "1px solid #e5e7eb", borderRadius: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>No parent accounts found</h2>
            <p style={{ marginBottom: 0, color: "#666" }}>Try changing the search or status filter.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ padding: "12px 8px" }}>Parent/Guardian</th>
                  <th style={{ padding: "12px 8px" }}>Relationship</th>
                  <th style={{ padding: "12px 8px" }}>Email</th>
                  <th style={{ padding: "12px 8px" }}>Phone</th>
                  <th style={{ padding: "12px 8px" }}>Linked Student(s)</th>
                  <th style={{ padding: "12px 8px" }}>Account Status</th>
                  <th style={{ padding: "12px 8px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => {
                  const colors = statusColors[entry.account_status];
                  const working = workingContactId === entry.contact.id;

                  return (
                    <tr key={entry.contact.id} style={{ borderBottom: "1px solid #f0f1f2", verticalAlign: "top" }}>
                      <td style={{ padding: "14px 8px", fontWeight: 600 }}>{displayName(entry)}</td>
                      <td style={{ padding: "14px 8px" }}>{entry.contact.relationship || "Not specified"}</td>
                      <td style={{ padding: "14px 8px" }}>{entry.contact.email || "Not provided"}</td>
                      <td style={{ padding: "14px 8px" }}>{entry.contact.phone || "Not provided"}</td>
                      <td style={{ padding: "14px 8px" }}>
                        <div style={{ display: "grid", gap: 6 }}>
                          {entry.students.map((student) => (
                            <Link key={student.id} to="/admin/students" title="Open Students to edit this linked student">
                              {studentDisplayName(student)}{student.class_name ? ` (${student.class_name})` : ""}
                            </Link>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: "14px 8px" }}>
                        <span style={{ display: "inline-block", padding: "5px 8px", borderRadius: 999, background: colors.background, color: colors.color, fontSize: 12, fontWeight: 700 }}>
                          {statusLabels[entry.account_status]}
                        </span>
                      </td>
                      <td style={{ padding: "14px 8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          {entry.account_status === "active" ? (
                            <span style={{ color: "#166534", fontSize: 13, fontWeight: 700 }}>Active</span>
                          ) : (
                            <button type="button" onClick={() => void manageAccount(entry)} disabled={working}>
                              {working ? "Working..." : entry.account_status === "invited" ? "Resend Invite" : "Create Account"}
                            </button>
                          )}
                          <Link to="/admin/students">Edit</Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
