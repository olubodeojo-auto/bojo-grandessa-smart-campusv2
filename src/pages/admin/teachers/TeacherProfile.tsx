import type { Teacher } from "../../../types/teacher";

type Props = {
  teacher?: Teacher | null;
};

export default function TeacherProfile({ teacher }: Props) {
  if (!teacher) {
    return (
      <div className="card">
        <h2>No teacher selected.</h2>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>
        {teacher.first_name} {teacher.last_name}
      </h2>

      <p>
        <strong>Employee No.:</strong> {teacher.employee_number}
      </p>
      <p>
        <strong>Gender:</strong> {teacher.gender}
      </p>
      <p>
        <strong>Email:</strong> {teacher.email}
      </p>
      <p>
        <strong>Phone:</strong> {teacher.phone}
      </p>
      <p>
        <strong>Qualification:</strong> {teacher.qualification ?? "—"}
      </p>
      <p>
        <strong>Specialization:</strong> {teacher.specialization ?? "—"}
      </p>
      <p>
        <strong>Employment Type:</strong> {teacher.employment_type}
      </p>
      <p>
        <strong>Status:</strong> {teacher.status}
      </p>
      <p>
        <strong>Date Employed:</strong> {teacher.date_employed}
      </p>
      <p>
        <strong>Address:</strong> {teacher.address ?? "—"}
      </p>
    </div>
  );
}
