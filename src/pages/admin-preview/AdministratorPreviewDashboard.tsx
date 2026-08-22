import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";


export default function AdministratorPreviewDashboard() {
  const adminModules = [
    { title: "Dashboard", subtitle: "Overview", path: "/admin" },
    { title: "Students", subtitle: "Manage student records", path: "/admin/students" },
    { title: "Results", subtitle: "Enter and view results", path: "/admin/results" },
    { title: "Reports", subtitle: "Report templates and sample reports", path: "/admin/reports" },
    { title: "Gallery", subtitle: "Manage school gallery", path: "/admin/gallery" },
    { title: "Announcements", subtitle: "Manage announcements", path: "/admin/announcements" },
  ] as const;

  const quickActions = [
    { label: "Students", path: "/admin/students" },
    { label: "Results", path: "/admin/results" },
    { label: "Gallery", path: "/admin/gallery" },
    { label: "Announcements", path: "/admin/announcements" },
  ];

  return (
    <section className="admin-preview-page">
      <header className="admin-preview-page-header">
        <div>
          <h1>Hello, Administrator.</h1>
          <p>Welcome to Grandessa Smart Campus.</p>
        </div>
      </header>

      <div className="admin-preview-dashboard-grid">
        <section id="admin-modules" className="admin-preview-panel">
          <div className="admin-preview-section-head">
            <div>
              <h3>Administrator Modules</h3>
              <p>Access the working administration modules for Grandessa School.</p>
            </div>
          </div>

          <div className="admin-preview-card-grid columns-3">
            {adminModules.map((item) => (
              <Link key={item.path} to={item.path} className="admin-preview-module-card">
                <div className="admin-preview-card-item__top">
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.subtitle}</p>
                  </div>
                </div>

                <span className="admin-preview-module-card__link">
                  Open module <ArrowRight size={16} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="admin-preview-panel">
          <div className="admin-preview-section-head">
            <div>
              <h3>Quick Actions</h3>
              <p>Common tasks to open the working modules.</p>
            </div>
          </div>

          <div className="admin-preview-action-list">
            {quickActions.map((action) => (
              <Link key={action.label} to={action.path} className="admin-preview-action-item">
                <span>{action.label}</span>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}