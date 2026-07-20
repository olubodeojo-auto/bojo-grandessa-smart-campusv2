import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import LoginPage from "./pages/auth/LoginPage";

import ProtectedRoute from "./components/auth/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";

import DashboardPage from "./pages/admin/DashboardPage";
import StudentsPage from "./pages/admin/students/StudentsPage";
import ClassesPage from "./pages/admin/classes/ClassesPage";

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
    </Routes>
  );
}