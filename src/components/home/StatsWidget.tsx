import { useEffect, useState } from "react";
import {
  Users,
  GraduationCap,
  School,
  ClipboardCheck,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import Card from "../ui/Card";

interface StatItem {
  title: string;
  value: string;
  icon: JSX.Element;
}

interface StatsState {
  students: string;
  teachers: string;
  classes: string;
  attendance: string;
  loading: boolean;
}

function formatCount(value: number | null): string {
  if (value === null) {
    return "--";
  }

  return value.toString();
}

function formatAttendance(value: number | null): string {
  if (value === null) {
    return "--";
  }

  return `${Math.round(value)}%`;
}

function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const parsed = new Date(trimmed);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function isToday(value: unknown): boolean {
  const parsed = parseDateValue(value);

  if (!parsed) {
    return false;
  }

  const today = new Date();
  return (
    parsed.getFullYear() === today.getFullYear() &&
    parsed.getMonth() === today.getMonth() &&
    parsed.getDate() === today.getDate()
  );
}

function isPresentValue(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value > 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return [
      "present",
      "attended",
      "checked_in",
      "checked-in",
      "in",
      "yes",
      "true",
      "p",
    ].includes(normalized);
  }

  return false;
}

async function fetchAttendancePercentage(): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from("attendance")
      .select("status, attendance_status, present, created_at, date, attendance_date");

    if (error) {
      return null;
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;

    const todayRows = rows.filter((row) => {
      const dateFields = ["created_at", "date", "attendance_date"];
      return dateFields.some((field) => isToday(row[field]));
    });

    if (todayRows.length === 0) {
      return null;
    }

    const presentCount = todayRows.filter((row) => {
      const statusFields = ["status", "attendance_status", "present", "state"];
      return statusFields.some((field) => isPresentValue(row[field]));
    }).length;

    return (presentCount / todayRows.length) * 100;
  } catch {
    return null;
  }
}

export default function StatsWidget() {
  const [stats, setStats] = useState<StatsState>({
    students: "",
    teachers: "",
    classes: "",
    attendance: "",
    loading: true,
  });

  useEffect(() => {
    let isMounted = true;

    const loadStats = async (): Promise<void> => {
      try {
        const [studentsResult, teachersResult, classesResult, attendanceResult] =
          await Promise.all([
            supabase
              .from("students")
              .select("*", { count: "exact", head: true })
              .then(({ count, error }) => ({ count: count ?? null, error }))
              .catch((error: Error) => ({ count: null, error })),
            supabase
              .from("teachers")
              .select("*", { count: "exact", head: true })
              .then(({ count, error }) => ({ count: count ?? null, error }))
              .catch((error: Error) => ({ count: null, error })),
            supabase
              .from("classes")
              .select("*", { count: "exact", head: true })
              .then(({ count, error }) => ({ count: count ?? null, error }))
              .catch((error: Error) => ({ count: null, error })),
            fetchAttendancePercentage(),
          ]);

        if (!isMounted) {
          return;
        }

        const nextStats: StatsState = {
          students: formatCount(studentsResult.error ? null : studentsResult.count),
          teachers: formatCount(teachersResult.error ? null : teachersResult.count),
          classes: formatCount(classesResult.error ? null : classesResult.count),
          attendance: formatAttendance(attendanceResult),
          loading: false,
        };

        setStats(nextStats);
      } catch {
        if (!isMounted) {
          return;
        }

        setStats({
          students: "--",
          teachers: "--",
          classes: "--",
          attendance: "--",
          loading: false,
        });
      }
    };

    void loadStats();

    return () => {
      isMounted = false;
    };
  }, []);

  const statItems: StatItem[] = [
    {
      title: "Students",
      value: stats.loading ? "" : stats.students,
      icon: <Users size={34} color="#2E7D32" />,
    },
    {
      title: "Teachers",
      value: stats.loading ? "" : stats.teachers,
      icon: <GraduationCap size={34} color="#2E7D32" />,
    },
    {
      title: "Classes",
      value: stats.loading ? "" : stats.classes,
      icon: <School size={34} color="#2E7D32" />,
    },
    {
      title: "Attendance",
      value: stats.loading ? "" : stats.attendance,
      icon: <ClipboardCheck size={34} color="#2E7D32" />,
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "20px",
        marginBottom: "28px",
      }}
    >
      {statItems.map((item) => (
        <Card key={item.title}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "18px",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "18px",
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
                  fontSize: stats.loading ? "24px" : "34px",
                  fontWeight: 700,
                  color: "#243424",
                  lineHeight: 1,
                }}
              >
                {stats.loading ? (
                  <div
                    style={{
                      width: stats.loading ? 72 : 0,
                      height: 20,
                      borderRadius: 999,
                      background: "linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%)",
                      animation: "pulse 1.2s ease-in-out infinite",
                    }}
                  />
                ) : (
                  item.value
                )}
              </div>

              <div
                style={{
                  marginTop: "6px",
                  color: "#667085",
                  fontWeight: 600,
                }}
              >
                {item.title}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}