import type { ReactNode } from "react";
import { motion } from "framer-motion";
import grandessaIdentity from "../../config/grandessaIdentity";

type AppLayoutProps = {
  children: ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #EAF8EA 0%, #F8FBF7 40%, #FFFFFF 100%)",
        position: "relative",
        overflow: "hidden",
        padding: "40px 20px",
      }}
    >
      {/* Background Circle */}
      <div
        style={{
          position: "absolute",
          width: 260,
          height: 260,
          borderRadius: "50%",
          background: "rgba(108,194,74,0.12)",
          top: -100,
          right: -80,
        }}
      />

      {/* Background Circle */}
      <div
        style={{
          position: "absolute",
          width: 180,
          height: 180,
          borderRadius: "50%",
          background: "rgba(212,175,55,0.10)",
          bottom: -60,
          left: -50,
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: "1100px",
          margin: "0 auto",
        }}
      >
        {children}
      </motion.div>
    </main>
  );
}