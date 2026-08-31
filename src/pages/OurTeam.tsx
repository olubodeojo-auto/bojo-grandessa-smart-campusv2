import { useEffect, useState } from "react";
import PublicNavigation from "../components/homepage/PublicNavigation";
import PublicFooter from "../components/homepage/PublicFooter";
import PublicWhatsAppButton from "../components/homepage/PublicWhatsAppButton";
import SectionHeading from "../components/homepage/SectionHeading";
import { listStaffDirectoryEntries } from "../services/staffDirectoryService";
import type { StaffDirectoryEntry } from "../types/staffDirectory";
import "./homepage.css";
import "./our-team.css";

function getInitials(fullName: string): string {
  const names = fullName.trim().split(/\s+/).filter(Boolean);

  if (names.length === 0) {
    return "GS";
  }

  if (names.length === 1) {
    return names[0].slice(0, 2).toUpperCase();
  }

  return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
}

export default function OurTeam() {
  const [teamMembers, setTeamMembers] = useState<StaffDirectoryEntry[]>([]);

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const entries = await listStaffDirectoryEntries();
        setTeamMembers(entries);
      } catch {
        setTeamMembers([]);
      }
    };

    void loadMembers();
  }, []);

  return (
    <main className="homepage">
      <PublicNavigation active="our-team" />

      <section className="homepage-section homepage-section--tint" id="our-team-hero">
        <div className="homepage-container">
          <SectionHeading
            eyebrow="Our Team"
            title="A dedicated team committed to helping every child learn, grow and thrive."
            description="Grandessa School is shaped by caring teachers, supportive leaders and a community focused on excellence, character and belonging."
          />
        </div>
      </section>

      <section className="homepage-section" id="team-profile-grid">
        <div className="homepage-container">
          {teamMembers.length === 0 ? (
            <div className="our-team-empty">Our team profiles will appear here soon.</div>
          ) : (
            <div className="our-team-grid">
              {teamMembers.map((member) => (
                <article key={member.id} className="our-team-card">
                  {member.imageUrl ? (
                    <figure className="our-team-card__image">
                      <img src={member.imageUrl} alt={member.fullName} loading="lazy" />
                    </figure>
                  ) : (
                    <div className="our-team-card__placeholder" aria-label={`${member.fullName} placeholder`}>
                      {getInitials(member.fullName)}
                    </div>
                  )}

                  <div className="our-team-card__content">
                    <p className="homepage-eyebrow">{member.position}</p>
                    <h3>{member.fullName}</h3>
                    {member.bio ? <p>{member.bio}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <PublicWhatsAppButton />
      <PublicFooter />
    </main>
  );
}
