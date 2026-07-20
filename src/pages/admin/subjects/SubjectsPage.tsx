import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import Button from "../../../components/ui/Button";
import PageHeader from "../../../components/layout/PageHeader";
import AppModal from "../../../components/modals/AppModal";
import { archiveSubject, getSubjects } from "../../../services/subjectService";
import type { Subject } from "../../../types/subject";
import SubjectFilters from "./SubjectFilters";
import SubjectForm from "./SubjectForm";
import SubjectProfile from "./SubjectProfile";
import SubjectTable from "./SubjectTable";

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [department, setDepartment] = useState<string>("All Departments");
  const [academicLevel, setAcademicLevel] = useState<string>("All Levels");
  const [status, setStatus] = useState<string>("All Statuses");
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);

  const loadSubjects = useCallback(async (): Promise<void> => {
    setLoading(true);

    try {
      const data = await getSubjects();
      setSubjects(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load subjects.";
      console.error(message);
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSubjects();
  }, [loadSubjects]);

  const filteredSubjects = useMemo(() => {
    const term = search.trim().toLowerCase();

    return subjects.filter((subject) => {
      const normalizedName = subject.subject_name.toLowerCase();
      const normalizedCode = subject.subject_code.toLowerCase();
      const normalizedDepartment = (subject.department ?? "").toLowerCase();
      const normalizedLevel = (subject.academic_level ?? "").toLowerCase();

      const matchesSearch =
        term.length === 0 || normalizedName.includes(term) || normalizedCode.includes(term);

      const matchesDepartment =
        department === "All Departments" || normalizedDepartment.includes(department.toLowerCase());

      const matchesLevel =
        academicLevel === "All Levels" || normalizedLevel.includes(academicLevel.toLowerCase());

      const matchesStatus = status === "All Statuses" || subject.status === status;

      return matchesSearch && matchesDepartment && matchesLevel && matchesStatus;
    });
  }, [academicLevel, department, search, status, subjects]);

  const openAddModal = (): void => {
    setSelectedSubject(null);
    setFormMode("add");
    setIsFormOpen(true);
  };

  const openEditModal = (subject: Subject): void => {
    setSelectedSubject(subject);
    setFormMode("edit");
    setIsFormOpen(true);
  };

  const openProfileModal = (subject: Subject): void => {
    setSelectedSubject(subject);
    setIsProfileOpen(true);
  };

  const closeFormModal = (): void => {
    setIsFormOpen(false);
    setSelectedSubject(null);
  };

  const closeProfileModal = (): void => {
    setIsProfileOpen(false);
    setSelectedSubject(null);
  };

  const handleArchive = async (subject: Subject): Promise<void> => {
    const confirmed = window.confirm(`Archive ${subject.subject_name}?`);

    if (!confirmed) {
      return;
    }

    try {
      await archiveSubject(subject.id);
      await loadSubjects();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to archive subject.";
      console.error(message);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <PageHeader
          title="Subjects"
          description="Manage curriculum subjects and academic structure."
          actions={
            <Button type="button" onClick={openAddModal} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <BookOpen size={18} />
              Add Subject
            </Button>
          }
        />

        <SubjectFilters search={search} department={department} academicLevel={academicLevel} status={status} onSearchChange={setSearch} onDepartmentChange={setDepartment} onAcademicLevelChange={setAcademicLevel} onStatusChange={setStatus} />

        <div style={{ marginTop: 24 }}>
          <SubjectTable subjects={filteredSubjects} loading={loading} onView={openProfileModal} onEdit={openEditModal} onArchive={handleArchive} />
        </div>
      </motion.div>

      <AppModal open={isFormOpen} title={formMode === "edit" ? "Edit Subject" : "Create Subject"} size="lg" onClose={closeFormModal}>
        <SubjectForm mode={formMode} subject={selectedSubject} onClose={closeFormModal} onSaved={loadSubjects} />
      </AppModal>

      <AppModal open={isProfileOpen && Boolean(selectedSubject)} title="Subject Details" size="md" onClose={closeProfileModal} footer={<Button type="button" onClick={closeProfileModal}>Close</Button>}>
        <SubjectProfile subject={selectedSubject} />
      </AppModal>
    </>
  );
}
