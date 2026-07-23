import FeatureCard from "../components/homepage/FeatureCard";
import PublicFooter from "../components/homepage/PublicFooter";
import PublicNavigation from "../components/homepage/PublicNavigation";
import PublicWhatsAppButton from "../components/homepage/PublicWhatsAppButton";
import SectionHeading from "../components/homepage/SectionHeading";
import "./homepage.css";
import "./contact.css";

const assetsBase = "/client-resources";
const heroImage = `${assetsBase}/photos/classroom/teacher-guiding-student.jpg`;

const visitHighlights = [
  {
    title: "Meet Our Teachers",
    description:
      "Meet our passionate educators and discover how they inspire confidence, character and academic excellence.",
  },
  {
    title: "Tour Our Classrooms",
    description:
      "Explore our welcoming classrooms and experience the environment where children learn, grow and thrive every day.",
  },
  {
    title: "Discuss Admissions",
    description:
      "Receive guidance on admission requirements, curriculum, fees and the enrolment process.",
  },
  {
    title: "Discover School Life",
    description:
      "Learn about our values, facilities, extracurricular activities and opportunities available for every learner.",
  },
];

export default function Contact() {
  return (
    <main className="contact-page">
      <PublicNavigation active="contact" />

      <section className="homepage-section contact-hero">
        <div className="homepage-container contact-hero__grid">
          <article>
            <p className="homepage-eyebrow">Contact</p>
            <h1>Visit Grandessa School</h1>
            <p>
              We warmly welcome enquiries from parents and guardians. Contact our Admissions Office
              for school visits, admissions guidance and fees information.
            </p>
            <div className="homepage-hero__buttons">
              <a className="homepage-button homepage-button--primary" href="/admissions">
                Apply for Admission
              </a>
              <a className="homepage-button homepage-button--secondary" href="https://maps.app.goo.gl/PpDpeq2zkJJCeGoZ9" target="_blank" rel="noreferrer">
                View on Google Maps
              </a>
            </div>
          </article>

          <figure className="contact-hero__image homepage-hero__image">
            <img src={heroImage} alt="Grandessa classroom learning environment" loading="eager" />
          </figure>
        </div>
      </section>

      <section className="homepage-section homepage-section--tint" id="school-contact">
        <div className="homepage-container contact-grid">
          <article className="homepage-card-soft">
            <SectionHeading eyebrow="School Contact" title="Speak with Admissions" />
            <p><strong>Phone:</strong> 0818 673 9390, 0913 929 0283</p>
            <p><strong>Email:</strong> grandessaschool@gmail.com</p>
            <p>
              <strong>Address:</strong> No. 4, ADLAS Arisa Way, Alhaja Taibat Agbaje Street,
              Idi-Iroko Area, Ikorodu Local Government Area, Lagos State, Nigeria.
            </p>
            <p>
              <a className="contact-link" href="https://maps.app.goo.gl/PpDpeq2zkJJCeGoZ9" target="_blank" rel="noreferrer">
                View on Google Maps
              </a>
            </p>
          </article>

          <article className="homepage-card-soft">
            <SectionHeading eyebrow="Office Hours" title="Monday - Friday" />
            <p><strong>8:00 AM - 4:00 PM</strong></p>
            <p>Our Admissions Team is available during office hours to support your enquiries.</p>
          </article>
        </div>
      </section>

      <section className="homepage-section" id="why-visit-grandessa">
        <div className="homepage-container">
          <SectionHeading
            eyebrow="Why Visit Grandessa?"
            title="Experience our learning environment and connect directly with our school community."
          />
          <div className="homepage-features">
            {visitHighlights.map((item) => (
              <FeatureCard key={item.title} title={item.title} description={item.description} />
            ))}
          </div>
        </div>
      </section>

      <section className="homepage-section homepage-section--tint" id="contact-form">
        <div className="homepage-container">
          <SectionHeading
            eyebrow="Contact Form"
            title="Send us a message"
            description="This form is for demonstration purposes and does not submit data."
          />

          <form className="contact-form" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="contact-name">Name</label>
            <input id="contact-name" name="name" type="text" placeholder="Your full name" />

            <label htmlFor="contact-phone">Phone</label>
            <input id="contact-phone" name="phone" type="tel" placeholder="Your phone number" />

            <label htmlFor="contact-email">Email</label>
            <input id="contact-email" name="email" type="email" placeholder="Your email address" />

            <label htmlFor="contact-message">Message</label>
            <textarea id="contact-message" name="message" rows={5} placeholder="How can we help you?" />

            <button className="homepage-button homepage-button--primary" type="button">
              Send Message
            </button>
          </form>
        </div>
      </section>

      <PublicFooter />

      <PublicWhatsAppButton />
    </main>
  );
}