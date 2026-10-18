export interface GradeBand {
  min: number;
  max: number;
  grade: string;
  remark: string;
}

export const grandessaGradingScale: GradeBand[] = [
  { min: 80, max: 100, grade: "A*", remark: "Excellent" },
  { min: 70, max: 79.999999, grade: "A", remark: "Very Good" },
  { min: 60, max: 69.999999, grade: "B", remark: "Good" },
  { min: 50, max: 59.999999, grade: "C", remark: "Average" },
  { min: 40, max: 49.999999, grade: "D", remark: "Pass" },
  { min: 0, max: 39.999999, grade: "F", remark: "Fail" },
];

export default grandessaGradingScale;
