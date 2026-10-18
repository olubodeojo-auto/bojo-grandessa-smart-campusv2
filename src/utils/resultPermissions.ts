import type { Result } from "../types/result";

export type ResultAssignment = { class_id: string };

export function getResultRoleFlags(roleNames: string[]): {
  isAdministrator: boolean;
  isTeacher: boolean;
  isParent: boolean;
} {
  const normalized = new Set(roleNames.map((name) => name.trim().toLowerCase().replace(/[\s-]+/g, "_")));
  return {
    isAdministrator: ["school_admin", "super_admin", "admin", "administrator", "proprietress"].some((name) => normalized.has(name)),
    isTeacher: normalized.has("teacher"),
    isParent: normalized.has("parent"),
  };
}

export function hasAssessmentCorrectionSinceReturn(result: Result): boolean {
  const snapshot = result.returned_assessment_snapshot;
  if (
    result.status !== "Returned"
    || !result.published_at
    || !Array.isArray(snapshot)
    || (snapshot.length !== 4 && snapshot.length !== 5)
  ) {
    return false;
  }

  const currentValues = [
    result.assessment_type,
    result.continuous_assessment,
    result.examination,
    result.total_score,
    result.maximum_score ?? null,
  ];
  const expectedValues = snapshot.length === 4 ? currentValues.slice(0, 4) : currentValues;
  return expectedValues.some((value, index) => value !== snapshot[index]);
}

export function isTeacherAssignedToResult(result: Result, assignments: ResultAssignment[]): boolean {
  return Boolean(result.class_id && assignments.some((assignment) => assignment.class_id === result.class_id));
}

export function canTeacherEditResult(
  result: Result,
  _userId: string,
  assignments: ResultAssignment[],
): boolean {
  return (result.status === "Draft" || (result.status === "Returned"
      && (result.published_at === null || result.published_at === undefined)))
    && isTeacherAssignedToResult(result, assignments);
}

export function canAdministratorEditResult(): boolean {
  return true;
}

export function canAdministratorDeleteResult(isAdministrator: boolean): boolean {
  return isAdministrator;
}

export function canTeacherSubmitResult(
  result: Result,
  _userId: string,
  assignments: ResultAssignment[],
): boolean {
  return (result.status === "Draft" || (result.status === "Returned"
      && (result.published_at === null || result.published_at === undefined)))
    && isTeacherAssignedToResult(result, assignments);
}

export function canPublishResult(result: Result, isAdministrator: boolean): boolean {
  if (!isAdministrator) return false;
  return result.status === "Draft"
    || result.status === "Submitted"
    || hasAssessmentCorrectionSinceReturn(result);
}

export function canTransitionResult(
  result: Result,
  action: "publish" | "return" | "unpublish",
  isAdministrator: boolean,
  reason?: string,
): boolean {
  switch (action) {
    case "publish":
      return canPublishResult(result, isAdministrator);
    case "return":
      return isAdministrator && result.status === "Submitted"
        && (reason?.trim().length ?? 0) <= 250;
    case "unpublish":
      return isAdministrator
        && (reason?.trim().length ?? 0) <= 250
        && result.status === "Published";
  }
}
