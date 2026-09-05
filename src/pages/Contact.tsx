import { useState, type FormEvent } from "react";
import FeatureCard from "../components/homepage/FeatureCard";
import PublicFooter from "../components/homepage/PublicFooter";
import PublicNavigation from "../components/homepage/PublicNavigation";
import PublicWhatsAppButton from "../components/homepage/PublicWhatsAppButton";
import SectionHeading from "../components/homepage/SectionHeading";
import { supabase } from "../lib/supabase";
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
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError("");
    setFormSuccess("");
    const name = form.name.trim();
    const email = form.email.trim();
    const message = form.message.trim();
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !message) {
      setFormError("Please enter your name, a valid email address, and a message.");
      return;
    }
    if (name.length > 120 || message.length > 5000 || form.phone.trim().length > 40) {
      setFormError("Please shorten the details and try again.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("send-contact-enquiry", { body: { ...form, name, email, message, phone: form.phone.trim() } });
      if (error) throw error;
      setForm({ name: "", phone: "", email: "", message: "" });
      setFormSuccess("Thank you. Your enquiry has been sent to Grandessa School.");
    } catch {
      setFormError("Your enquiry could not be sent right now. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  }

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
            <p><strong>General Enquiries:</strong> <a className="contact-link" href="mailto:info@grandessaschool.com.ng">info@grandessaschool.com.ng</a></p>
            <p><strong>School Email:</strong> <a className="contact-link" href="mailto:grandessaschool@gmail.com">grandessaschool@gmail.com</a></p>
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
            description="Send an enquiry to the Grandessa School team."
          />

          <form className="contact-form" onSubmit={(event) => void handleSubmit(event)}>
            <label htmlFor="contact-name">Name</label>
            <input id="contact-name" name="name" type="text" placeholder="Your full name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={120} required />

            <label htmlFor="contact-phone">Phone</label>
            <input id="contact-phone" name="phone" type="tel" placeholder="Your phone number" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} maxLength={40} />

            <label htmlFor="contact-email">Email</label>
            <input id="contact-email" name="email" type="email" placeholder="Your email address" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />

            <label htmlFor="contact-message">Message</label>
            <textarea id="contact-message" name="message" rows={5} placeholder="How can we help you?" value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} maxLength={5000} required />

            {formError ? <p role="alert" className="contact-form__message contact-form__message--error">{formError}</p> : null}
            {formSuccess ? <p role="status" className="contact-form__message contact-form__message--success">{formSuccess}</p> : null}
            <button className="homepage-button homepage-button--primary" type="submit" disabled={submitting}>
              {submitting ? "Sending..." : "Send Message"}
            </button>
          </form>
        </div>
      </section>

      <PublicFooter />

      <PublicWhatsAppButton />
    </main>
  );
}