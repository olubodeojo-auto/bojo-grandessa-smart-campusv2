export interface Announcement {
  id: string;
  title: string;
  message: string;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export type AnnouncementAudience = "All" | "Teachers" | "Students" | "Contacts";

export type AnnouncementCreatePayload = {
  title: string;
  message: string;
  published?: boolean;
  audience?: AnnouncementAudience;
};

export type AnnouncementUpdatePayload = Partial<AnnouncementCreatePayload>;
