/* eslint-disable react-hooks/set-state-in-effect */

import { motion } from "framer-motion";
import { UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getStudents } from "../../../services/studentService";
import type { Student } from "../../../types/student";
import StudentFilters from "./StudentFilters";
import StudentForm from "./StudentForm";
import StudentProfile from "./StudentProfile";
import StudentTable from "./StudentTable";

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [className, setClassName] = useState<string>("All Classes");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);

  const loadStudents = useCallback(async (): Promise<void> => {
    setLoading(true);

    try {
      const data = await getStudents({ search, className: className === "All Classes" ? "" : className });
      setStudents(data);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load students.";

      console.error(message);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [className, search]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const filteredStudents = useMemo(() => students, [students]);

  const openAddModal = (): void => {
    setSelectedStudent(null);
    setFormMode("add");
    setIsFormOpen(true);
  };

  const openEditModal = (student: Student): void => {
    setSelectedStudent(student);
    setFormMode("edit");
    setIsFormOpen(true);
  };

  const openProfileModal = (student: Student): void => {
    setSelectedStudent(student);
    setIsProfileOpen(true);
  };

  const closeFormModal = (): void => {
    setIsFormOpen(false);
    setSelectedStudent(null);
  };

  const closeProfileModal = (): void => {
    setIsProfileOpen(false);
    setSelectedStudent(null);
  };

  const handleDelete = async (student: Student): Promise<void> => {
    const confirmed = window.confirm(
      `Delete ${student.first_name} ${student.last_name}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const { deleteStudent } = await import("../../../services/studentService");
      await deleteStudent(student.id);
      await loadStudents();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to delete student.";

      console.error(message);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div
          className="card"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontFamily: "Fredoka",
                fontSize: 32,
              }}
            >
              Students
            </h1>

            <p
              style={{
                marginTop: 8,
                color: "#666",
                fontFamily: "Poppins",
              }}
            >
              Manage student records, admissions and profiles.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#2E7D32",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "12px 20px",
              cursor: "pointer",
              fontFamily: "Poppins",
              fontWeight: 600,
            }}
          >
            <UserPlus size={18} />
            Add Student
          </button>
        </div>

        <StudentFilters
          search={search}
          className={className}
          onSearchChange={setSearch}
          onClassChange={setClassName}
        />

        <div style={{ marginTop: 24 }}>
          <StudentTable
            students={filteredStudents}
            loading={loading}
            onView={openProfileModal}
            onEdit={openEditModal}
            onDelete={handleDelete}
          />
        </div>
      </motion.div>

      {isFormOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999,
          }}
        >
          <div
            style={{
              width: 760,
              maxWidth: "92vw",
              maxHeight: "90vh",
              height: "auto",
              background: "#fff",
              borderRadius: 16,
              padding: 24,
              boxSizing: "border-box",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <StudentForm
              mode={formMode}
              student={selectedStudent}
              onClose={closeFormModal}
              onSaved={loadStudents}
            />
          </div>
        </div>
      ) : null}

      {isProfileOpen && selectedStudent ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999,
          }}
        >
          <div
            style={{
              width: 700,
              maxWidth: "95%",
              background: "#fff",
              borderRadius: 16,
              padding: 24,
            }}
          >
            <StudentProfile student={selectedStudent} />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button type="button" onClick={closeProfileModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}