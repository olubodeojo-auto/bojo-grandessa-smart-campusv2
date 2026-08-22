import { Copy } from "lucide-react";
import { useState } from "react";

type Props = {
  student?: {
    admission_number?: string;
    result_access_code?: string;
    first_name?: string;
    last_name?: string;
    class_name?: string;
    gender?: string;
  };
};

export default function StudentProfile({ student }: Props) {
  const [copied, setCopied] = useState(false);

  if (!student) {
    return (
      <div className="card">
        <h2>No student selected.</h2>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>
        {student.first_name} {student.last_name}
      </h2>

      <p>
        <strong>Admission:</strong> {student.admission_number}
      </p>

      <p>
        <strong>Result Access Code:</strong> {student.result_access_code || "Not assigned"}
        {student.result_access_code ? (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(student.result_access_code ?? "").then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              });
            }}
            style={{ marginLeft: 10, display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <Copy size={14} />
            {copied ? "Copied" : "Copy Code"}
          </button>
        ) : null}
      </p>

      <p>
        <strong>Class:</strong> {student.class_name}
      </p>

      <p>
        <strong>Gender:</strong> {student.gender}
      </p>
    </div>
  );
}