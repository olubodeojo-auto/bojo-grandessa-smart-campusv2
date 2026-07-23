import { AlertCircle, Download, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useParams } from "react-router-dom";

import {
  previewModules,
  type PreviewCardItem,
  type PreviewModuleKey,
  type PreviewSection,
  type PreviewStat,
} from "../../data/administratorPreview";

function StatCard({ stat }: { stat: PreviewStat }) {
  return (
    <article className="admin-preview-stat-card">
      <p>{stat.label}</p>
      <h3>{stat.value}</h3>
      {stat.note ? <small>{stat.note}</small> : null}
    </article>
  );
}

function CardItem({ item }: { item: PreviewCardItem }) {
  return (
    <article className="admin-preview-card-item">
      <div className="admin-preview-card-item__top">
        <div>
          <h4>{item.title}</h4>
          {item.subtitle ? <p>{item.subtitle}</p> : null}
        </div>
        {item.badge ? <span className="admin-preview-badge">{item.badge}</span> : null}
      </div>
      {item.meta ? <small>{item.meta}</small> : null}
      {item.lines?.length ? (
        <ul className="admin-preview-mini-list">
          {item.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function SectionRenderer({ section }: { section: PreviewSection }) {
  if (section.type === "table") {
    return (
      <section className="admin-preview-panel">
        <div className="admin-preview-section-head">
          <div>
            <h3>{section.title}</h3>
            {section.description ? <p>{section.description}</p> : null}
          </div>
          <button type="button" className="admin-preview-secondary-action">
            <Download size={16} />
            Preview Export
          </button>
        </div>

        <div className="admin-preview-table-wrap">
          <table className="admin-preview-table">
            <thead>
              <tr>
                {section.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row, index) => (
                <tr key={`${section.title}-${index}`}>
                  {row.map((value) => (
                    <td key={`${section.title}-${index}-${value}`}>{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  if (section.type === "cards") {
    return (
      <section className="admin-preview-panel">
        <div className="admin-preview-section-head">
          <div>
            <h3>{section.title}</h3>
            {section.description ? <p>{section.description}</p> : null}
          </div>
        </div>
        <div className={`admin-preview-card-grid columns-${section.columns ?? 3}`}>
          {section.items.map((item) => (
            <CardItem key={`${section.title}-${item.title}`} item={item} />
          ))}
        </div>
      </section>
    );
  }

  if (section.type === "chart") {
    const maxValue = Math.max(...section.series.map((entry) => entry.value), 1);

    return (
      <section className="admin-preview-panel">
        <div className="admin-preview-section-head">
          <div>
            <h3>{section.title}</h3>
            {section.description ? <p>{section.description}</p> : null}
          </div>
        </div>
        <div className="admin-preview-chart">
          {section.series.map((entry) => (
            <div key={`${section.title}-${entry.label}`} className="admin-preview-chart__row">
              <div className="admin-preview-chart__meta">
                <span>{entry.label}</span>
                <strong>{entry.value}%</strong>
              </div>
              <div className="admin-preview-chart__track">
                <div className="admin-preview-chart__bar" style={{ width: `${(entry.value / maxValue) * 100}%` }} />
              </div>
              {entry.hint ? <small>{entry.hint}</small> : null}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="admin-preview-panel">
      <div className="admin-preview-section-head">
        <div>
          <h3>{section.title}</h3>
          {section.description ? <p>{section.description}</p> : null}
        </div>
      </div>
      <div className="admin-preview-table-wrap">
        <table className="admin-preview-table">
          <thead>
            <tr>
              <th>Role</th>
              {section.columns.map((column) => (
                <th key={`${section.title}-${column}`}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row) => (
              <tr key={`${section.title}-${row.label}`}>
                <td>{row.label}</td>
                {row.values.map((value) => (
                  <td key={`${section.title}-${row.label}-${value}`}>{value}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AdministratorPreviewModulePage() {
  const params = useParams<{ moduleId: PreviewModuleKey }>();
  const moduleConfig = useMemo(() => {
    const key = params.moduleId;
    if (!key) {
      return null;
    }

    return previewModules[key];
  }, [params.moduleId]);

  if (!moduleConfig) {
    return (
      <section className="admin-preview-page">
        <div className="admin-preview-page-header">
          <div>
            <p className="admin-preview-kicker">Administrator Preview</p>
            <h1>Module not found</h1>
            <p>This preview route is not available yet. Select a module from the sidebar.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-preview-page">
      <header className="admin-preview-page-header">
        <div>
          <p className="admin-preview-kicker">Administrator Preview</p>
          <h1>{moduleConfig.label}</h1>
          <p>{moduleConfig.description}</p>
        </div>

        <div className="admin-preview-header-actions">
          <button type="button" className="admin-preview-primary-action">
            <Sparkles size={16} />
            Preview Workflow
          </button>
        </div>
      </header>

      <div className="admin-preview-stats-grid">
        {moduleConfig.stats.map((stat) => (
          <StatCard key={`${moduleConfig.key}-${stat.label}`} stat={stat} />
        ))}
      </div>

      <div className="admin-preview-module-grid">
        <div className="admin-preview-module-main">
          {moduleConfig.sections.map((section) => (
            <SectionRenderer key={`${moduleConfig.key}-${section.title}`} section={section} />
          ))}
        </div>

        <aside className="admin-preview-module-side">
          <section className="admin-preview-panel admin-preview-panel--accent">
            <div className="admin-preview-section-head">
              <div>
                <h3>Administrator Can</h3>
                <p>Future capabilities planned for this module.</p>
              </div>
            </div>
            <ul className="admin-preview-check-list">
              {moduleConfig.capabilities.map((capability) => (
                <li key={`${moduleConfig.key}-${capability}`}>{capability}</li>
              ))}
            </ul>
          </section>

          <section className="admin-preview-panel admin-preview-panel--soft">
            <div className="admin-preview-section-head">
              <div>
                <h3>Coming Soon</h3>
                <p>This module is currently presented as a preview.</p>
              </div>
              <AlertCircle size={18} />
            </div>
            <p className="admin-preview-muted-copy">
              Secure login, role-based permissions, live school data and interactive functionality
              will be introduced during the implementation phase.
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
}