type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
};

export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: SectionHeadingProps) {
  return (
    <header className={`homepage-section-heading homepage-section-heading--${align}`}>
      {eyebrow ? <p className="homepage-eyebrow">{eyebrow}</p> : null}
      <h2>{title}</h2>
      {description ? <p className="homepage-section-description">{description}</p> : null}
    </header>
  );
}
