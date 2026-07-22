import supabase from "../lib/supabase";
import type { Student } from "../types/student";

function clean(value: string): string {
  return value.trim().replace(/[\\%_]/g, "");
}

export async function getParentChildren(params: {
  fullName?: string;
  phone?: string;
}): Promise<Student[]> {
  const fullName = clean(params.fullName ?? "");
  const phone = clean(params.phone ?? "");

  let query = supabase.from("students").select("*").order("first_name", { ascending: true });

  if (phone && fullName) {
    query = query.or(`parent_phone.eq.${phone},parent_name.ilike.%${fullName}%`);
  } else if (phone) {
    query = query.eq("parent_phone", phone);
  } else if (fullName) {
    query = query.ilike("parent_name", `%${fullName}%`);
  } else {
    return [];
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as Student[];
}
