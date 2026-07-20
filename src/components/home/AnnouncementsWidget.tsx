import Card from "../ui/Card";
import SectionTitle from "../ui/SectionTitle";

const announcements = [
  {
    title: "PTA Meeting",
    date: "Monday • 9:00 AM",
  },
  {
    title: "Mid-Term Exams",
    date: "Starts Next Week",
  },
  {
    title: "Inter-House Sports",
    date: "Friday • 10:00 AM",
  },
];

export default function AnnouncementsWidget() {
  return (
    <Card>
      <SectionTitle title="Announcements" />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {announcements.map((item) => (
          <div
            key={item.title}
            style={{
              padding: "16px",
              borderRadius: "14px",
              border: "1px solid #E8EFE8",
              background: "#F8FBF7",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: "#243424",
                marginBottom: "4px",
              }}
            >
              {item.title}
            </div>

            <div
              style={{
                color: "#667085",
                fontSize: "14px",
              }}
            >
              {item.date}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}