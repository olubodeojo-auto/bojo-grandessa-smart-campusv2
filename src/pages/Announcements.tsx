import PublicFooter from "../components/homepage/PublicFooter";
import PublicNavigation from "../components/homepage/PublicNavigation";
import AnnouncementsList from "../components/AnnouncementsList";

export default function Announcements() {
  return (
    <main className="homepage">
      <PublicNavigation active="announcements" />

      <section className="homepage-section" style={{ minHeight: "55vh" }}>
        <div className="homepage-container" style={{ maxWidth: 900 }}>
          <div style={{ marginBottom: 24 }}>
            <p className="homepage-eyebrow">Latest News</p>
            <h1 style={{ margin: 0, fontSize: "clamp(2rem, 4vw, 3rem)" }}>Announcements</h1>
          </div>
          <AnnouncementsList limit={10} />
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
