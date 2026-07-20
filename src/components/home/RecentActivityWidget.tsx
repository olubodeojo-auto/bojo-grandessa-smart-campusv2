import Card from "../ui/Card";
import SectionTitle from "../ui/SectionTitle";
import {
  UserPlus,
  ClipboardCheck,
  FileSpreadsheet,
  Bell,
} from "lucide-react";

const activities = [
  {
    icon: <UserPlus size={20} color="#2E7D32" />,
    title: "New student admitted",
    time: "10 minutes ago",
  },
  {
    icon: <ClipboardCheck size={20} color="#2E7D32" />,
    title: "Attendance submitted",
    time: "35 minutes ago",
  },
  {
    icon: <FileSpreadsheet size={20} color="#2E7D32" />,
    title: "Results uploaded",
    time: "1 hour ago",
  },
  {
    icon: <Bell size={20} color="#2E7D32" />,
    title: "Announcement published",
    time: "Today",
  },
];

export default function RecentActivityWidget() {
  return (
    <Card>
      <SectionTitle title="Recent Activity" />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {activities.map((item) => (
          <div
            key={item.title}
            style={{
              display: "flex",
              gap: "16px",
              alignItems: "center",
              padding: "14px",
              borderRadius: "14px",
              background: "#F8FBF7",
              border: "1px solid #E8EFE8",
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "12px",
                background: "#EAF8EA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {item.icon}
            </div>

            <div>
              <div
                style={{
                  fontWeight: 700,
                  color: "#243424",
                }}
              >
                {item.title}
              </div>

              <div
                style={{
                  fontSize: "13px",
                  color: "#667085",
                }}
              >
                {item.time}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}