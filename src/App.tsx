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
import CompleteAccountPage from "./pages/auth/CompleteAccountPage";
import ChangePasswordPage from "./pages/auth/ChangePasswordPage";
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
import StaffPage from "./pages/admin/staff/StaffPage";
import StaffDirectoryPage from "./pages/admin/staff-directory/StaffDirectoryPage";
import CommunicationsPage from "./pages/admin/CommunicationsPage";
import AssignmentsPage from "./pages/admin/assignments/AssignmentsPage";
import ParentAccountsPage from "./pages/admin/parent-accounts/ParentAccountsPage";
import ParentReportsPage from "./pages/portal/ParentReportsPage";
import ParentAssignmentsPage from "./pages/portal/ParentAssignmentsPage";
import ParentHomePage from "./pages/portal/ParentHomePage";
import ParentStudentsPage from "./pages/portal/ParentStudentsPage";
import ParentPortalLayout from "./components/portal/ParentPortalLayout";
import OurTeam from "./pages/OurTeam";

const administratorRoles = ["Proprietress", "Super Admin", "Administrator", "School Admin", "super_admin", "school_admin", "admin", "Admin"];
const adminShellRoles = [...administratorRoles, "Teacher", "teacher"];

export default function App() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/admissions" element={<Admissions />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/gallery" element={<ParentPortalLayout><Gallery /></ParentPortalLayout>} />
      <Route path="/announcements" element={<ParentPortalLayout><Announcements /></ParentPortalLayout>} />
      <Route path="/our-team" element={<ParentPortalLayout><OurTeam /></ParentPortalLayout>} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/complete-account" element={<CompleteAccountPage />} />
      <Route path="/change-password" element={<ParentPortalLayout><ProtectedRoute><ChangePasswordPage /></ProtectedRoute></ParentPortalLayout>} />

      <Route path="/administrator-preview" element={<AdministratorPreviewLayout />}>
        <Route index element={<AdministratorPreviewDashboard />} />
        <Route path="report-card" element={<SampleReportCardPage />} />
        <Route path=":moduleId" element={<AdministratorPreviewModulePage />} />
      </Route>

      {/* Admin workspace (Administrator Preview shell used as real admin layout) */}
      <Route path="/admin" element={<ProtectedRoute allowedRoles={adminShellRoles}><AdministratorPreviewLayout /></ProtectedRoute>}>
        <Route index element={<ProtectedRoute><AdministratorPreviewDashboard /></ProtectedRoute>} />

        <Route path="students" element={<ProtectedRoute allowedRoles={administratorRoles}><StudentsPage /></ProtectedRoute>} />

        <Route path="parent-accounts" element={<ProtectedRoute allowedRoles={administratorRoles}><ParentAccountsPage /></ProtectedRoute>} />

        <Route path="results" element={<ProtectedRoute allowedRoles={["Super Admin", "School Admin", "Teacher", "super_admin", "school_admin", "teacher", "admin", "Admin", "Administrator"]}><ResultsPage /></ProtectedRoute>} />

        <Route path="classes" element={<ProtectedRoute allowedRoles={["Super Admin", "School Admin", "super_admin", "school_admin", "admin", "Admin", "Administrator"]}><ClassesPage /></ProtectedRoute>} />

        <Route path="staff" element={<ProtectedRoute allowedRoles={["Proprietress", "Super Admin", "Administrator", "School Admin", "super_admin", "school_admin", "admin", "Admin"]}><StaffPage /></ProtectedRoute>} />

        <Route path="communications" element={<ProtectedRoute allowedRoles={["Proprietress", "Super Admin", "Administrator", "School Admin", "super_admin", "school_admin", "admin", "Admin"]}><CommunicationsPage /></ProtectedRoute>} />

        <Route path="assignments" element={<ProtectedRoute allowedRoles={["Proprietress", "Super Admin", "Administrator", "School Admin", "Teacher", "super_admin", "school_admin", "teacher", "admin", "Admin"]}><AssignmentsPage /></ProtectedRoute>} />

        <Route path="staff-directory" element={<ProtectedRoute allowedRoles={["Proprietress", "Super Admin", "Administrator", "School Admin", "super_admin", "school_admin", "admin", "Admin"]}><StaffDirectoryPage /></ProtectedRoute>} />

        <Route path="reports" element={<ProtectedRoute allowedRoles={["Super Admin", "School Admin", "Teacher", "super_admin", "school_admin", "teacher", "admin", "Admin", "Administrator"]}><ReportCardsPage /></ProtectedRoute>} />

        <Route path="gallery" element={<ProtectedRoute allowedRoles={administratorRoles}><GalleryPage /></ProtectedRoute>} />

        <Route path="announcements" element={<ProtectedRoute allowedRoles={administratorRoles}><AnnouncementsPage /></ProtectedRoute>} />
      </Route>

      <Route path="/portal" element={<ParentPortalLayout><ProtectedRoute allowedRoles={["Parent", "parent"]}><ParentHomePage /></ProtectedRoute></ParentPortalLayout>} />
      <Route path="/portal/students" element={<ParentPortalLayout><ProtectedRoute allowedRoles={["Parent", "parent"]}><ParentStudentsPage /></ProtectedRoute></ParentPortalLayout>} />
      <Route
          path="/portal/reports"
          element={<ParentPortalLayout><ProtectedRoute allowedRoles={["Parent", "parent"]}><ParentReportsPage /></ProtectedRoute></ParentPortalLayout>}
      />
      <Route path="/portal/assignments" element={<ParentPortalLayout><ProtectedRoute allowedRoles={["Parent", "parent"]}><ParentAssignmentsPage /></ProtectedRoute></ParentPortalLayout>} />
    </Routes>
  );
}