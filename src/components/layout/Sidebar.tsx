import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  School,
  BookOpen,
  ClipboardCheck,
  FileSpreadsheet,
  House,
  Megaphone,
  Image,
  Settings,
  LogOut,
} from "lucide-react";

import { NavLink } from "react-router-dom";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: Users, label: "Students", path: "/admin/students" },
  { icon: GraduationCap, label: "Teachers", path: "/admin/teachers" },
  { icon: School, label: "Classes", path: "/admin/classes" },
  { icon: BookOpen, label: "Subjects", path: "/admin/subjects" },
  { icon: ClipboardCheck, label: "Attendance", path: "/admin/attendance" },
  { icon: FileSpreadsheet, label: "Results", path: "/admin/results" },
  { icon: House, label: "Parents", path: "/admin/parents" },
  { icon: Megaphone, label: "Announcements", path: "/admin/announcements" },
  { icon: Image, label: "Gallery", path: "/admin/gallery" },
  { icon: Settings, label: "Settings", path: "/admin/settings" },
];

export default function Sidebar() {
  return (
    <aside
      style={{
        width: 280,
        minHeight: "100vh",
        background: "linear-gradient(180deg,#2E7D32,#43A047)",
        color: "#fff",
        padding: 30,
        borderTopRightRadius: 30,
        borderBottomRightRadius: 30,
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
      }}
    >
      <div style={{ marginBottom: 40 }}>
        <div
          style={{
            width: 70,
            height: 70,
            borderRadius: 20,
            background: "rgba(255,255,255,.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 34,
          }}
        >
          🎓
        </div>

        <h2
          style={{
            marginTop: 20,
            marginBottom: 6,
            fontFamily: "Fredoka",
            fontSize: 28,
          }}
        >
          Grandessa
        </h2>

        <p
          style={{
            opacity: 0.85,
            fontFamily: "Poppins",
          }}
        >
          Smart Campus
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flex: 1,
        }}
      >
        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.label}
              to={item.path}
              style={{ textDecoration: "none" }}
            >
              {({ isActive }) => (
                <motion.div
                  whileHover={{
                    x: 8,
                    backgroundColor: "rgba(255,255,255,.15)",
                  }}
                  transition={{ duration: 0.2 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 15,
                    padding: "14px 18px",
                    borderRadius: 16,
                    cursor: "pointer",
                    color: "#fff",
                    background: isActive
                      ? "rgba(255,255,255,.20)"
                      : "transparent",
                  }}
                >
                  <Icon size={22} />

                  <span
                    style={{
                      fontFamily: "Poppins",
                      fontSize: 16,
                    }}
                  >
                    {item.label}
                  </span>
                </motion.div>
              )}
            </NavLink>
          );
        })}
      </div>

      <motion.div
        whileHover={{
          scale: 1.03,
          backgroundColor: "rgba(255,255,255,.15)",
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 15,
          padding: 16,
          borderRadius: 16,
          cursor: "pointer",
          marginTop: 20,
        }}
      >
        <LogOut size={22} />

        <span
          style={{
            fontFamily: "Poppins",
            fontSize: 16,
          }}
        >
          Logout
        </span>
      </motion.div>
    </aside>
  );
}