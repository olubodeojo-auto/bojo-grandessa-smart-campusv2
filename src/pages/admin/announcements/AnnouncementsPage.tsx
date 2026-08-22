import { motion } from "framer-motion";
import { Plus, Trash2, Edit2, Eye, EyeOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "../../../services/announcementService";
import type { Announcement } from "../../../types/announcement";
import AppHeader from "../../../components/layout/AppHeader";

type FormMode = "add" | "edit" | null;

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAnnouncements();
      setAnnouncements(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load announcements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  const openAddForm = () => {
    setFormMode("add");
    setSelectedId(null);
    setTitle("");
    setMessage("");
    setPublished(false);
    setError("");
    setSuccess("");
  };

  const openEditForm = (announcement: Announcement) => {
    setFormMode("edit");
    setSelectedId(announcement.id);
    setTitle(announcement.title);
    setMessage(announcement.message);
    setPublished(announcement.published);
    setError("");
    setSuccess("");
  };

  const closeForm = () => {
    setFormMode(null);
    setSelectedId(null);
    setTitle("");
    setMessage("");
    setPublished(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !message.trim()) {
      setError("Title and message are required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (formMode === "add") {
        await createAnnouncement({
          title: title.trim(),
          message: message.trim(),
          published,
        });
        setSuccess("Announcement created!");
      } else if (formMode === "edit" && selectedId) {
        await updateAnnouncement(selectedId, {
          title: title.trim(),
          message: message.trim(),
          published,
        });
        setSuccess("Announcement updated!");
      }

      closeForm();
      await loadAnnouncements();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save announcement");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, announcementTitle: string) => {
    if (!window.confirm(`Delete "${announcementTitle}"?`)) return;

    try {
      setError("");
      await deleteAnnouncement(id);
      await loadAnnouncements();
      setSuccess("Announcement deleted!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleTogglePublish = async (announcement: Announcement) => {
    try {
      setError("");
      await updateAnnouncement(announcement.id, {
        published: !announcement.published,
      });
      await loadAnnouncements();
      setSuccess(announcement.published ? "Announcement unpublished" : "Announcement published!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <AppHeader />

      <div
        className="card"
        style={{
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontFamily: "Fredoka",
                fontSize: 32,
                marginBottom: 8,
              }}
            >
              Announcements
            </h1>
            <p
              style={{
                color: "#666",
                fontFamily: "Poppins",
                margin: 0,
              }}
            >
              Create and manage school announcements.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddForm}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#2E7D32",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              cursor: "pointer",
              fontFamily: "Poppins",
              fontWeight: 600,
            }}
          >
            <Plus size={18} />
            New Announcement
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#fee",
            color: "#c33",
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            fontFamily: "Poppins",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            background: "#efe",
            color: "#3c3",
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            fontFamily: "Poppins",
            fontSize: 14,
          }}
        >
          {success}
        </div>
      )}

      {/* List of Announcements */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#999" }}>Loading...</div>
      ) : announcements.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40, color: "#999" }}>
          <p style={{ fontFamily: "Poppins" }}>No announcements yet.</p>
          <button
            type="button"
            onClick={openAddForm}
            style={{
              background: "#2E7D32",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              cursor: "pointer",
              fontFamily: "Poppins",
              fontWeight: 600,
            }}
          >
            Create First Announcement
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 16,
          }}
        >
          {announcements.map((announcement) => (
            <div
              key={announcement.id}
              className="card"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: "Fredoka",
                      fontSize: 18,
                      flex: 1,
                    }}
                  >
                    {announcement.title}
                  </h3>

                  {announcement.published && (
                    <span
                      style={{
                        background: "#2E7D32",
                        color: "#fff",
                        padding: "4px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        fontFamily: "Poppins",
                        fontWeight: 600,
                      }}
                    >
                      Published
                    </span>
                  )}
                  {!announcement.published && (
                    <span
                      style={{
                        background: "#999",
                        color: "#fff",
                        padding: "4px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        fontFamily: "Poppins",
                        fontWeight: 600,
                      }}
                    >
                      Draft
                    </span>
                  )}
                </div>

                <p
                  style={{
                    margin: "8px 0",
                    fontFamily: "Poppins",
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "#333",
                  }}
                >
                  {announcement.message}
                </p>

                <p
                  style={{
                    margin: "12px 0 0 0",
                    fontFamily: "Poppins",
                    fontSize: 12,
                    color: "#999",
                  }}
                >
                  Created: {new Date(announcement.created_at).toLocaleDateString()}
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexDirection: "column",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleTogglePublish(announcement)}
                  title={announcement.published ? "Unpublish" : "Publish"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    background: announcement.published ? "#ff9800" : "#2E7D32",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 12px",
                    cursor: "pointer",
                    fontFamily: "Poppins",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {announcement.published ? (
                    <>
                      <EyeOff size={14} />
                      Unpublish
                    </>
                  ) : (
                    <>
                      <Eye size={14} />
                      Publish
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => openEditForm(announcement)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    background: "#1976d2",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 12px",
                    cursor: "pointer",
                    fontFamily: "Poppins",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <Edit2 size={14} />
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(announcement.id, announcement.title)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    background: "#d32f2f",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 12px",
                    cursor: "pointer",
                    fontFamily: "Poppins",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {formMode && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999,
          }}
        >
          <div
            style={{
              width: 600,
              maxWidth: "95%",
              background: "#fff",
              borderRadius: 16,
              padding: 24,
              maxHeight: "90vh",
              overflow: "auto",
            }}
          >
            <h2
              style={{
                marginTop: 0,
                fontFamily: "Fredoka",
                fontSize: 24,
              }}
            >
              {formMode === "add" ? "New Announcement" : "Edit Announcement"}
            </h2>

            <form onSubmit={handleSave} style={{ display: "grid", gap: 16 }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontFamily: "Poppins",
                    fontSize: 14,
                    fontWeight: 600,
                    marginBottom: 8,
                  }}
                >
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Announcement title"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    fontFamily: "Poppins",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontFamily: "Poppins",
                    fontSize: 14,
                    fontWeight: 600,
                    marginBottom: 8,
                  }}
                >
                  Message *
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Announcement message"
                  rows={6}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    fontFamily: "Poppins",
                    fontSize: 14,
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                  required
                />
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <input
                  type="checkbox"
                  id="published"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                  style={{
                    cursor: "pointer",
                  }}
                />
                <label
                  htmlFor="published"
                  style={{
                    fontFamily: "Poppins",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Publish announcement immediately
                </label>
              </div>

              {error && (
                <div
                  style={{
                    background: "#fee",
                    color: "#c33",
                    padding: 12,
                    borderRadius: 8,
                    fontFamily: "Poppins",
                    fontSize: 13,
                  }}
                >
                  {error}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={closeForm}
                  style={{
                    background: "#ccc",
                    color: "#000",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 16px",
                    cursor: "pointer",
                    fontFamily: "Poppins",
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    background: "#2E7D32",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 16px",
                    cursor: saving ? "not-allowed" : "pointer",
                    fontFamily: "Poppins",
                    fontWeight: 600,
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
}
