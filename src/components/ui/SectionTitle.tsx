type SectionTitleProps = {
  title: string;
};

export default function SectionTitle({
  title,
}: SectionTitleProps) {
  return (
    <h3
      style={{
        marginTop: 0,
        marginBottom: "18px",
        color: "#2E7D32",
        fontSize: "1.2rem",
        fontWeight: 700,
      }}
    >
      {title}
    </h3>
  );
}