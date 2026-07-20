export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
  totalClasses: number;

  presentToday: number;
  absentToday: number;

  totalSubjects: number;

  activeAnnouncements: number;

  pendingAdmissions: number;

  attendancePercentage: number;
}

export interface RecentActivity {
  id: string;

  title: string;

  description?: string;

  category:
    | "Student"
    | "Teacher"
    | "Attendance"
    | "Result"
    | "Admission"
    | "Announcement"
    | "System";

  created_at: string;
}

export interface DashboardData {
  stats: DashboardStats;

  recentActivities: RecentActivity[];
}