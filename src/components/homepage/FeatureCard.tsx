type FeatureCardProps = {
  title: string;
  description: string;
};

export default function FeatureCard({ title, description }: FeatureCardProps) {
  return (
    <article className="homepage-feature-card">
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
}
