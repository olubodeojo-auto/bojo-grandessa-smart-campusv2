export type PreviewModuleKey =
  | "students"
  | "teachers"
  | "classes"
  | "attendance"
  | "results"
  | "parents"
  | "finance"
  | "reports"
  | "website-content-manager"
  | "users-roles";

export type PreviewStat = {
  label: string;
  value: string;
  note?: string;
};

export type PreviewCardItem = {
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: string;
  lines?: string[];
};

export type PreviewTableSection = {
  type: "table";
  title: string;
  description?: string;
  columns: string[];
  rows: string[][];
};

export type PreviewCardsSection = {
  type: "cards";
  title: string;
  description?: string;
  columns?: 2 | 3 | 4;
  items: PreviewCardItem[];
};

export type PreviewChartSection = {
  type: "chart";
  title: string;
  description?: string;
  series: Array<{ label: string; value: number; hint?: string }>;
};

export type PreviewMatrixSection = {
  type: "matrix";
  title: string;
  description?: string;
  columns: string[];
  rows: Array<{ label: string; values: string[] }>;
};

export type PreviewSection =
  | PreviewTableSection
  | PreviewCardsSection
  | PreviewChartSection
  | PreviewMatrixSection;

export type PreviewModuleConfig = {
  key: PreviewModuleKey;
  label: string;
  path: string;
  description: string;
  searchPlaceholder?: string;
  capabilities: string[];
  stats: PreviewStat[];
  sections: PreviewSection[];
};

export const previewNavigation = [
  { key: "dashboard", label: "Dashboard", path: "/administrator-preview", searchPlaceholder: "Search announcements, tasks or events" },
  { key: "students", label: "Students", path: "/administrator-preview/students", searchPlaceholder: "Search student name, admission number or class" },
  { key: "teachers", label: "Teachers", path: "/administrator-preview/teachers", searchPlaceholder: "Search staff name, subject or status" },
  { key: "classes", label: "Classes", path: "/administrator-preview/classes", searchPlaceholder: "Search class, section or class teacher" },
  { key: "attendance", label: "Attendance", path: "/administrator-preview/attendance", searchPlaceholder: "Search attendance date, class or trend" },
  { key: "results", label: "Results", path: "/administrator-preview/results", searchPlaceholder: "Search student, subject or term" },
  { key: "parents", label: "Parents", path: "/administrator-preview/parents", searchPlaceholder: "Search parent, learner or contact" },
  { key: "finance", label: "Finance", path: "/administrator-preview/finance", searchPlaceholder: "Search fee item, invoice or payment" },
  { key: "reports", label: "Reports", path: "/administrator-preview/reports", searchPlaceholder: "Search report type or export" },
  { key: "website-content-manager", label: "Website Content Manager", path: "/administrator-preview/website-content-manager", searchPlaceholder: "Search page, section or media asset" },
  { key: "users-roles", label: "Users & Roles", path: "/administrator-preview/users-roles", searchPlaceholder: "Search user, role or permission" },
] as const;

export const dashboardStats: PreviewStat[] = [
  { label: "Students", value: "248", note: "+12 this term" },
  { label: "Teachers", value: "28", note: "3 departments" },
  { label: "Classes", value: "12", note: "Creche to JSS" },
  { label: "Attendance", value: "96%", note: "Today" },
];

export const dashboardCapabilities = [
  "Monitor school performance at a glance",
  "Track attendance, announcements and upcoming events",
  "Access quick links to key administrative modules",
  "Review operational trends before making decisions",
  "Coordinate staff, students and academic planning",
];

export const dashboardAttendanceTrend = [
  { label: "Mon", value: 94, hint: "Present" },
  { label: "Tue", value: 96, hint: "Present" },
  { label: "Wed", value: 95, hint: "Present" },
  { label: "Thu", value: 97, hint: "Present" },
  { label: "Fri", value: 96, hint: "Present" },
];

export const dashboardQuickActions = [
  "Review new admissions",
  "Check fees outstanding",
  "Prepare weekly report summary",
  "Open Website Content Manager",
];

export const dashboardAnnouncements = [
  {
    title: "Mid-term assessment week",
    subtitle: "Academics",
    meta: "Starts next Monday",
    lines: ["Teachers can now review the assessment timetable preview."] ,
  },
  {
    title: "Parent engagement meeting",
    subtitle: "Community",
    meta: "Friday, 2:00 PM",
    lines: ["Prepare attendance lists and visitor welcome materials."],
  },
  {
    title: "Website content review",
    subtitle: "Communications",
    meta: "Awaiting approval",
    lines: ["Admissions, FAQ and leadership content are ready for leadership review."],
  },
];

export const dashboardActivities = [
  ["08:15", "Admissions Office", "New enquiry recorded for Primary 3 entry"],
  ["09:05", "Finance Desk", "Outstanding fee reminders prepared for review"],
  ["10:20", "Class Teachers", "Attendance summary compiled for all 12 classes"],
  ["11:40", "Results Unit", "Third term report preview generated for JSS 1"],
  ["12:10", "Website Manager", "Homepage image rotation preview refreshed"],
];

export const dashboardEvents = [
  { title: "Open Day Tour", subtitle: "Admissions", meta: "Tuesday, 10:00 AM" },
  { title: "Staff Briefing", subtitle: "Operations", meta: "Wednesday, 8:15 AM" },
  { title: "Creative Arts Showcase", subtitle: "Student Life", meta: "Thursday, 1:00 PM" },
  { title: "Parents Forum", subtitle: "Community", meta: "Friday, 2:30 PM" },
];

export const dashboardCalendar = [
  ["First Term", "2 Sept 2026", "13 Dec 2026"],
  ["Second Term", "8 Jan 2027", "28 Mar 2027"],
  ["Third Term", "26 Apr 2027", "30 Jul 2027"],
];

export const previewModules: Record<PreviewModuleKey, PreviewModuleConfig> = {
  students: {
    key: "students",
    label: "Students",
    path: "/administrator-preview/students",
    description: "Manage student records from admission through graduation.",
    searchPlaceholder: "Search student name, admission number or class",
    capabilities: [
      "Register new students",
      "Assign classes and learning levels",
      "Search and review student profiles",
      "Track status, attendance and parent links",
      "Archive alumni or withdrawn learners",
    ],
    stats: [
      { label: "Total Students", value: "248" },
      { label: "New Admissions", value: "24" },
      { label: "Transfer Requests", value: "7" },
      { label: "Graduating Cohort", value: "31" },
    ],
    sections: [
      {
        type: "table",
        title: "Student Directory",
        description: "A preview of how administrators will browse and filter student records.",
        columns: ["Admission No.", "Student", "Class", "Parent", "Status"],
        rows: [
          ["GRD-1024", "Ayanfe Johnson", "Primary 5", "Mrs Johnson", "Active"],
          ["GRD-1038", "David Aluko", "JSS 1", "Mr Aluko", "Active"],
          ["GRD-1051", "Mercy Bello", "Primary 2", "Mrs Bello", "New"],
          ["GRD-1063", "Samuel Aina", "Nursery 3", "Mrs Aina", "Pending Review"],
        ],
      },
      {
        type: "cards",
        title: "Profile Preview",
        description: "Administrators will quickly inspect a learner's class, attendance and support notes.",
        columns: 3,
        items: [
          { title: "Ayanfe Johnson", subtitle: "Primary 5", meta: "Attendance 98%", badge: "Excellent" },
          { title: "Mercy Bello", subtitle: "Primary 2", meta: "Reading Club", badge: "Needs Form" },
          { title: "Samuel Aina", subtitle: "Nursery 3", meta: "Pending Assessment", badge: "Admission" },
        ],
      },
    ],
  },
  teachers: {
    key: "teachers",
    label: "Teachers",
    path: "/administrator-preview/teachers",
    description: "Coordinate teacher profiles, assignments and academic responsibilities.",
    searchPlaceholder: "Search staff name, subject or status",
    capabilities: [
      "Maintain teacher records",
      "Assign subjects and class responsibilities",
      "Review performance and workload distribution",
      "Monitor employment status and departments",
      "Plan staffing requirements ahead of each term",
    ],
    stats: [
      { label: "Teachers", value: "28" },
      { label: "Departments", value: "6" },
      { label: "Class Teachers", value: "12" },
      { label: "Vacancies", value: "2" },
    ],
    sections: [
      {
        type: "cards",
        title: "Teaching Team",
        description: "A card-based view of staff roles, strengths and current assignments.",
        columns: 3,
        items: [
          { title: "Mrs Adejoke Yusuf", subtitle: "Head of Primary", meta: "English • Civic Education", badge: "Full Time" },
          { title: "Mr Daniel Ogunleye", subtitle: "STEM Coordinator", meta: "Basic Science • ICT", badge: "Lead" },
          { title: "Mrs Funmi Lawal", subtitle: "Nursery Lead", meta: "Early Years • Phonics", badge: "Full Time" },
        ],
      },
      {
        type: "table",
        title: "Subject Allocation",
        columns: ["Teacher", "Department", "Subjects", "Classes", "Status"],
        rows: [
          ["Mrs Yusuf", "Primary", "English, Verbal", "P4, P5", "Balanced"],
          ["Mr Ogunleye", "STEM", "ICT, Basic Science", "P6, JSS1", "Full Load"],
          ["Mrs Lawal", "Early Years", "Phonics, Numeracy", "Nursery 2, Nursery 3", "Balanced"],
          ["Mr Akinola", "Sports", "Physical Education", "All Primary", "Support"],
        ],
      },
    ],
  },
  classes: {
    key: "classes",
    label: "Classes",
    path: "/administrator-preview/classes",
    description: "Oversee classes, sections, teacher assignments and timetable readiness.",
    searchPlaceholder: "Search class, section or class teacher",
    capabilities: [
      "Create and structure classes by level",
      "Assign class teachers and sections",
      "Preview timetable and lesson coverage",
      "Monitor class sizes and space planning",
      "Review class-level academic performance",
    ],
    stats: [
      { label: "Classes", value: "12" },
      { label: "Average Class Size", value: "21" },
      { label: "Sections", value: "16" },
      { label: "Timetables Ready", value: "100%" },
    ],
    sections: [
      {
        type: "cards",
        title: "Class Summary",
        columns: 4,
        items: [
          { title: "Nursery 3", subtitle: "24 learners", meta: "Mrs Lawal", badge: "Early Years" },
          { title: "Primary 2", subtitle: "22 learners", meta: "Mrs Ojo", badge: "Core" },
          { title: "Primary 5", subtitle: "20 learners", meta: "Mrs Yusuf", badge: "Core" },
          { title: "JSS 1", subtitle: "31 learners", meta: "Mr Ogunleye", badge: "Junior" },
        ],
      },
      {
        type: "table",
        title: "Timetable Preview",
        columns: ["Class", "First Period", "Mid Morning", "After Break", "Last Period"],
        rows: [
          ["Nursery 3", "Phonics", "Numeracy", "Creative Play", "Story Time"],
          ["Primary 2", "English", "Mathematics", "Basic Science", "Reading Club"],
          ["Primary 5", "Mathematics", "Verbal", "ICT", "Civic Education"],
          ["JSS 1", "English", "Basic Science", "ICT", "Leadership"],
        ],
      },
    ],
  },
  attendance: {
    key: "attendance",
    label: "Attendance",
    path: "/administrator-preview/attendance",
    description: "Track daily presence, identify trends and intervene early when attendance drops.",
    searchPlaceholder: "Search attendance date, class or trend",
    capabilities: [
      "Record daily attendance by class",
      "Review weekly and monthly trends",
      "Identify chronic absenteeism early",
      "Notify parents when follow-up is required",
      "Support pastoral care and safeguarding decisions",
    ],
    stats: [
      { label: "Today", value: "96%" },
      { label: "Weekly Average", value: "95%" },
      { label: "Monthly Average", value: "94%" },
      { label: "Follow-ups", value: "8" },
    ],
    sections: [
      {
        type: "chart",
        title: "Weekly Trend",
        description: "Attendance stays strong across the week with room for targeted follow-up.",
        series: [
          { label: "Mon", value: 94 },
          { label: "Tue", value: 95 },
          { label: "Wed", value: 96 },
          { label: "Thu", value: 97 },
          { label: "Fri", value: 96 },
        ],
      },
      {
        type: "table",
        title: "Daily Summary",
        columns: ["Class", "Present", "Absent", "Late", "Status"],
        rows: [
          ["Nursery", "58", "2", "1", "Stable"],
          ["Primary Lower", "76", "4", "3", "Monitor"],
          ["Primary Upper", "69", "2", "2", "Strong"],
          ["Junior Secondary", "39", "1", "1", "Strong"],
        ],
      },
    ],
  },
  results: {
    key: "results",
    label: "Results",
    path: "/administrator-preview/results",
    description: "Monitor assessment performance, term summaries and report card readiness.",
    searchPlaceholder: "Search student, subject or term",
    capabilities: [
      "Review subject-level performance summaries",
      "Prepare report cards and academic reports",
      "Track term averages and grading trends",
      "Monitor approval and publication stages",
      "Support intervention planning for learners",
    ],
    stats: [
      { label: "Average Score", value: "71%" },
      { label: "Top Distinctions", value: "42" },
      { label: "Report Drafts", value: "18" },
      { label: "Improvement Cases", value: "11" },
    ],
    sections: [
      {
        type: "chart",
        title: "Performance Overview",
        description: "A quick view of class performance distribution this term.",
        series: [
          { label: "English", value: 78 },
          { label: "Maths", value: 73 },
          { label: "Science", value: 76 },
          { label: "ICT", value: 81 },
          { label: "Civic", value: 69 },
        ],
      },
      {
        type: "table",
        title: "Report Card Preview",
        columns: ["Student", "Class", "Term", "Average", "Status"],
        rows: [
          ["Ayanfe Johnson", "Primary 5", "Third", "82%", "Ready"],
          ["David Aluko", "JSS 1", "Third", "74%", "Teacher Review"],
          ["Mercy Bello", "Primary 2", "Third", "79%", "Ready"],
          ["Samuel Aina", "Nursery 3", "Third", "N/A", "Pending Entry"],
        ],
      },
    ],
  },
  parents: {
    key: "parents",
    label: "Parents",
    path: "/administrator-preview/parents",
    description: "Maintain family contacts, linked learners and communication readiness.",
    searchPlaceholder: "Search parent, learner or contact",
    capabilities: [
      "Maintain parent and guardian records",
      "Link siblings and shared contacts",
      "Review communication preferences",
      "Support attendance, finance and welfare follow-up",
      "Strengthen parent-school partnership touchpoints",
    ],
    stats: [
      { label: "Parent Accounts", value: "186" },
      { label: "Linked Siblings", value: "39" },
      { label: "Primary Contacts", value: "248" },
      { label: "Follow-up Cases", value: "14" },
    ],
    sections: [
      {
        type: "table",
        title: "Parent Directory",
        columns: ["Parent", "Linked Students", "Phone", "Preferred Contact", "Status"],
        rows: [
          ["Mrs Johnson", "2", "0818 673 9390", "WhatsApp", "Active"],
          ["Mr Aluko", "1", "0913 929 0283", "Phone", "Active"],
          ["Mrs Bello", "1", "0803 555 1421", "Email", "Pending Update"],
          ["Mr & Mrs Aina", "2", "0808 321 7002", "Phone", "Active"],
        ],
      },
      {
        type: "cards",
        title: "Family Summary",
        columns: 2,
        items: [
          { title: "Johnson Family", subtitle: "Primary 3 • Primary 5", meta: "Fees up to date", badge: "Stable" },
          { title: "Aina Family", subtitle: "Nursery 1 • Nursery 3", meta: "Admission review pending", badge: "Attention" },
        ],
      },
    ],
  },
  finance: {
    key: "finance",
    label: "Finance",
    path: "/administrator-preview/finance",
    description: "Track revenue, outstanding fees and payment visibility across the school.",
    searchPlaceholder: "Search fee item, invoice or payment",
    capabilities: [
      "Monitor school fee collection progress",
      "Review outstanding balances by class",
      "Prepare payment history and revenue summaries",
      "Support finance communication with parents",
      "Plan billing visibility before implementation",
    ],
    stats: [
      { label: "Fees Collected", value: "₦4.2M" },
      { label: "Outstanding", value: "₦860K" },
      { label: "Invoices", value: "248" },
      { label: "Payment Plans", value: "16" },
    ],
    sections: [
      {
        type: "chart",
        title: "Revenue Trend",
        description: "Preview of how administrators will monitor monthly collections.",
        series: [
          { label: "Jan", value: 62 },
          { label: "Feb", value: 74 },
          { label: "Mar", value: 88 },
          { label: "Apr", value: 81 },
          { label: "May", value: 69 },
        ],
      },
      {
        type: "table",
        title: "Outstanding Fees",
        columns: ["Family", "Learner", "Class", "Balance", "Status"],
        rows: [
          ["Bello", "Mercy Bello", "Primary 2", "₦65,000", "Reminder Due"],
          ["Aina", "Samuel Aina", "Nursery 3", "₦48,000", "Installment"],
          ["Owolabi", "Tolu Owolabi", "Primary 6", "₦37,500", "Pending"],
          ["James", "Ada James", "JSS 1", "₦22,000", "Follow-up"],
        ],
      },
    ],
  },
  reports: {
    key: "reports",
    label: "Reports",
    path: "/administrator-preview/reports",
    description: "Organise export-ready school reports for leadership, academics and operations.",
    searchPlaceholder: "Search report type or export",
    capabilities: [
      "Generate student, finance and attendance reports",
      "Prepare leadership summaries for review",
      "Export operational data into printable formats",
      "Track report readiness before term deadlines",
      "Support data-informed management meetings",
    ],
    stats: [
      { label: "Report Types", value: "12" },
      { label: "Exports Ready", value: "9" },
      { label: "Scheduled Summaries", value: "5" },
      { label: "Leadership Packs", value: "3" },
    ],
    sections: [
      {
        type: "cards",
        title: "Report Categories",
        columns: 3,
        items: [
          { title: "Academic Reports", subtitle: "Results, report cards, class analysis", badge: "Preview" },
          { title: "Operational Reports", subtitle: "Attendance, admissions, staffing", badge: "Preview" },
          { title: "Finance Reports", subtitle: "Revenue, debtors, receipts", badge: "Preview" },
        ],
      },
      {
        type: "table",
        title: "Export Queue",
        columns: ["Report", "Audience", "Format", "Prepared By", "Status"],
        rows: [
          ["Weekly Operations Summary", "Leadership", "PDF", "Administrator", "Ready"],
          ["Termly Results Overview", "Academics", "PDF", "Results Office", "Draft"],
          ["Fee Collection Snapshot", "Finance", "Spreadsheet", "Bursar", "Ready"],
          ["Attendance Follow-up List", "Welfare", "Spreadsheet", "Admin Desk", "Queued"],
        ],
      },
    ],
  },
  "website-content-manager": {
    key: "website-content-manager",
    label: "Website Content Manager",
    path: "/administrator-preview/website-content-manager",
    description: "Preview how the school will manage website pages, media and downloads internally.",
    searchPlaceholder: "Search page, section or media asset",
    capabilities: [
      "Edit homepage and key public website pages",
      "Manage FAQ, leadership and admissions content",
      "Organise downloads and media assets",
      "Review page status before publishing",
      "Coordinate website updates without technical support",
    ],
    stats: [
      { label: "Managed Pages", value: "9" },
      { label: "Media Assets", value: "84" },
      { label: "Downloads", value: "12" },
      { label: "Pending Reviews", value: "4" },
    ],
    sections: [
      {
        type: "cards",
        title: "Content Sections",
        columns: 3,
        items: [
          { title: "Homepage", subtitle: "Hero, highlights, gallery", badge: "Ready" },
          { title: "About", subtitle: "Story, leadership, values", badge: "Ready" },
          { title: "Admissions", subtitle: "Journey, requirements, CTA", badge: "Ready" },
          { title: "FAQ", subtitle: "Parent information centre", badge: "Review" },
          { title: "Leadership", subtitle: "Proprietress and teacher profiles", badge: "Planned" },
          { title: "Media Library", subtitle: "Photos, downloads, files", badge: "Preview" },
        ],
      },
      {
        type: "table",
        title: "Media Library Preview",
        columns: ["Asset", "Category", "Usage", "Status", "Updated"],
        rows: [
          ["hero-homepage-grandessa-school.jpg", "Homepage", "Hero Banner", "Approved", "22 Jul 2026"],
          ["teacher-guiding-student.jpg", "About", "Learning Story", "Approved", "22 Jul 2026"],
          ["grandessa-logo-primary.png", "Branding", "Navigation", "Approved", "21 Jul 2026"],
          ["best-student-award.jpg", "Achievements", "Results Preview", "Approved", "22 Jul 2026"],
        ],
      },
    ],
  },
  "users-roles": {
    key: "users-roles",
    label: "Users & Roles",
    path: "/administrator-preview/users-roles",
    description: "Preview user access, role structure and permission visibility across the platform.",
    searchPlaceholder: "Search user, role or permission",
    capabilities: [
      "Create administrator, teacher and finance accounts",
      "Assign access based on responsibilities",
      "Review permission coverage by module",
      "Support accountability and approval workflows",
      "Protect sensitive school data with role-based access",
    ],
    stats: [
      { label: "User Accounts", value: "18" },
      { label: "Roles", value: "6" },
      { label: "Permission Sets", value: "24" },
      { label: "Pending Invites", value: "3" },
    ],
    sections: [
      {
        type: "cards",
        title: "Role Cards",
        columns: 3,
        items: [
          { title: "Administrator", subtitle: "Full school oversight", meta: "11 modules" },
          { title: "Teacher", subtitle: "Academic delivery and assessment", meta: "5 modules" },
          { title: "Finance Officer", subtitle: "Billing and payment monitoring", meta: "2 modules" },
        ],
      },
      {
        type: "matrix",
        title: "Permission Matrix",
        columns: ["Dashboard", "Students", "Results", "Finance", "Website"],
        rows: [
          { label: "Administrator", values: ["Full", "Full", "Full", "Full", "Full"] },
          { label: "Teacher", values: ["View", "View", "Manage", "None", "None"] },
          { label: "Finance Officer", values: ["View", "View", "None", "Manage", "None"] },
          { label: "Content Manager", values: ["View", "None", "None", "None", "Manage"] },
        ],
      },
    ],
  },
};