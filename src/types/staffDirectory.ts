export type StaffDirectoryEntry = {
  id: string;
  fullName: string;
  position: string;
  bio?: string;
  imageUrl?: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type StaffDirectoryInput = {
  fullName: string;
  position: string;
  bio?: string;
  imageUrl?: string;
};
