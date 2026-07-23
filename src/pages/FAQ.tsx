import { useState } from "react";

import PublicFooter from "../components/homepage/PublicFooter";
import PublicNavigation from "../components/homepage/PublicNavigation";
import PublicWhatsAppButton from "../components/homepage/PublicWhatsAppButton";
import SectionHeading from "../components/homepage/SectionHeading";
import "./homepage.css";
import "./faq.css";

type FaqItem = {
  question: string;
  answer: string;
};

const faqItems: FaqItem[] = [
  {
    question: "How do I apply for admission?",
    answer:
      "Visit the Admissions page, review the process steps, and contact our Admissions Team to begin your child's application.",
  },
  {
    question: "What are the school hours?",
    answer:
      "Office hours are Monday to Friday, 8:00 AM to 4:00 PM. Class schedules are shared by the school office during admission.",
  },
  {
    question: "Which curriculum does Grandessa School offer?",
    answer:
      "Grandessa School follows the Nigerian curriculum with enriched learning in literacy, numeracy, science, technology and character development.",
  },
  {
    question: "How are pupil results communicated to parents?",
    answer:
      "Pupil progress and result information are provided through official school communication channels and termly reporting processes.",
  },
  {
    question: "Are extracurricular activities available?",
    answer:
      "Yes. Learners participate in creative arts, sports, leadership activities and school events that support holistic development.",
  },
  {
    question: "How can I contact the Admissions Office?",
    answer:
      "You can call 0818 673 9390 or 0913 929 0283, email grandessaschool@gmail.com, or use the WhatsApp button on this page.",
  },
  {
    question: "How do I make a fees enquiry?",
    answer:
      "For fees and payment information, please contact the Admissions Office directly through phone, email or WhatsApp.",
  },
  {
    question: "What age do you admit children?",
    answer: "To be confirmed by school management.",
  },
  {
    question: "Do you provide school transportation?",
    answer: "Awaiting confirmation from school management.",
  },
  {
    question: "What uniforms are required?",
    answer: "School management will provide full uniform guidelines.",
  },
  {
    question: "Are meals available?",
    answer: "Awaiting confirmation from school management.",
  },
  {
    question: "Do you offer after-school care?",
    answer: "To be confirmed.",
  },
  {
    question: "Can transfer students apply?",
    answer: "Please contact Admissions for guidance.",
  },
  {
    question: "When does each academic session begin?",
    answer: "School management publishes resumption dates before each term.",
  },
  {
    question: "How many pupils are in each class?",
    answer: "To be confirmed.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number>(0);

  return (
    <main className="faq-page">
      <PublicNavigation active="faq" />

      <section className="homepage-section faq-hero">
        <div className="homepage-container">
          <SectionHeading
            eyebrow="Parent Information Centre"
            title="Frequently Asked Questions"
            description="Helpful answers for parents and guardians, including items to be confirmed during school management review."
          />
        </div>
      </section>

      <section className="homepage-section homepage-section--tint" id="faq-list">
        <div className="homepage-container faq-list">
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <article key={item.question} className="faq-item homepage-card-soft">
                <h3>
                  <button
                    className="faq-toggle"
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${index}`}
                    onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  >
                    <span>{item.question}</span>
                    <span aria-hidden="true">{isOpen ? "-" : "+"}</span>
                  </button>
                </h3>
                <div id={`faq-answer-${index}`} hidden={!isOpen}>
                  <p>{item.answer}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <PublicFooter />

      <PublicWhatsAppButton />
    </main>
  );
}