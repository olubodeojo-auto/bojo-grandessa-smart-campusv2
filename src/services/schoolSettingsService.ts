import { supabase } from "../lib/supabase";
import { defaultAcademicCalendar, type AcademicCalendarConfig } from "../config/grandessaCalendar";
import type { AcademicCalendarRow, SchoolSettings } from "../types/schoolSettings";

const FALLBACK_SCHOOL_ID = "1829b784-8e94-4713-bbaf-2518b5e374be";

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
  school_name: "",
  logo_url: null,
  motto: null,
  address: null,
  phone: null,
  email: null,
  website: null,
  head_teacher_name: null,
  principal_signature_url: null,
  school_stamp_url: null,
  report_footer: null,
  kindergarten_class_patterns: ["nursery", "kindergarten", "kg"],
  basic_class_patterns: ["basic", "primary", "elementary", "jss", "sss"],
};

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

      return {
        ...defaultSchoolSettings,
        ...(data as Partial<SchoolSettings>),
        school_id: schoolId,
        kindergarten_class_patterns:
          Array.isArray((data as Partial<SchoolSettings>).kindergarten_class_patterns)
            ? ((data as Partial<SchoolSettings>).kindergarten_class_patterns as string[])
            : defaultSchoolSettings.kindergarten_class_patterns,
        basic_class_patterns:
          Array.isArray((data as Partial<SchoolSettings>).basic_class_patterns)
            ? ((data as Partial<SchoolSettings>).basic_class_patterns as string[])
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
