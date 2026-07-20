import { motion } from "framer-motion";
import { UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  deleteTeacher,
  getTeachers,
} from "../../../services/teacherService";
import type { Teacher } from "../../../types/teacher";
import TeacherFilters from "./TeacherFilters";
import TeacherForm from "./TeacherForm";
import TeacherProfile from "./TeacherProfile";
import TeacherTable from "./TeacherTable";

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [department, setDepartment] = useState<string>("All Departments");
  const [status, setStatus] = useState<string>("All Statuses");
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);

  const loadTeachers = useCallback(async (): Promise<void> => {
    setLoading(true);

    try {
      const data = await getTeachers();
      setTeachers(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load teachers.";

      console.error(message);
      setTeachers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTeachers();
  }, [loadTeachers]);

  const filteredTeachers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return teachers.filter((teacher) => {
      const matchesSearch =
        term.length === 0 ||
        teacher.first_name.toLowerCase().includes(term) ||
        teacher.last_name.toLowerCase().includes(term) ||
        teacher.employee_number.toLowerCase().includes(term);

      const matchesDepartment =
        department === "All Departments" ||
        (teacher.specialization ?? "").toLowerCase().includes(department.toLowerCase());

      const matchesStatus = status === "All Statuses" || teacher.status === status;

      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [department, search, status, teachers]);

  const openAddModal = (): void => {
    setSelectedTeacher(null);
    setFormMode("add");
    setIsFormOpen(true);
  };

  const openEditModal = (teacher: Teacher): void => {
    setSelectedTeacher(teacher);
    setFormMode("edit");
    setIsFormOpen(true);
  };

  const openProfileModal = (teacher: Teacher): void => {
    setSelectedTeacher(teacher);
    setIsProfileOpen(true);
  };

  const closeFormModal = (): void => {
    setIsFormOpen(false);
    setSelectedTeacher(null);
  };

  const closeProfileModal = (): void => {
    setIsProfileOpen(false);
    setSelectedTeacher(null);
  };

  const handleDelete = async (teacher: Teacher): Promise<void> => {
    const confirmed = window.confirm(`Delete ${teacher.first_name} ${teacher.last_name}?`);

    if (!confirmed) {
      return;
    }

    try {
      await deleteTeacher(teacher.id);
      await loadTeachers();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to delete teacher.";

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
            <h1 style={{ margin: 0, fontFamily: "Fredoka", fontSize: 32 }}>
              Teachers
            </h1>

            <p style={{ marginTop: 8, color: "#666", fontFamily: "Poppins" }}>
              Manage teacher profiles, assignments and status.
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
            Add Teacher
          </button>
        </div>

        <TeacherFilters
          search={search}
          department={department}
          status={status}
          onSearchChange={setSearch}
          onDepartmentChange={setDepartment}
          onStatusChange={setStatus}
        />

        <div style={{ marginTop: 24 }}>
          <TeacherTable
            teachers={filteredTeachers}
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
              maxWidth: "95%",
              background: "#fff",
              borderRadius: 16,
              padding: 24,
            }}
          >
            <TeacherForm
              mode={formMode}
              teacher={selectedTeacher}
              onClose={closeFormModal}
              onSaved={loadTeachers}
            />
          </div>
        </div>
      ) : null}

      {isProfileOpen && selectedTeacher ? (
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
            <TeacherProfile teacher={selectedTeacher} />
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
