import grandessaGradingScale from "../config/grandessaGrading";

export function computeTotal(continuousAssessment: number, examination: number): number {
  return Number((continuousAssessment + examination).toFixed(2));
}

export function gradeFromTotal(total: number): string {
  const matchedBand = grandessaGradingScale.find((band) => total >= band.min && total <= band.max);

  return matchedBand?.grade ?? "F";
}

export function remarkFromGrade(grade: string): string {
  const matchedBand = grandessaGradingScale.find((band) => band.grade === grade);

  return matchedBand?.remark ?? "Fail";
}
