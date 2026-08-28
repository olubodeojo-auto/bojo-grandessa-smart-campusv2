import type { SchoolClass } from "../../../types/class";

type Props = {
  schoolClass?: SchoolClass | null;
};

export default function ClassProfile({ schoolClass }: Props) {
  if (!schoolClass) {
    return (
      <div className="card">
        <h2>No class selected.</h2>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 id="class-profile-title">{schoolClass.class_name}</h2>

      <p>
        <strong>Status:</strong> {schoolClass.status}
      </p>
      <p>
        <strong>Created:</strong> {schoolClass.created_at}
      </p>

      <p>
        <strong>Class Teacher:</strong> {[schoolClass.class_teacher?.first_name, schoolClass.class_teacher?.last_name].filter(Boolean).join(" ") || "Not Assigned"}
      </p>
      <p>
        <strong>Updated:</strong> {schoolClass.updated_at}
      </p>
    </div>
  );
}
