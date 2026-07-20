import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { archiveClass, getClasses } from "../../../services/classService";
import type { SchoolClass } from "../../../types/class";
import ClassFilters from "./ClassFilters";
import ClassForm from "./ClassForm";
import ClassProfile from "./ClassProfile";
import ClassTable from "./ClassTable";

const MODAL_OVERLAY_STYLE = {
  position: "fixed" as const,
  inset: 0,
  background: "rgba(0,0,0,.45)",
  display: "flex" as const,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  zIndex: 999,
};

const MODAL_PANEL_STYLE = {
  width: 700,
  maxWidth: "95%",
  background: "#fff",
  borderRadius: 16,
  padding: 24,
};

export default function ClassesPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [academicLevel, setAcademicLevel] = useState<string>("All Levels");
  const [status, setStatus] = useState<string>("All Statuses");
  const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);

  const loadClasses = useCallback(async (): Promise<void> => {
    setLoading(true);

    try {
      const data = await getClasses();
      setClasses(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load classes.";
      console.error(message);
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const filteredClasses = useMemo(() => {
    const term = search.trim().toLowerCase();

    return classes.filter((schoolClass) => {
      const normalizedTeacher = (schoolClass.class_teacher ?? "").toLowerCase();
      const normalizedLevel = (schoolClass.academic_level ?? "").toLowerCase();
      const normalizedSection = (schoolClass.section ?? "").toLowerCase();
      const normalizedName = schoolClass.class_name.toLowerCase();

      const matchesSearch =
        term.length === 0 ||
        normalizedName.includes(term) ||
        normalizedSection.includes(term) ||
        normalizedTeacher.includes(term);

      const matchesLevel =
        academicLevel === "All Levels" ||
        normalizedLevel.includes(academicLevel.toLowerCase()) ||
        normalizedName.includes(academicLevel.toLowerCase()) ||
        normalizedSection.includes(academicLevel.toLowerCase());

      const matchesStatus = status === "All Statuses" || schoolClass.status === status;

      return matchesSearch && matchesLevel && matchesStatus;
    });
  }, [academicLevel, classes, search, status]);

  const openAddModal = (): void => {
    setSelectedClass(null);
    setFormMode("add");
    setIsFormOpen(true);
  };

  const openEditModal = (schoolClass: SchoolClass): void => {
    setSelectedClass(schoolClass);
    setFormMode("edit");
    setIsFormOpen(true);
  };

  const openProfileModal = (schoolClass: SchoolClass): void => {
    setSelectedClass(schoolClass);
    setIsProfileOpen(true);
  };

  const closeFormModal = (): void => {
    setIsFormOpen(false);
    setSelectedClass(null);
  };

  const closeProfileModal = (): void => {
    setIsProfileOpen(false);
    setSelectedClass(null);
  };

  const handleArchive = async (schoolClass: SchoolClass): Promise<void> => {
    const confirmed = window.confirm(`Archive ${schoolClass.class_name}?`);

    if (!confirmed) {
      return;
    }

    try {
      await archiveClass(schoolClass.id);
      await loadClasses();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to archive class.";
      console.error(message);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: "Fredoka", fontSize: 32 }}>Classes</h1>
            <p style={{ marginTop: 8, color: "#666", fontFamily: "Poppins" }}>
              Manage school classes, sections and class teachers.
            </p>
          </div>

          <button type="button" onClick={openAddModal} style={{ display: "flex", alignItems: "center", gap: 10, background: "#2E7D32", color: "#fff", border: "none", borderRadius: 12, padding: "12px 20px", cursor: "pointer", fontFamily: "Poppins", fontWeight: 600 }}>
            <BookOpen size={18} />
            Add Class
          </button>
        </div>

        <ClassFilters search={search} academicLevel={academicLevel} status={status} onSearchChange={setSearch} onAcademicLevelChange={setAcademicLevel} onStatusChange={setStatus} />

        <div style={{ marginTop: 24 }}>
          <ClassTable classes={filteredClasses} loading={loading} onView={openProfileModal} onEdit={openEditModal} onArchive={handleArchive} />
        </div>
      </motion.div>

      {isFormOpen ? (
        <div role="dialog" aria-modal="true" aria-labelledby="class-form-title" style={MODAL_OVERLAY_STYLE}>
          <div style={MODAL_PANEL_STYLE}>
            <ClassForm mode={formMode} schoolClass={selectedClass} onClose={closeFormModal} onSaved={loadClasses} />
          </div>
        </div>
      ) : null}

      {isProfileOpen && selectedClass ? (
        <div role="dialog" aria-modal="true" aria-labelledby="class-profile-title" style={MODAL_OVERLAY_STYLE}>
          <div style={MODAL_PANEL_STYLE}>
            <ClassProfile schoolClass={selectedClass} />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button type="button" onClick={closeProfileModal}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}