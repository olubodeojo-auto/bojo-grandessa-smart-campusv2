import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { getPublishedAnnouncements } from "../services/announcementService";
import type { Announcement } from "../types/announcement";

interface AnnouncementsListProps {
  limit?: number;
}

export default function AnnouncementsList({ limit = 3 }: AnnouncementsListProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function loadAnnouncements() {
      try {
        const data = await getPublishedAnnouncements(limit);
        setAnnouncements(data);
      } catch (error) {
        console.error("Failed to load announcements:", error);
      } finally {
        setLoading(false);
      }
    }

    void loadAnnouncements();
  }, [limit]);

  if (loading) {
    return null;
  }

  if (announcements.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          background: "#f9f9f9",
          border: "1px solid #e0e0e0",
          borderRadius: 12,
          color: "#666",
          textAlign: "center",
          fontFamily: "Poppins",
        }}
      >
        No published announcements at the moment.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 16,
      }}
    >
      {announcements.map((announcement, index) => (
        <motion.div
          key={announcement.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          onClick={() =>
            setExpanded(expanded === announcement.id ? null : announcement.id)
          }
          style={{
            background: "#f9f9f9",
            border: "1px solid #e0e0e0",
            borderRadius: 12,
            padding: 16,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (e.currentTarget instanceof HTMLElement) {
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
            }
          }}
          onMouseLeave={(e) => {
            if (e.currentTarget instanceof HTMLElement) {
              e.currentTarget.style.boxShadow = "none";
            }
          }}
        >
          <h3
            style={{
              margin: 0,
              fontFamily: "Poppins",
              fontSize: 16,
              fontWeight: 600,
              color: "#1a3a2e",
            }}
          >
            {announcement.title}
          </h3>

          <p
            style={{
              margin: "8px 0 0",
              fontFamily: "Poppins",
              fontSize: 13,
              color: "#999",
            }}
          >
            {new Date(announcement.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>

          {expanded === announcement.id && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <p
                style={{
                  margin: "12px 0 0",
                  fontFamily: "Poppins",
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#333",
                  whiteSpace: "pre-wrap",
                }}
              >
                {announcement.message}
              </p>
            </motion.div>
          )}

          <p
            style={{
              margin: "12px 0 0",
              fontFamily: "Poppins",
              fontSize: 12,
              color: "#2E7D32",
              fontWeight: 600,
            }}
          >
            {expanded === announcement.id ? "← Hide" : "View →"}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
