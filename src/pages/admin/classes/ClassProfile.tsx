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
        <strong>Academic Level:</strong> {schoolClass.academic_level ?? "—"}
      </p>
      <p>
        <strong>Current Students:</strong> {schoolClass.current_students ?? "—"}
      </p>
      <p>
        <strong>Available Seats:</strong> {schoolClass.available_seats ?? "—"}
      </p>
      <p>
        <strong>Subjects Assigned:</strong> {schoolClass.subjects_assigned?.join(", ") || "—"}
      </p>
      <p>
        <strong>Homeroom/Class Teacher:</strong> {schoolClass.homeroom_teacher ?? schoolClass.class_teacher ?? "—"}
      </p>
      <p>
        <strong>Section:</strong> {schoolClass.section ?? "—"}
      </p>
      <p>
        <strong>Capacity:</strong> {schoolClass.capacity}
      </p>
      <p>
        <strong>Status:</strong> {schoolClass.status}
      </p>
      <p>
        <strong>Created:</strong> {schoolClass.created_at}
      </p>
      <p>
        <strong>Updated:</strong> {schoolClass.updated_at}
      </p>
    </div>
  );
}
