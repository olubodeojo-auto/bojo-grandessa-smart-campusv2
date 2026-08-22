import {
  Users,
  GraduationCap,
  ClipboardCheck,
  FileSpreadsheet,
  BookOpen,
  Megaphone,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import Card from "../ui/Card";
import Button from "../ui/Button";
import SectionTitle from "../ui/SectionTitle";

const tools = [
  {
    title: "Students",
    path: "/admin/students",
    icon: <Users size={34} color="#2E7D32" />,
  },
  {
    title: "Teachers",
    path: "/admin/teachers",
    icon: <GraduationCap size={34} color="#2E7D32" />,
    disabled: true,
  },
  {
    title: "Attendance",
    path: "/admin/attendance",
    icon: <ClipboardCheck size={34} color="#2E7D32" />,
    disabled: true,
  },
  {
    title: "Results",
    path: "/admin/results",
    icon: <FileSpreadsheet size={34} color="#2E7D32" />,
  },
  {
    title: "Homework",
    path: "/admin/homework",
    icon: <BookOpen size={34} color="#2E7D32" />,
    disabled: true,
  },
  {
    title: "Announcements",
    path: "/admin/announcements",
    icon: <Megaphone size={34} color="#2E7D32" />,
    disabled: false,
  },
];

export default function ToolsWidget() {
  const navigate = useNavigate();

  return (
    <Card>
      <SectionTitle title="Today's Tools" />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "18px",
        }}
      >
        {tools.map((tool) => (
          <Button
            key={tool.title}
            type="button"
            onClick={() => {
              if (!tool.disabled && tool.path) {
                navigate(tool.path);
              }
            }}
            disabled={Boolean(tool.disabled)}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
              }}
            >
              {tool.icon}

              <strong
                style={{
                  fontFamily: "Poppins",
                  fontSize: "16px",
                  color: "#243424",
                }}
              >
                {tool.title}
              </strong>

              <span
                style={{
                  fontSize: "13px",
                  color: "#667085",
                }}
              >
                {tool.disabled ? "Coming Soon" : "Open Module"}
              </span>
            </div>
          </Button>
        ))}
      </div>
    </Card>
  );
}