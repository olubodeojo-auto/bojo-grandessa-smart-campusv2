export interface GalleryImage {
  id: string;
  title?: string;
  caption?: string;
  storage_path: string;
  url: string;
  file_size_bytes?: number;
  file_type?: string;
  created_at: string;
  updated_at: string;
}

export type GalleryCreatePayload = {
  title?: string;
  caption?: string;
  storage_path: string;
  url: string;
  file_size_bytes?: number;
  file_type?: string;
};
