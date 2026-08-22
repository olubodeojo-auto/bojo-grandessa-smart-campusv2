export interface Announcement {
  id: string;
  title: string;
  message: string;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export type AnnouncementCreatePayload = {
  title: string;
  message: string;
  published?: boolean;
};

export type AnnouncementUpdatePayload = Partial<AnnouncementCreatePayload>;
