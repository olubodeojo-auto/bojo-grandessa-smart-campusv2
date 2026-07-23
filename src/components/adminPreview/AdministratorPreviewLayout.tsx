import { Bell, ChevronDown, Menu, Search, X } from "lucide-react";
import { type CSSProperties, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { previewNavigation } from "../../data/administratorPreview";
import "../../styles/admin-preview.css";

const activeLinkStyle: CSSProperties = {
  background: "rgba(15, 107, 53, 0.14)",
  color: "#0f6b35",
  borderColor: "rgba(15, 107, 53, 0.22)",
};

export default function AdministratorPreviewLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const location = useLocation();

  const currentItem = useMemo(
    () => previewNavigation.find((item) => item.path === location.pathname) ?? previewNavigation[0],
    [location.pathname]
  );

  const breadcrumbItems = useMemo(() => {
    if (currentItem.key === "dashboard") {
      return ["Administrator Preview", "Dashboard"];
    }

    return ["Administrator Preview", currentItem.label];
  }, [currentItem]);

  return (
    <div className="admin-preview-shell">
      <div className="admin-preview-frame">
        <aside className={`admin-preview-sidebar${isSidebarOpen ? " is-open" : ""}`}>
          <div className="admin-preview-sidebar__brand-row">
            <div className="admin-preview-sidebar__brand-mark">GS</div>
            <div>
              <p className="admin-preview-sidebar__eyebrow">Grandessa Smart Campus</p>
              <h2>Administrator Preview</h2>
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

          <p className="admin-preview-sidebar__summary">
            Explore the future school management system using realistic preview data.
          </p>

          <nav className="admin-preview-sidebar__nav" aria-label="Administrator Preview Navigation">
            {previewNavigation.map((item) => (
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

          <div className="admin-preview-sidebar__note">
            <h3>Preview Mode</h3>
            <p>
              This walkthrough shows how Grandessa administrators will eventually manage school
              data, communication and operations.
            </p>
          </div>
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
              <label className="admin-preview-search" aria-label="Preview search">
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
                  <small>School Preview</small>
                </span>
                <ChevronDown size={16} />
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