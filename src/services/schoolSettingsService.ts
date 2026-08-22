import { supabase } from "../lib/supabase";
import { defaultAcademicCalendar, type AcademicCalendarConfig } from "../config/grandessaCalendar";
import type { AcademicCalendarRow, SchoolSettings } from "../types/schoolSettings";

const FALLBACK_SCHOOL_ID = "1829b784-8e94-4713-bbaf-2518b5e374be";
const SCHOOL_BRANDING_BUCKET = "school_branding";
const MAX_BRANDING_FILE_SIZE = 3 * 1024 * 1024;
const ALLOWED_BRANDING_TYPES = ["image/jpeg", "image/png", "image/webp"];

function getActiveSchoolId(): string {
  const candidate =
    (typeof window !== "undefined" ? window.localStorage.getItem("activeSchoolId")?.trim() : "") ||
    import.meta.env.VITE_SCHOOL_ID?.toString().trim();

  return candidate || FALLBACK_SCHOOL_ID;
}

function mapCalendarRowToConfig(row: AcademicCalendarRow): AcademicCalendarConfig {
  return {
    academicYear: row.academic_year,
    firstTerm: {
      startDate: row.first_term_start,
      endDate: row.first_term_end,
      termEnding: row.first_term_ending,
      nextTermBegins: row.first_next_term_begins,
    },
    secondTerm: {
      startDate: row.second_term_start,
      endDate: row.second_term_end,
      termEnding: row.second_term_ending,
      nextTermBegins: row.second_next_term_begins,
    },
    thirdTerm: {
      startDate: row.third_term_start,
      endDate: row.third_term_end,
      termEnding: row.third_term_ending,
      nextTermBegins: row.third_next_term_begins,
    },
  };
}

function mapConfigToCalendarRow(config: AcademicCalendarConfig): AcademicCalendarRow {
  return {
    school_id: getActiveSchoolId(),
    academic_year: config.academicYear,
    first_term_start: config.firstTerm.startDate,
    first_term_end: config.firstTerm.endDate,
    first_term_ending: config.firstTerm.termEnding,
    first_next_term_begins: config.firstTerm.nextTermBegins,
    second_term_start: config.secondTerm.startDate,
    second_term_end: config.secondTerm.endDate,
    second_term_ending: config.secondTerm.termEnding,
    second_next_term_begins: config.secondTerm.nextTermBegins,
    third_term_start: config.thirdTerm.startDate,
    third_term_end: config.thirdTerm.endDate,
    third_term_ending: config.thirdTerm.termEnding,
    third_next_term_begins: config.thirdTerm.nextTermBegins,
  };
}

export const defaultSchoolSettings: SchoolSettings = {
  school_id: FALLBACK_SCHOOL_ID,
  school_name: "Grandessa School",
  logo_url: "/client-resources/branding/grandessa-logo-primary.png",
  motto: "Learn To Be Great",
  address: "No. 4, ADLAS Arisa Way, Idi-Iroko, Ikorodu, Lagos State",
  phone: "0818 673 9390 / 0913 929 0283",
  email: "grandessaschool@gmail.com",
  website: "www.grandessa.com",
  head_teacher_name: null,
  principal_signature_url: null,
  school_stamp_url: null,
  report_footer: null,
  kindergarten_class_patterns: ["nursery", "kindergarten", "kg"],
  basic_class_patterns: ["basic", "primary", "elementary", "jss", "sss"],
};

export async function uploadSchoolBrandingAsset(file: File, assetName: "logo" | "signature" | "stamp"): Promise<string> {
  if (!ALLOWED_BRANDING_TYPES.includes(file.type)) {
    throw new Error("Please choose a JPG, PNG, or WebP image.");
  }

  if (file.size > MAX_BRANDING_FILE_SIZE) {
    throw new Error("Please choose an image smaller than 3 MB.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${getActiveSchoolId()}/${assetName}-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(SCHOOL_BRANDING_BUCKET).upload(path, file, { upsert: true });

  if (error) {
    throw new Error("The image could not be uploaded. Please try again or use the existing image setting.");
  }

  return supabase.storage.from(SCHOOL_BRANDING_BUCKET).getPublicUrl(path).data.publicUrl;
}

let settingsCache: Promise<SchoolSettings> | null = null;

export function invalidateSchoolSettingsCache(): void {
  settingsCache = null;
}

export async function getSchoolSettings(): Promise<SchoolSettings> {
  if (!settingsCache) {
    settingsCache = (async () => {
      const schoolId = getActiveSchoolId();

      const { data, error } = await supabase
        .from("school_settings")
        .select("*")
        .eq("school_id", schoolId)
        .maybeSingle();

      if (error || !data) {
        return {
          ...defaultSchoolSettings,
          school_id: schoolId,
        };
      }

      const stored = data as Partial<SchoolSettings>;
      const usesTemporaryContact = stored.phone === "07050956019" || stored.address?.trim().toLowerCase() === "4 adlas street ikorodu";
      const usesTemporaryIdentity = stored.school_name?.trim().toLowerCase() === "grandessa scool" || stored.motto?.trim().toLowerCase() === "learn to be great";

      return {
        ...defaultSchoolSettings,
        ...stored,
        ...(usesTemporaryIdentity
          ? {
              school_name: defaultSchoolSettings.school_name,
              motto: defaultSchoolSettings.motto,
            }
          : {}),
        ...(usesTemporaryContact
          ? {
              address: defaultSchoolSettings.address,
              phone: defaultSchoolSettings.phone,
            }
          : {}),
        logo_url: stored.logo_url?.trim() || defaultSchoolSettings.logo_url,
        website: stored.website?.trim() || defaultSchoolSettings.website,
        school_id: schoolId,
        kindergarten_class_patterns:
          Array.isArray(stored.kindergarten_class_patterns)
            ? stored.kindergarten_class_patterns
            : defaultSchoolSettings.kindergarten_class_patterns,
        basic_class_patterns:
          Array.isArray(stored.basic_class_patterns)
            ? stored.basic_class_patterns
            : defaultSchoolSettings.basic_class_patterns,
      };
    })();
  }

  return settingsCache;
}

export async function saveSchoolSettings(updates: Partial<SchoolSettings>): Promise<SchoolSettings> {
  const schoolId = getActiveSchoolId();
  const current = await getSchoolSettings();
  const payload: SchoolSettings = {
    ...current,
    ...updates,
    school_id: schoolId,
  };

  const { data, error } = await supabase
    .from("school_settings")
    .upsert(payload, { onConflict: "school_id" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  invalidateSchoolSettingsCache();

  return {
    ...defaultSchoolSettings,
    ...(data as SchoolSettings),
    school_id: schoolId,
  };
}

export async function getAcademicCalendarByYear(academicYear: string): Promise<AcademicCalendarConfig> {
  const schoolId = getActiveSchoolId();

  const { data, error } = await supabase
    .from("academic_calendar")
    .select("*")
    .eq("school_id", schoolId)
    .eq("academic_year", academicYear)
    .maybeSingle();

  if (error || !data) {
    return {
      ...defaultAcademicCalendar,
      academicYear,
    };
  }

  return mapCalendarRowToConfig(data as AcademicCalendarRow);
}

export async function saveAcademicCalendar(config: AcademicCalendarConfig): Promise<AcademicCalendarConfig> {
  const row = mapConfigToCalendarRow(config);

  const { data, error } = await supabase
    .from("academic_calendar")
    .upsert(row, { onConflict: "school_id,academic_year" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapCalendarRowToConfig(data as AcademicCalendarRow);
}
