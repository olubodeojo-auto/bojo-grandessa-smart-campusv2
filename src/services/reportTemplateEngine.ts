import reportTemplates from "../data/reportTemplates.json";
import type { ReportTemplateSummary } from "../types/reportCard";
import type { SchoolSettings } from "../types/schoolSettings";

interface ExtractedTemplate {
  id: string;
  name: string;
  level: "Kindergarten" | "Basic School";
  headingText: string[];
  tableLabels: string[];
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function isLikelyHeading(text: string): boolean {
  const value = normalize(text);
  return value.includes("statement of result") || value.includes("kindergarten") || value.includes("school");
}

function isLikelyTableLabel(text: string): boolean {
  const value = normalize(text);

  return [
    "subject",
    "continuous",
    "ca",
    "exam",
    "total",
    "grade",
    "remark",
    "position",
    "attendance",
    "teacher",
    "principal",
  ].some((token) => value.includes(token));
}

function detectTemplateLevel(labels: string[]): "Kindergarten" | "Basic School" {
  const lowered = labels.map(normalize).join(" ");

  if (lowered.includes("kindergarten") || lowered.includes("nursery")) {
    return "Kindergarten";
  }

  return "Basic School";
}

const extractedTemplates: ExtractedTemplate[] = reportTemplates.templates.map((template) => {
  const headingText = Array.from(
    new Set(
      template.labels
        .map((label) => label.text)
        .filter((text) => text && isLikelyHeading(text))
    )
  ).slice(0, 8);

  const tableLabels = Array.from(
    new Set(
      template.labels
        .map((label) => label.text)
        .filter((text) => text && isLikelyTableLabel(text))
    )
  ).slice(0, 20);

  return {
    id: template.id,
    name: template.name,
    level: detectTemplateLevel(template.labels.map((label) => label.text)),
    headingText,
    tableLabels,
  };
});

function classNameToLevel(className: string, settings: SchoolSettings): "Kindergarten" | "Basic School" {
  const normalizedClassName = normalize(className);

  const kindergartenMatch = settings.kindergarten_class_patterns.some((pattern) =>
    normalizedClassName.includes(normalize(pattern))
  );

  if (kindergartenMatch) {
    return "Kindergarten";
  }

  const basicMatch = settings.basic_class_patterns.some((pattern) =>
    normalizedClassName.includes(normalize(pattern))
  );

  if (basicMatch) {
    return "Basic School";
  }

  return "Basic School";
}

export function getAllReportTemplates(): ReportTemplateSummary[] {
  return extractedTemplates.map((template) => ({
    id: template.id,
    name: template.name,
    level: template.level,
    headingText: template.headingText,
    tableLabels: template.tableLabels,
  }));
}

export function resolveTemplateForClass(className: string, settings: SchoolSettings): ReportTemplateSummary {
  const inferredLevel = classNameToLevel(className, settings);

  const exactMatch = extractedTemplates.find((template) => template.level === inferredLevel);

  if (exactMatch) {
    return {
      id: exactMatch.id,
      name: exactMatch.name,
      level: exactMatch.level,
      headingText: exactMatch.headingText,
      tableLabels: exactMatch.tableLabels,
    };
  }

  const fallback = extractedTemplates[0];

  return {
    id: fallback.id,
    name: fallback.name,
    level: fallback.level,
    headingText: fallback.headingText,
    tableLabels: fallback.tableLabels,
  };
}

export function resolveSchoolLevelFromClassName(className: string): string {
  const defaultSettings: SchoolSettings = {
    school_id: "",
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

  return classNameToLevel(className, defaultSettings);
}
