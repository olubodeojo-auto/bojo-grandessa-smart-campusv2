export interface GradeBand {
  min: number;
  max: number;
  grade: string;
  remark: string;
}

export const grandessaGradingScale: GradeBand[] = [
  { min: 80, max: 100, grade: "A*", remark: "Excellent" },
  { min: 70, max: 79.99, grade: "A", remark: "Very Good" },
  { min: 60, max: 69.99, grade: "B", remark: "Good" },
  { min: 50, max: 59.99, grade: "C", remark: "Average" },
  { min: 40, max: 49.99, grade: "D", remark: "Pass" },
  { min: 0, max: 39.99, grade: "F", remark: "Fail" },
];

export default grandessaGradingScale;
