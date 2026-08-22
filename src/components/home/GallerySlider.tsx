import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { getGalleryImages } from "../../services/galleryService";
import type { GalleryImage } from "../../types/gallery";

export default function GallerySlider() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    async function loadImages() {
      try {
        const data = await getGalleryImages();
        // Show only the first 6 most recent images
        setImages(data.slice(0, 6));
      } catch (error) {
        console.error("Failed to load gallery:", error);
      } finally {
        setLoading(false);
      }
    }

    void loadImages();
  }, []);

  if (loading || images.length === 0) {
    return null;
  }

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  // Show 3 images at a time on desktop, 1 on mobile
  const visibleCount = window.innerWidth < 768 ? 1 : 3;
  const visibleImages = [];

  for (let i = 0; i < visibleCount; i += 1) {
    visibleImages.push(images[(currentIndex + i) % images.length]);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      <div
        style={{
          marginTop: 40,
          marginBottom: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: "Fredoka",
              fontSize: "clamp(20px, 5vw, 28px)",
              color: "#1a3a2e",
            }}
          >
            Gallery Highlights
          </h2>

          <a
            href="/gallery"
            style={{
              fontFamily: "Poppins",
              fontSize: 14,
              fontWeight: 600,
              color: "#2E7D32",
              textDecoration: "none",
            }}
          >
            View All Gallery →
          </a>
        </div>

        {/* Slider */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${visibleCount}, 1fr)`,
            gap: 16,
            marginBottom: 16,
          }}
        >
          {visibleImages.map((image, index) => (
            <motion.div
              key={`${image.id}-${index}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              style={{
                borderRadius: 12,
                overflow: "hidden",
                background: "#f5f5f5",
                aspectRatio: "1/1",
                cursor: "pointer",
              }}
              onClick={() => {
                window.location.href = "/gallery";
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
            </motion.div>
          ))}
        </div>

        {/* Navigation */}
        {images.length > visibleCount && (
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={handlePrevious}
              style={{
                background: "#f0f0f0",
                border: "none",
                borderRadius: 8,
                padding: "10px 12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Previous images"
            >
              <ChevronLeft size={20} />
            </button>

            <div
              style={{
                display: "flex",
                gap: 8,
              }}
            >
              {images.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    border: "none",
                    background:
                      index === currentIndex ? "#2E7D32" : "#ddd",
                    cursor: "pointer",
                    padding: 0,
                  }}
                  aria-label={`Go to image ${index + 1}`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={handleNext}
              style={{
                background: "#f0f0f0",
                border: "none",
                borderRadius: 8,
                padding: "10px 12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Next images"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
