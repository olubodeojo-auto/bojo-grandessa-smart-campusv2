type Props = {
  student?: {
    admission_number?: string;
    first_name?: string;
    last_name?: string;
    class_name?: string;
    gender?: string;
  };
};

export default function StudentProfile({ student }: Props) {
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
        <strong>Class:</strong> {student.class_name}
      </p>

      <p>
        <strong>Gender:</strong> {student.gender}
      </p>
    </div>
  );
}