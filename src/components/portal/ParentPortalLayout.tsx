import { BookOpen, ClipboardList, GalleryHorizontal, Home, KeyRound, LogOut, Megaphone, Menu, UsersRound, X } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuthContext } from "../../contexts/AuthContext";
import { useEffect } from "react";
import { getParentStudents } from "../../services/studentService";
import "../../styles/parent-portal.css";

const links = [
  { label: "Home", path: "/portal", icon: Home },
  { label: "Reports", path: "/portal/reports", icon: BookOpen },
  { label: "Assignments", path: "/portal/assignments", icon: ClipboardList },
  { label: "Announcements", path: "/announcements", icon: Megaphone },
  { label: "Gallery", path: "/gallery", icon: GalleryHorizontal },
  { label: "Our Team", path: "/our-team", icon: UsersRound },
];

export default function ParentPortalLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, role, signOut } = useAuthContext();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [childCount, setChildCount] = useState(0);
  const isParent = isAuthenticated && role?.name.trim().toLowerCase() === "parent";

  useEffect(() => {
    if (!isParent) return undefined;
    let active = true;
    void getParentStudents().then((students) => { if (active) setChildCount(students.length); }).catch(() => undefined);
    return () => { active = false; };
  }, [isParent]);

  if (!isParent) return <>{children}</>;

  async function handleSignOut(): Promise<void> {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <header className="parent-portal-header">
        <div className="parent-portal-header__inner">
          <NavLink to="/portal" className="parent-portal-brand" aria-label="Grandessa Parent Portal home">
            <span className="parent-portal-brand__mark">G</span>
            <span><strong>Grandessa</strong><small>Family Portal</small></span>
          </NavLink>
          <button className="parent-portal-menu-button" type="button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="parent-portal-navigation" aria-label={menuOpen ? "Close navigation" : "Open navigation"}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <nav id="parent-portal-navigation" className={`parent-portal-nav${menuOpen ? " is-open" : ""}`} aria-label="Parent navigation">
            {[...links, { label: childCount > 1 ? "My Children" : "My Child", path: "/portal/students", icon: UsersRound }].map(({ label, path, icon: Icon }) => (
              <NavLink key={path} to={path} onClick={() => setMenuOpen(false)} className={({ isActive }) => `parent-portal-nav__link${isActive ? " is-active" : ""}`}><Icon size={16} />{label}</NavLink>
            ))}
            <NavLink to="/change-password" onClick={() => setMenuOpen(false)} className="parent-portal-nav__link"><KeyRound size={16} />Account</NavLink>
            <button type="button" onClick={() => void handleSignOut()} className="parent-portal-nav__signout"><LogOut size={16} />Sign Out</button>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
