import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";

import { getGalleryImages } from "../services/galleryService";
import type { GalleryImage } from "../types/gallery";
import PublicNavigation from "../components/homepage/PublicNavigation";
import PublicFooter from "../components/homepage/PublicFooter";

export default function Gallery() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    async function loadImages() {
      try {
        const data = await getGalleryImages();
        setImages(data);
      } catch (error) {
        console.error("Failed to load gallery:", error);
      } finally {
        setLoading(false);
      }
    }

    void loadImages();
  }, []);

  const handlePrevious = () => {
    if (selectedIndex === null) return;
    setSelectedIndex((selectedIndex - 1 + images.length) % images.length);
  };

  const handleNext = () => {
    if (selectedIndex === null) return;
    setSelectedIndex((selectedIndex + 1) % images.length);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <PublicNavigation active="gallery" />

      <main style={{ flex: 1, padding: "40px 20px" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ maxWidth: 1200, margin: "0 auto" }}
        >
          {/* Header */}
          <div
            style={{
              textAlign: "center",
              marginBottom: 48,
            }}
          >
            <h1
              style={{
                fontFamily: "Fredoka",
                fontSize: "clamp(28px, 6vw, 48px)",
                margin: "0 0 16px",
                color: "#1a3a2e",
              }}
            >
              Gallery
            </h1>
            <p
              style={{
                fontFamily: "Poppins",
                fontSize: 16,
                color: "#666",
                margin: 0,
              }}
            >
              Explore moments from Grandessa School
            </p>
          </div>

          {/* Loading State */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#999" }}>Loading...</div>
          ) : images.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                color: "#999",
              }}
            >
              <p style={{ fontFamily: "Poppins", fontSize: 16 }}>
                Gallery coming soon. Check back later!
              </p>
            </div>
          ) : (
            <>
              {/* Image Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
                  gap: 16,
                  marginBottom: 40,
                }}
              >
                {images.map((image, index) => (
                  <motion.div
                    key={image.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    onClick={() => setSelectedIndex(index)}
                    style={{
                      cursor: "pointer",
                      borderRadius: 12,
                      overflow: "hidden",
                      background: "#f5f5f5",
                      transition: "transform 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (e.currentTarget instanceof HTMLElement) {
                        e.currentTarget.style.transform = "scale(1.02)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (e.currentTarget instanceof HTMLElement) {
                        e.currentTarget.style.transform = "scale(1)";
                      }
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "1/1",
                        overflow: "hidden",
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

                    {image.title && (
                      <div style={{ padding: 12 }}>
                        <h3
                          style={{
                            margin: 0,
                            fontFamily: "Poppins",
                            fontSize: 14,
                            fontWeight: 600,
                          }}
                        >
                          {image.title}
                        </h3>
                        {image.caption && (
                          <p
                            style={{
                              margin: "4px 0 0",
                              fontFamily: "Poppins",
                              fontSize: 12,
                              color: "#666",
                            }}
                          >
                            {image.caption}
                          </p>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </main>

      {/* Lightbox Modal */}
      {selectedIndex !== null && images[selectedIndex] && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.95)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={() => setSelectedIndex(null)}
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: "rgba(255,255,255,0.2)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Close"
          >
            <X size={24} />
          </button>

          {/* Image */}
          <motion.div
            key={selectedIndex}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              maxWidth: "90vw",
              maxHeight: "90vh",
            }}
          >
            <img
              src={images[selectedIndex].url}
              alt={images[selectedIndex].title || "Gallery image"}
              style={{
                maxWidth: "100%",
                maxHeight: "80vh",
                objectFit: "contain",
                borderRadius: 8,
              }}
            />

            {/* Image Info */}
            {images[selectedIndex].title && (
              <div style={{ textAlign: "center", color: "#fff" }}>
                <h3
                  style={{
                    margin: 0,
                    fontFamily: "Poppins",
                    fontSize: 18,
                    fontWeight: 600,
                  }}
                >
                  {images[selectedIndex].title}
                </h3>
                {images[selectedIndex].caption && (
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontFamily: "Poppins",
                      fontSize: 14,
                      opacity: 0.8,
                    }}
                  >
                    {images[selectedIndex].caption}
                  </p>
                )}
              </div>
            )}

            {/* Navigation */}
            {images.length > 1 && (
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  onClick={handlePrevious}
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  aria-label="Previous image"
                >
                  <ChevronLeft size={24} />
                </button>

                <span
                  style={{
                    color: "#fff",
                    fontFamily: "Poppins",
                    fontSize: 14,
                    minWidth: "60px",
                    textAlign: "center",
                  }}
                >
                  {selectedIndex + 1} / {images.length}
                </span>

                <button
                  type="button"
                  onClick={handleNext}
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  aria-label="Next image"
                >
                  <ChevronRight size={24} />
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}

      <PublicFooter />
    </div>
  );
}
