import FeatureCard from "../components/homepage/FeatureCard";
import PublicFooter from "../components/homepage/PublicFooter";
import PublicNavigation from "../components/homepage/PublicNavigation";
import PublicWhatsAppButton from "../components/homepage/PublicWhatsAppButton";
import SectionHeading from "../components/homepage/SectionHeading";
import "./homepage.css";
import "./admissions.css";

const assetsBase = "/client-resources";
const heroImage = `${assetsBase}/photos/homepage/hero-homepage-grandessa-school.jpg`;
const classroomImage = `${assetsBase}/photos/classroom/teacher-guiding-student.jpg`;

const processSteps = [
  {
    title: "1. Enquiry",
    description: "Contact our Admissions Office to discuss your child's needs and year group.",
  },
  {
    title: "2. School Visit",
    description: "Book a visit to explore our campus, meet our team and experience school life.",
  },
  {
    title: "3. Admission Form",
    description: "Complete the admission form with accurate child and parent information.",
  },
  {
    title: "4. Assessment",
    description: "Pupils complete a friendly placement assessment suited to their level.",
  },
  {
    title: "5. Admission",
    description: "Successful applicants receive admission guidance and next-step instructions.",
  },
];

const nurseryRequirements = [
  "Birth certificate",
  "Recent passport photographs",
  "Immunisation record",
  "Parent/guardian contact details",
];

const primaryRequirements = [
  "Birth certificate",
  "Recent passport photographs",
  "Previous school report (if applicable)",
  "Transfer letter (if applicable)",
];

const chooseGrandessa = [
  {
    title: "Safe and supportive environment",
    description: "Every child learns in a secure, caring and disciplined school community.",
  },
  {
    title: "Strong academics and values",
    description: "We combine quality instruction with character development and leadership growth.",
  },
  {
    title: "Experienced and caring teachers",
    description: "Our educators help each learner build confidence and meaningful academic progress.",
  },
  {
    title: "Parent-school partnership",
    description: "Families receive clear communication and support throughout the school journey.",
  },
];

export default function Admissions() {
  return (
    <main className="admissions-page">
      <PublicNavigation active="admissions" />

      <section className="homepage-section admissions-hero">
        <div className="homepage-container admissions-hero__grid">
          <article>
            <p className="homepage-eyebrow">Admissions Now Open</p>
            <h1>Begin Your Child's Grandessa Journey</h1>
            <p>
              Join a caring learning community where every child is inspired to learn, grow and
              shine.
            </p>
            <div className="homepage-hero__buttons">
              <a className="homepage-button homepage-button--primary" href="#admission-process">
                View Admission Process
              </a>
              <a className="homepage-button homepage-button--secondary" href="/contact">
                Book a School Visit
              </a>
            </div>
          </article>

          <figure className="admissions-hero__image homepage-hero__image">
            <img src={heroImage} alt="Grandessa pupils learning in class" loading="eager" />
          </figure>
        </div>
      </section>

      <section className="homepage-section homepage-section--tint" id="admission-process">
        <div className="homepage-container">
          <SectionHeading
            eyebrow="Admission Process"
            title="A clear 5-step process designed to support families from first enquiry to successful admission."
          />
          <div className="admissions-steps">
            {processSteps.map((step) => (
              <FeatureCard key={step.title} title={step.title} description={step.description} />
            ))}
          </div>
        </div>
      </section>

      <section className="homepage-section" id="admission-requirements">
        <div className="homepage-container admissions-requirements">
          <SectionHeading
            eyebrow="Admission Requirements"
            title="Required documents for Nursery and Primary admission."
          />

          <div className="admissions-requirements__grid">
            <article className="homepage-card-soft">
              <h3>Nursery</h3>
              <ul>
                {nurseryRequirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="homepage-card-soft">
              <h3>Primary</h3>
              <ul>
                {primaryRequirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="homepage-section homepage-section--tint" id="why-choose-grandessa">
        <div className="homepage-container">
          <SectionHeading
            eyebrow="Why Choose Grandessa"
            title="Families choose Grandessa School for trusted teaching, strong values and a safe learning environment."
          />

          <div className="admissions-steps admissions-steps--two">
            {chooseGrandessa.map((item) => (
              <FeatureCard key={item.title} title={item.title} description={item.description} />
            ))}
          </div>
        </div>
      </section>

      <section className="homepage-section" id="admissions-cta">
        <div className="homepage-container admissions-cta">
          <div>
            <SectionHeading
              eyebrow="Call To Action"
              title="Ready to apply? Speak with our Admissions Team today."
              description="We are available to guide you through every stage of the enrolment process."
            />
            <div className="homepage-hero__buttons">
              <a className="homepage-button homepage-button--primary" href="/contact">
                Apply for Admission
              </a>
              <a className="homepage-button homepage-button--secondary" href="https://wa.me/2348186739390?text=Hello%20Grandessa%20School.%20I%20would%20like%20to%20enquire%20about%20admission%20for%20my%20child." target="_blank" rel="noreferrer">
                WhatsApp Enquiry
              </a>
            </div>
          </div>

          <figure className="admissions-cta__image homepage-story__image">
            <img src={classroomImage} alt="Grandessa teacher guiding a pupil" loading="lazy" />
          </figure>
        </div>
      </section>

      <PublicFooter />

      <PublicWhatsAppButton />
    </main>
  );
}