import { supabase } from "../lib/supabase";

export type ParentAccountStatus = "not_created" | "invited" | "active";

export type LinkedParentStudent = {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_name: string | null;
};

export type ParentAccountDirectoryEntry = {
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    relationship: string | null;
    email: string | null;
    phone: string | null;
  };
  students: LinkedParentStudent[];
  account_status: ParentAccountStatus;
};

type DirectoryResponse = {
  entries?: ParentAccountDirectoryEntry[];
};

export async function getParentAccountDirectory(): Promise<ParentAccountDirectoryEntry[]> {
  const { data, error } = await supabase.functions.invoke<DirectoryResponse>("manage-parent", {
    body: { action: "directory" },
  });

  if (error) throw error;
  return data?.entries ?? [];
}
