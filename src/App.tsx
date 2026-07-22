import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import LoginPage from "./pages/auth/LoginPage";

import ProtectedRoute from "./components/auth/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";

import DashboardPage from "./pages/admin/DashboardPage";
import StudentsPage from "./pages/admin/students/StudentsPage";
import ClassesPage from "./pages/admin/classes/ClassesPage";
import TeachersPage from "./pages/admin/teachers/TeachersPage";
import SubjectsPage from "./pages/admin/subjects/SubjectsPage";
import ResultsPage from "./pages/admin/results/ResultsPage";
import ReportCardsPage from "./pages/admin/results/ReportCardsPage";
import ParentReportsPage from "./pages/portal/ParentReportsPage";

export default function App() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Admin Dashboard */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AppLayout>
              <DashboardPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Students */}
      <Route
        path="/admin/students"
        element={
          <ProtectedRoute>
            <AppLayout>
              <StudentsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Classes */}
      <Route
        path="/admin/classes"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ClassesPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Teachers */}
      <Route
        path="/admin/teachers"
        element={
          <ProtectedRoute>
            <AppLayout>
              <TeachersPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Subjects */}
      <Route
        path="/admin/subjects"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SubjectsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Results */}
      <Route
        path="/admin/results"
        element={
          <ProtectedRoute allowedRoles={["Super Admin", "School Admin", "Teacher", "super_admin", "school_admin", "teacher", "admin", "Admin"]}>
            <AppLayout>
              <ResultsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute allowedRoles={["Super Admin", "School Admin", "Teacher", "super_admin", "school_admin", "teacher", "admin", "Admin"]}>
            <AppLayout>
              <ReportCardsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/portal/reports"
        element={
          <ProtectedRoute allowedRoles={["Parent", "parent"]}>
            <ParentReportsPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}