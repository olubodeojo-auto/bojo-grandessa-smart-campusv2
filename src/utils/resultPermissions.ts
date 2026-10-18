import type { Result } from "../types/result";

export type ResultAssignment = { class_id: string };
export type ResultPublicationEvidence = "verified" | "never-published" | "unverified" | "contradictory";

export type ResultChangeAuditRecord = {
  result_id: string;
  action: string;
  old_record: Record<string, unknown> | null;
  new_record: Record<string, unknown> | null;
};

function snapshotMatchesPublishedRecord(
  snapshot: Array<string | number | null>,
  publishedRecord: Record<string, unknown>,
): boolean {
  const publishedValues = [
    publishedRecord.assessment_type,
    publishedRecord.continuous_assessment,
    publishedRecord.examination,
    publishedRecord.total_score,
    publishedRecord.maximum_score ?? null,
  ];
  const expectedValues = snapshot.length === 4 ? publishedValues.slice(0, 4) : publishedValues;
  return snapshot.every((value, index) => value === expectedValues[index]);
}

export function getResultUnpublishAuditEvidence(
  resultId: string,
  snapshot: Result["returned_assessment_snapshot"],
  auditRecords: ResultChangeAuditRecord[],
): ResultPublicationEvidence {
  const publishedToReturnedTransitions = auditRecords.filter((record) =>
    record.result_id === resultId
    && record.action === "UPDATE"
    && record.old_record?.id === resultId
    && record.new_record?.id === resultId
    && record.old_record?.status === "Published"
    && record.new_record?.status === "Returned",
  );
  if (publishedToReturnedTransitions.length > 0) {
    if (!Array.isArray(snapshot) || (snapshot.length !== 4 && snapshot.length !== 5)) return "contradictory";
    const matchingTransition = publishedToReturnedTransitions.some((record) => {
      const previousPublishedSnapshot = record.old_record
        ? snapshotMatchesPublishedRecord(snapshot, record.old_record)
        : false;
      const auditedReturnedSnapshot = record.new_record?.returned_assessment_snapshot;
      return previousPublishedSnapshot
        && Array.isArray(auditedReturnedSnapshot)
        && JSON.stringify(auditedReturnedSnapshot) === JSON.stringify(snapshot);
    });
    return matchingTransition ? "verified" : "contradictory";
  }

  const auditMentionsPublished = auditRecords.some((record) =>
    record.result_id === resultId
    && (record.old_record?.status === "Published" || record.new_record?.status === "Published"),
  );
  if (auditMentionsPublished) return "contradictory";

  const hasAuditedDraftInsert = auditRecords.some((record) =>
    record.result_id === resultId
    && record.action === "INSERT"
    && record.new_record?.id === resultId
    && record.new_record?.status === "Draft",
  );
  return hasAuditedDraftInsert ? "never-published" : "unverified";
}

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

export function hasAssessmentCorrectionSinceReturn(
  result: Result,
  hasVerifiedPublicationHistory = false,
): boolean {
  const snapshot = result.returned_assessment_snapshot;
  if (
    result.status !== "Returned"
    || (!result.published_at && !hasVerifiedPublicationHistory)
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

export function canAdministratorEditResult(result: Result): boolean {
  return result.status !== "Published";
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

export function getResultPublishBlockReason(
  result: Result,
  isAdministrator: boolean,
  publicationEvidence?: ResultPublicationEvidence,
): string {
  if (!isAdministrator) return "Only an administrator can publish results.";
  if (result.status === "Draft" || result.status === "Submitted") return "";
  if (result.status === "Published") return "This subject result is already Published.";
  if (result.status !== "Returned") return `A result with status ${result.status} is not eligible for publishing.`;
  if (!result.published_at) {
    if (publicationEvidence === undefined) {
      return "Publication history has not been verified. Refresh the audit evidence before attempting to publish.";
    }
    if (publicationEvidence === "never-published") {
      return "This Returned result has no verified prior publication. The assigned teacher must submit it for administrator review before it can be published.";
    }
    if (publicationEvidence === "unverified") {
      return "A complete audit trail is unavailable, so prior publication cannot be established. Keep this result blocked for authorized administrator review.";
    }
    if (publicationEvidence === "contradictory") {
      return "Audit history does not substantiate this Returned result's current assessment snapshot. Keep it blocked for administrator review.";
    }
  }

  const snapshot = result.returned_assessment_snapshot;
  if (!Array.isArray(snapshot) || (snapshot.length !== 4 && snapshot.length !== 5)) {
    return "The saved pre-unpublish assessment snapshot is unavailable, so the required correction cannot be verified. Administrator review is required.";
  }
  if (result.published_at || publicationEvidence === "verified") {
    return "";
  }
  if (!hasAssessmentCorrectionSinceReturn(result, publicationEvidence === "verified")) {
    return "No assessment-value correction has been saved since unpublishing. Edit this subject result's assessment type or marks before republishing; comments alone do not qualify.";
  }
  return "";
}

export function canPublishResult(
  result: Result,
  isAdministrator: boolean,
  publicationEvidence?: ResultPublicationEvidence,
): boolean {
  return getResultPublishBlockReason(result, isAdministrator, publicationEvidence) === "";
}

export function canTransitionResult(
  result: Result,
  action: "publish" | "return" | "unpublish",
  isAdministrator: boolean,
  reason?: string,
  publicationEvidence?: ResultPublicationEvidence,
): boolean {
  switch (action) {
    case "publish":
      return canPublishResult(result, isAdministrator, publicationEvidence);
    case "return":
      return isAdministrator && result.status === "Submitted"
        && (reason?.trim().length ?? 0) <= 250;
    case "unpublish":
      return isAdministrator
        && (reason?.trim().length ?? 0) <= 250
        && result.status === "Published";
  }
}
