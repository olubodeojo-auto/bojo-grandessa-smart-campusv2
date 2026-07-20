import {
  Users,
  GraduationCap,
  ClipboardCheck,
  FileSpreadsheet,
  BookOpen,
  Megaphone,
} from "lucide-react";

import Card from "../ui/Card";
import Button from "../ui/Button";
import SectionTitle from "../ui/SectionTitle";

const tools = [
  {
    title: "Students",
    icon: <Users size={34} color="#2E7D32" />,
  },
  {
    title: "Teachers",
    icon: <GraduationCap size={34} color="#2E7D32" />,
  },
  {
    title: "Attendance",
    icon: <ClipboardCheck size={34} color="#2E7D32" />,
  },
  {
    title: "Results",
    icon: <FileSpreadsheet size={34} color="#2E7D32" />,
  },
  {
    title: "Homework",
    icon: <BookOpen size={34} color="#2E7D32" />,
  },
  {
    title: "Announcements",
    icon: <Megaphone size={34} color="#2E7D32" />,
  },
];

export default function ToolsWidget() {
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
          <Button key={tool.title}>
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
                Open Module
              </span>
            </div>
          </Button>
        ))}
      </div>
    </Card>
  );
}