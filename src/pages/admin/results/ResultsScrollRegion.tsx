import { useEffect, useRef, useState, type ReactNode } from "react";

type ResultsScrollRegionProps = {
  id?: string;
  label: string;
  children: ReactNode;
  maxHeight?: number | string;
  className?: string;
};

/**
 * Results-module scrolling surface.
 * The horizontal control is kept above the content so users never need to
 * scroll to the bottom of a wide table to reach its horizontal scrollbar.
 * The content area independently supports vertical and horizontal scrolling.
 */
export default function ResultsScrollRegion({
  id,
  label,
  children,
  maxHeight = "min(58vh, 560px)",
  className,
}: ResultsScrollRegionProps) {
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const [contentWidth, setContentWidth] = useState(1050);

  useEffect(() => {
    const container = contentScrollRef.current;
    if (!container) return;

    const measureWidth = () => {
      const width = Math.max(container.scrollWidth, container.clientWidth);
      setContentWidth((current) => current === width ? current : width);
    };

    measureWidth();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measureWidth);
    observer?.observe(container);
    Array.from(container.children).forEach((child) => observer?.observe(child));
    container.querySelectorAll("table").forEach((table) => observer?.observe(table));
    window.addEventListener("resize", measureWidth);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measureWidth);
    };
  }, [children]);

  return (
    <div className={className} style={{ minWidth: 0, width: "100%", maxWidth: "100%" }}>
      <div
        ref={topScrollRef}
        role="region"
        aria-label={`${label} horizontal scrollbar`}
        tabIndex={0}
        onScroll={(event) => {
          const content = contentScrollRef.current;
          if (content && content.scrollLeft !== event.currentTarget.scrollLeft) {
            content.scrollLeft = event.currentTarget.scrollLeft;
          }
        }}
        style={{
          boxSizing: "border-box",
          minWidth: 0,
          width: "100%",
          maxWidth: "100%",
          height: 22,
          marginBottom: 5,
          flex: "0 0 auto",
          overflowX: "auto",
          overflowY: "hidden",
          overscrollBehaviorX: "contain",
          WebkitOverflowScrolling: "touch",
          background: "#f8fafc",
          border: "1px solid #cbd5e1",
          borderRadius: 6,
        }}
      >
        <div aria-hidden="true" style={{ width: contentWidth, height: 1 }} />
      </div>
      <div
        ref={contentScrollRef}
        id={id}
        role="region"
        aria-label={`${label}; scroll vertically and horizontally to access all content`}
        tabIndex={0}
        onScroll={(event) => {
          const top = topScrollRef.current;
          if (top && top.scrollLeft !== event.currentTarget.scrollLeft) {
            top.scrollLeft = event.currentTarget.scrollLeft;
          }
        }}
        style={{
          display: "block",
          boxSizing: "border-box",
          minWidth: 0,
          width: "100%",
          maxWidth: "100%",
          maxHeight,
          overflowX: "auto",
          overflowY: "auto",
          scrollbarGutter: "stable",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
          border: "1px solid #cbd5e1",
          borderRadius: 6,
          background: "#ffffff",
        }}
      >
        {children}
      </div>
    </div>
  );
}
