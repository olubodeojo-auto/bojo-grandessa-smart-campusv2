import { ArrowRight, CalendarDays, Sparkles } from "lucide-react";

import {
  dashboardActivities,
  dashboardAnnouncements,
  dashboardAttendanceTrend,
  dashboardCalendar,
  dashboardCapabilities,
  dashboardEvents,
  dashboardQuickActions,
  dashboardStats,
} from "../../data/administratorPreview";

export default function AdministratorPreviewDashboard() {
  const maxTrend = Math.max(...dashboardAttendanceTrend.map((item) => item.value), 1);

  return (
    <section className="admin-preview-page">
      <header className="admin-preview-page-header">
        <div>
          <p className="admin-preview-kicker">Good Afternoon</p>
          <h1>Welcome back, Administrator.</h1>
          <p>Everything is running smoothly today.</p>
        </div>

        <div className="admin-preview-header-actions">
          <button type="button" className="admin-preview-primary-action">
            <Sparkles size={16} />
            Open Preview Workspace
          </button>
        </div>
      </header>

      <div className="admin-preview-stats-grid">
        {dashboardStats.map((stat) => (
          <article key={stat.label} className="admin-preview-stat-card">
            <p>{stat.label}</p>
            <h3>{stat.value}</h3>
            {stat.note ? <small>{stat.note}</small> : null}
          </article>
        ))}
      </div>

      <div className="admin-preview-dashboard-grid">
        <section className="admin-preview-panel admin-preview-panel--hero">
          <div className="admin-preview-section-head">
            <div>
              <h3>Administrator Can</h3>
              <p>What the finished management platform will help the school accomplish.</p>
            </div>
          </div>
          <ul className="admin-preview-check-list two-columns">
            {dashboardCapabilities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="admin-preview-panel">
          <div className="admin-preview-section-head">
            <div>
              <h3>Attendance Trend</h3>
              <p>Daily attendance performance across the current week.</p>
            </div>
          </div>
          <div className="admin-preview-chart compact">
            {dashboardAttendanceTrend.map((entry) => (
              <div key={entry.label} className="admin-preview-chart__row">
                <div className="admin-preview-chart__meta">
                  <span>{entry.label}</span>
                  <strong>{entry.value}%</strong>
                </div>
                <div className="admin-preview-chart__track">
                  <div className="admin-preview-chart__bar" style={{ width: `${(entry.value / maxTrend) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-preview-panel">
          <div className="admin-preview-section-head">
            <div>
              <h3>Quick Actions</h3>
              <p>High-priority tasks administrators will access every day.</p>
            </div>
          </div>
          <div className="admin-preview-action-list">
            {dashboardQuickActions.map((action) => (
              <button key={action} type="button" className="admin-preview-action-item">
                <span>{action}</span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        </section>

        <section className="admin-preview-panel">
          <div className="admin-preview-section-head">
            <div>
              <h3>Recent Activity</h3>
              <p>Operational events that help leadership stay informed.</p>
            </div>
          </div>
          <div className="admin-preview-table-wrap">
            <table className="admin-preview-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Team</th>
                  <th>Activity</th>
                </tr>
              </thead>
              <tbody>
                {dashboardActivities.map((row) => (
                  <tr key={`${row[0]}-${row[2]}`}>
                    {row.map((cell) => (
                      <td key={`${row[0]}-${cell}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-preview-panel">
          <div className="admin-preview-section-head">
            <div>
              <h3>School Announcements</h3>
              <p>Internal notices, planning reminders and communications.</p>
            </div>
          </div>
          <div className="admin-preview-card-grid columns-1">
            {dashboardAnnouncements.map((item) => (
              <article key={item.title} className="admin-preview-card-item">
                <div className="admin-preview-card-item__top">
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.subtitle}</p>
                  </div>
                  <span className="admin-preview-badge">{item.meta}</span>
                </div>
                {item.lines?.map((line) => (
                  <small key={`${item.title}-${line}`}>{line}</small>
                ))}
              </article>
            ))}
          </div>
        </section>

        <section className="admin-preview-panel">
          <div className="admin-preview-section-head">
            <div>
              <h3>Upcoming Events</h3>
              <p>Preview of activities that affect operations and school planning.</p>
            </div>
          </div>
          <div className="admin-preview-card-grid columns-1">
            {dashboardEvents.map((event) => (
              <article key={event.title} className="admin-preview-card-item">
                <div className="admin-preview-card-item__top">
                  <div>
                    <h4>{event.title}</h4>
                    <p>{event.subtitle}</p>
                  </div>
                  <CalendarDays size={18} />
                </div>
                <small>{event.meta}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-preview-panel">
          <div className="admin-preview-section-head">
            <div>
              <h3>Academic Calendar</h3>
              <p>School-year structure preview for planning and communication.</p>
            </div>
          </div>
          <div className="admin-preview-table-wrap">
            <table className="admin-preview-table">
              <thead>
                <tr>
                  <th>Term</th>
                  <th>Resumption</th>
                  <th>Closing</th>
                </tr>
              </thead>
              <tbody>
                {dashboardCalendar.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell) => (
                      <td key={`${row[0]}-${cell}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-preview-panel admin-preview-panel--soft">
          <div className="admin-preview-section-head">
            <div>
              <h3>Coming Soon</h3>
              <p>This module is currently presented as a preview.</p>
            </div>
          </div>
          <p className="admin-preview-muted-copy">
            Secure login, role-based permissions, live school data and interactive functionality
            will be introduced during the implementation phase.
          </p>
        </section>
      </div>
    </section>
  );
}