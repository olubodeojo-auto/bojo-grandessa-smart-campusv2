import { Bell, ChevronDown, Menu, Search, X } from "lucide-react";
import { type CSSProperties, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthContext } from "../../contexts/AuthContext";
import "../../styles/admin-preview.css";

const activeLinkStyle: CSSProperties = {
  background: "rgba(15, 107, 53, 0.14)",
  color: "#0f6b35",
  borderColor: "rgba(15, 107, 53, 0.22)",
};

export default function AdministratorPreviewLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuthContext();

  const adminNavigation = [
    { key: "dashboard", label: "Dashboard", path: "/admin", searchPlaceholder: "Search dashboard" },
    { key: "students", label: "Students", path: "/admin/students", searchPlaceholder: "Search students" },
    { key: "results", label: "Results", path: "/admin/results", searchPlaceholder: "Search results" },
    { key: "classes", label: "Classes", path: "/admin/classes", searchPlaceholder: "Search classes" },
    { key: "staff", label: "Staff & Users", path: "/admin/staff", searchPlaceholder: "Search staff" },
    { key: "staff-directory", label: "Staff Directory", path: "/admin/staff-directory", searchPlaceholder: "Search staff directory" },
    { key: "gallery", label: "Gallery", path: "/admin/gallery", searchPlaceholder: "Search gallery" },
    { key: "announcements", label: "Announcements", path: "/admin/announcements", searchPlaceholder: "Search announcements" },
  ];

  const currentItem = useMemo(() => adminNavigation.find((item) => item.path === location.pathname) ?? adminNavigation[0], [location.pathname]);

  const breadcrumbItems = useMemo(() => {
    return ["Administrator", currentItem.label];
  }, [currentItem]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="admin-preview-shell">
      <div className="admin-preview-frame">
        <aside className={`admin-preview-sidebar${isSidebarOpen ? " is-open" : ""}`}>
          <div className="admin-preview-sidebar__brand-row">
            <div className="admin-preview-sidebar__brand-mark">GS</div>
            <div>
              <p className="admin-preview-sidebar__eyebrow">Grandessa Smart Campus</p>
              <h2>Administrator</h2>
            </div>
            <button
              type="button"
              className="admin-preview-icon-button admin-preview-sidebar__close"
              aria-label="Close menu"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          <nav className="admin-preview-sidebar__nav" aria-label="Administrator Navigation">
            {adminNavigation.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className="admin-preview-sidebar__link"
                style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}
                onClick={() => setIsSidebarOpen(false)}
              >
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        {isSidebarOpen ? (
          <button
            type="button"
            className="admin-preview-sidebar-backdrop"
            aria-label="Close sidebar"
            onClick={() => setIsSidebarOpen(false)}
          />
        ) : null}

        <div className="admin-preview-main">
          <header className="admin-preview-topbar">
            <div className="admin-preview-topbar__left">
              <button
                type="button"
                className="admin-preview-icon-button admin-preview-mobile-toggle"
                aria-label="Open menu"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu size={18} />
              </button>

              <div className="admin-preview-breadcrumbs" aria-label="Breadcrumb">
                {breadcrumbItems.map((item, index) => (
                  <span key={item}>
                    {item}
                    {index < breadcrumbItems.length - 1 ? <span className="admin-preview-breadcrumbs__sep">/</span> : null}
                  </span>
                ))}
              </div>
            </div>

            <div className="admin-preview-topbar__right">
              <label className="admin-preview-search" aria-label="Search">
                <Search size={16} />
                <input type="text" placeholder={currentItem.searchPlaceholder} readOnly />
              </label>

              <button type="button" className="admin-preview-icon-button" aria-label="Notifications">
                <Bell size={18} />
                <span className="admin-preview-notification-dot" />
              </button>

              <button type="button" className="admin-preview-profile" aria-label="Administrator profile menu">
                <span className="admin-preview-profile__avatar">A</span>
                <span className="admin-preview-profile__text">
                  <strong>Administrator</strong>
                </span>
                <ChevronDown size={16} />
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                style={{
                  marginLeft: "0.75rem",
                  border: "1px solid rgba(15, 107, 53, 0.18)",
                  background: "#ffffff",
                  color: "#0f6b35",
                  borderRadius: "999px",
                  padding: "0.55rem 0.9rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Sign Out
              </button>
            </div>
          </header>

          <div className="admin-preview-content">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}