import { motion } from "framer-motion";
import { LayoutDashboard, Users, FileSpreadsheet, Image, Megaphone, LogOut, UserSquare2 } from "lucide-react";

import { NavLink, useNavigate } from "react-router-dom";
import { useAuthContext } from "../../contexts/AuthContext";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin", implemented: true },
  { icon: Users, label: "Students", path: "/admin/students", implemented: true },
  { icon: UserSquare2, label: "Staff Directory", path: "/admin/staff-directory", implemented: true },
  { icon: FileSpreadsheet, label: "Results", path: "/admin/results", implemented: true },
  { icon: Image, label: "Gallery", path: "/admin/gallery", implemented: true },
  { icon: Megaphone, label: "Announcements", path: "/admin/announcements", implemented: true },
];

const visibleMenuItems = menuItems.filter((item) => item.implemented);

export default function Sidebar() {
  const navigate = useNavigate();
  const { signOut } = useAuthContext();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

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
        {visibleMenuItems.map((item) => {
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

      <motion.button
        type="button"
        whileHover={{
          scale: 1.03,
          backgroundColor: "rgba(255,255,255,.15)",
        }}
        onClick={handleSignOut}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 15,
          padding: 16,
          borderRadius: 16,
          cursor: "pointer",
          marginTop: 20,
          border: "none",
          background: "transparent",
          color: "#fff",
          textAlign: "left",
          fontFamily: "Poppins",
          fontSize: 16,
        }}
      >
        <LogOut size={22} />

        <span
          style={{
            fontFamily: "Poppins",
            fontSize: 16,
          }}
        >
          Sign Out
        </span>
      </motion.button>
    </aside>
  );
}