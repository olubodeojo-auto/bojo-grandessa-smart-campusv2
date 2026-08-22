import { motion } from "framer-motion";
import { Upload, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getGalleryImages, uploadGalleryImage, deleteGalleryImage } from "../../../services/galleryService";
import type { GalleryImage } from "../../../types/gallery";
import AppHeader from "../../../components/layout/AppHeader";

export default function GalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getGalleryImages();
      setImages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load gallery");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadImages();
  }, [loadImages]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input?.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      await uploadGalleryImage(file, title, caption);
      setSuccess("Image uploaded successfully!");
      setTitle("");
      setCaption("");
      // Null-safe reset of the file input (avoid using the pooled event after await)
      try {
        if (input) input.value = "";
      } catch (resetErr) {
        // ignore reset errors — not critical for functionality
        // keep silent to avoid exposing DOM quirks to users
      }
      // Refresh gallery list after successful upload
      await loadImages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this image?")) return;

    try {
      setError("");
      await deleteGalleryImage(id);
      await loadImages();
      setSuccess("Image deleted successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
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
        <h1
          style={{
            margin: 0,
            fontFamily: "Fredoka",
            fontSize: 32,
            marginBottom: 8,
          }}
        >
          Gallery
        </h1>
        <p
          style={{
            color: "#666",
            fontFamily: "Poppins",
            margin: 0,
          }}
        >
          Manage gallery images displayed on the public website.
        </p>
      </div>

      {/* Upload Section */}
      <div
        className="card"
        style={{
          marginBottom: 24,
        }}
      >
        <h2
          style={{
            marginTop: 0,
            fontFamily: "Fredoka",
            fontSize: 20,
          }}
        >
          Upload Image
        </h2>

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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 16,
          }}
        >
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
              Title (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., School Event"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #ddd",
                borderRadius: 8,
                fontFamily: "Poppins",
                fontSize: 14,
                boxSizing: "border-box",
              }}
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
              Caption (Optional)
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Brief description"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #ddd",
                borderRadius: 8,
                fontFamily: "Poppins",
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#2E7D32",
              color: "#fff",
              padding: "10px 16px",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: "Poppins",
              fontWeight: 600,
              border: "none",
            }}
          >
            <Upload size={18} />
            Choose Image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={uploading}
              style={{
                display: "none",
              }}
            />
          </label>
          {uploading && <span style={{ fontFamily: "Poppins" }}>Uploading...</span>}
        </div>

        <p
          style={{
            marginTop: 16,
            color: "#666",
            fontFamily: "Poppins",
            fontSize: 13,
            margin: "16px 0 0",
          }}
        >
          Formats: JPG, PNG, WebP | Max size: 3 MB | Max images: 30
        </p>
      </div>

      {/* Gallery Grid */}
      <div className="card">
        <h2
          style={{
            marginTop: 0,
            fontFamily: "Fredoka",
            fontSize: 20,
            marginBottom: 16,
          }}
        >
          Gallery Images ({images.length})
        </h2>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#999" }}>Loading...</div>
        ) : images.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: "#999",
              fontFamily: "Poppins",
            }}
          >
            No images yet. Upload your first gallery image above.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 16,
            }}
          >
            {images.map((image) => (
              <div
                key={image.id}
                style={{
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "#f5f5f5",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "1/1",
                    overflow: "hidden",
                    background: "#e0e0e0",
                  }}
                >
                  <img
                    src={image.url}
                    alt={image.title || "Gallery image"}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>

                <div
                  style={{
                    padding: 12,
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {image.title && (
                    <h4
                      style={{
                        margin: 0,
                        fontFamily: "Poppins",
                        fontSize: 14,
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      {image.title}
                    </h4>
                  )}
                  {image.caption && (
                    <p
                      style={{
                        margin: 0,
                        fontFamily: "Poppins",
                        fontSize: 12,
                        color: "#666",
                        marginBottom: 8,
                      }}
                    >
                      {image.caption}
                    </p>
                  )}

                  <p
                    style={{
                      margin: "auto 0 8px 0",
                      fontFamily: "Poppins",
                      fontSize: 11,
                      color: "#999",
                    }}
                  >
                    {new Date(image.created_at).toLocaleDateString()}
                  </p>

                  <button
                    type="button"
                    onClick={() => handleDelete(image.id)}
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
      </div>
    </motion.div>
  );
}
