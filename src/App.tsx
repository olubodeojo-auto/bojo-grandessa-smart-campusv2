import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import About from "./pages/About";
import Admissions from "./pages/Admissions";
import Contact from "./pages/Contact";
import FAQ from "./pages/FAQ";
import Gallery from "./pages/Gallery";
import Announcements from "./pages/Announcements";
import LoginPage from "./pages/auth/LoginPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import AdministratorPreviewLayout from "./components/adminPreview/AdministratorPreviewLayout";
import AdministratorPreviewModulePage from "./components/adminPreview/AdministratorPreviewModulePage";
import AdministratorPreviewDashboard from "./pages/admin-preview/AdministratorPreviewDashboard";
import SampleReportCardPage from "./pages/admin-preview/SampleReportCardPage";

import ProtectedRoute from "./components/auth/ProtectedRoute";
import StudentsPage from "./pages/admin/students/StudentsPage";
import ResultsPage from "./pages/admin/results/ResultsPage";
import ReportCardsPage from "./pages/admin/results/ReportCardsPage";
import GalleryPage from "./pages/admin/gallery/GalleryPage";
import AnnouncementsPage from "./pages/admin/announcements/AnnouncementsPage";
import ClassesPage from "./pages/admin/classes/ClassesPage";
import ParentReportsPage from "./pages/portal/ParentReportsPage";

export default function App() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/admissions" element={<Admissions />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/gallery" element={<Gallery />} />
      <Route path="/announcements" element={<Announcements />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route path="/administrator-preview" element={<AdministratorPreviewLayout />}>
        <Route index element={<AdministratorPreviewDashboard />} />
        <Route path="report-card" element={<SampleReportCardPage />} />
        <Route path=":moduleId" element={<AdministratorPreviewModulePage />} />
      </Route>

      {/* Admin workspace (Administrator Preview shell used as real admin layout) */}
      <Route path="/admin" element={<AdministratorPreviewLayout />}>
        <Route index element={<ProtectedRoute><AdministratorPreviewDashboard /></ProtectedRoute>} />

        <Route path="students" element={<ProtectedRoute><StudentsPage /></ProtectedRoute>} />

        <Route path="results" element={<ProtectedRoute allowedRoles={["Super Admin", "School Admin", "Teacher", "super_admin", "school_admin", "teacher", "admin", "Admin", "Administrator"]}><ResultsPage /></ProtectedRoute>} />

        <Route path="classes" element={<ProtectedRoute allowedRoles={["Super Admin", "School Admin", "super_admin", "school_admin", "admin", "Admin", "Administrator"]}><ClassesPage /></ProtectedRoute>} />

        <Route path="reports" element={<ProtectedRoute allowedRoles={["Super Admin", "School Admin", "Teacher", "super_admin", "school_admin", "teacher", "admin", "Admin", "Administrator"]}><ReportCardsPage /></ProtectedRoute>} />

        <Route path="gallery" element={<ProtectedRoute><GalleryPage /></ProtectedRoute>} />

        <Route path="announcements" element={<ProtectedRoute><AnnouncementsPage /></ProtectedRoute>} />
      </Route>

      <Route
        path="/portal/reports"
        element={<ParentReportsPage />}
      />
    </Routes>
  );
}