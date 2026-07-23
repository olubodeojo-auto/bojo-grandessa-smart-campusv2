import FeatureCard from "../components/homepage/FeatureCard";
import PublicWhatsAppButton from "../components/homepage/PublicWhatsAppButton";
import SectionHeading from "../components/homepage/SectionHeading";
import "./homepage.css";
import "./about.css";

const assetsBase = "/client-resources";

const logoPath = `${assetsBase}/branding/grandessa-logo-primary.png`;
const heroImage = `${assetsBase}/photos/homepage/hero-homepage-grandessa-school.jpg`;
const storyImage = `${assetsBase}/photos/classroom/teacher-guiding-student.jpg`;
const leadershipImage = `${assetsBase}/photos/staff/proprietress-with-graduate.jpg`;

const coreValues = [
  {
    title: "Excellence",
    description:
      "We maintain high expectations while giving every learner the support needed to succeed.",
  },
  {
    title: "Integrity",
    description:
      "Honesty, accountability and doing the right thing remain central to our learning culture.",
  },
  {
    title: "Respect",
    description:
      "We promote kindness, empathy and respect for others within our school community.",
  },
  {
    title: "Discipline",
    description:
      "Positive habits and responsible routines help prepare pupils for lifelong success.",
  },
  {
    title: "Leadership",
    description:
      "We encourage confidence, initiative and the ability to contribute positively to society.",
  },
];

const parentReasons = [
  {
    title: "Experienced and caring teachers",
    description: "Our teachers are committed to helping each child learn with confidence and care.",
  },
  {
    title: "Safe and supportive classrooms",
    description:
      "Children learn in an environment that is welcoming, disciplined and secure.",
  },
  {
    title: "Strong academic foundation",
    description:
      "We combine high standards with steady support so pupils build lasting skills.",
  },
  {
    title: "Character development",
    description:
      "Academics and values grow together through a balanced, child-centred experience.",
  },
  {
    title: "Parent-school partnership",
    description:
      "We value close communication with families and work together for each child's progress.",
  },
];

const philosophyPoints = [
  {
    title: "Every child is unique",
    description:
      "Each learner deserves the opportunity to discover their strengths and build confidence.",
  },
  {
    title: "We educate the whole child",
    description:
      "Learning at Grandessa develops pupils academically, socially, emotionally, morally and creatively.",
  },
  {
    title: "Learning should inspire curiosity",
    description:
      "We use practical, engaging and learner-centred teaching to encourage participation and thinking.",
  },
  {
    title: "Teachers should inspire confidence",
    description:
      "Our educators guide pupils with encouragement, structure and clear expectations.",
  },
];

function About() {
  return (
    <main className="about-page">
      <nav className="homepage-nav" aria-label="Primary">
        <div className="homepage-container homepage-nav__inner">
          <a href="/" className="homepage-brand">
            <img src={logoPath} alt="Grandessa School logo" loading="eager" />
            <span className="homepage-brand__text">
              <span className="homepage-brand__name">Grandessa School</span>
              <span className="homepage-brand__motto">Learn To Be Great</span>
            </span>
          </a>

          <ul className="homepage-nav__links">
            <li><a href="/">Home</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/#admissions">Admissions</a></li>
            <li><a href="/#contact">Contact</a></li>
          </ul>

          <a className="homepage-nav__cta" href="/#admissions">Apply for Admission</a>
        </div>
      </nav>

      <section className="homepage-section about-hero" id="top">
        <div className="homepage-container about-hero__grid">
          <article className="about-hero__copy">
            <p className="homepage-eyebrow">About Grandessa School</p>
            <h1>Learn To Be Great</h1>
            <p>
              Founded in 2014, Grandessa School was established to provide quality, affordable and
              value-driven education in a caring learning environment where every child can grow
              with confidence.
            </p>
            <p>
              We nurture pupils to think independently, develop strong character and pursue
              academic excellence with discipline, creativity and faith-conscious care.
            </p>
          </article>

          <figure className="about-hero__image">
            <img
              src={heroImage}
              alt="Grandessa School pupils learning in a bright classroom"
              loading="eager"
            />
          </figure>
        </div>
      </section>

      <section className="homepage-section homepage-section--tint" id="our-story">
        <div className="homepage-container">
          <SectionHeading
            eyebrow="Our Story"
            title="Founded in 2014, Grandessa School has grown with a clear purpose and a steady commitment to excellence."
            description="Our story is grounded in quality education, strong character formation and a learning culture that prepares children for life."
          />

          <div className="about-story__layout">
            <figure className="about-story__image homepage-story__image">
              <img
                src={storyImage}
                alt="Teacher guiding a Grandessa pupil during classwork"
                loading="lazy"
              />
            </figure>

            <div className="about-story__cards">
              <article className="homepage-card-soft">
                <h3>Founded in 2014</h3>
                <p>
                  Grandessa School began with the goal of providing quality, affordable and
                  value-driven education for families in Ikorodu.
                </p>
              </article>

              <article className="homepage-card-soft">
                <h3>Mission</h3>
                <p>
                  To provide a safe, inclusive and excellent learning environment that empowers
                  every pupil to learn, grow, lead and contribute positively to society.
                </p>
              </article>

              <article className="homepage-card-soft">
                <h3>Vision</h3>
                <p>
                  To orientate pupils to independently attain academic success at its peak.
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="homepage-section" id="our-core-values">
        <div className="homepage-container">
          <SectionHeading
            eyebrow="Our Core Values"
            title="The values that shape how Grandessa School teaches, leads and supports every child."
          />

          <div className="about-card-grid about-card-grid--five">
            {coreValues.map((value) => (
              <FeatureCard key={value.title} title={value.title} description={value.description} />
            ))}
          </div>
        </div>
      </section>

      <section className="homepage-section homepage-section--tint" id="why-parents-choose-grandessa">
        <div className="homepage-container">
          <SectionHeading
            eyebrow="Why Parents Choose Grandessa"
            title="Parents choose Grandessa School because we combine strong academics with character development and practical support."
            description="Our pupils benefit from a safe, supportive and inclusive environment shaped by experienced teachers and clear values."
          />

          <div className="about-card-grid about-card-grid--parents">
            {parentReasons.map((reason) => (
              <FeatureCard key={reason.title} title={reason.title} description={reason.description} />
            ))}
          </div>
        </div>
      </section>

      <section className="homepage-section" id="learning-philosophy">
        <div className="homepage-container about-philosophy">
          <div className="about-philosophy__intro">
            <SectionHeading
              eyebrow="Learning Philosophy"
              title="Grandessa School educates the whole child through curiosity, confidence and consistent guidance."
              description="We combine classroom instruction, practical learning, digital literacy, leadership development and character building."
            />
          </div>

          <div className="about-card-grid about-card-grid--philosophy">
            {philosophyPoints.map((point) => (
              <FeatureCard key={point.title} title={point.title} description={point.description} />
            ))}
          </div>
        </div>
      </section>

      <section className="homepage-section homepage-section--tint" id="meet-our-leadership">
        <div className="homepage-container">
          <SectionHeading
            eyebrow="Meet Our Leadership"
            title="Grandessa School is guided by a leadership team committed to educational excellence and continuous improvement."
            description="Working closely with teachers, parents and the wider community, our leaders ensure every learner receives care and opportunity."
          />

          <div className="about-leadership-grid">
            <article className="homepage-card-soft about-leadership-card">
              <figure className="about-leadership-card__image homepage-story__image">
                <img
                  src={leadershipImage}
                  alt="Grandessa School proprietress with a graduating pupil"
                  loading="lazy"
                />
              </figure>
              <h3>Proprietress</h3>
              <p>
                The proprietress provides a welcoming vision for the school and supports a culture
                of professionalism, care and continuous improvement.
              </p>
            </article>

            <article className="homepage-card-soft about-leadership-card">
              <figure className="about-leadership-card__image homepage-story__image">
                <img
                  src={storyImage}
                  alt="Grandessa teacher guiding a pupil during classwork"
                  loading="lazy"
                />
              </figure>
              <h3>Teachers</h3>
              <p>
                Grandessa teachers work with patience, discipline and dedication to help every
                learner grow in confidence, skill and character.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="homepage-section" id="about-cta">
        <div className="homepage-container about-cta">
          <SectionHeading
            eyebrow="Call To Action"
            title="Visit Grandessa School and experience a caring environment built to help every child thrive."
            description="Our admissions team is ready to guide you through the next step for your family."
            align="center"
          />

          <div className="homepage-hero__buttons about-cta__buttons">
            <a className="homepage-button homepage-button--primary" href="/#admissions">
              Apply for Admission
            </a>
            <a className="homepage-button homepage-button--secondary" href="/#contact">
              Book a School Visit
            </a>
          </div>
        </div>
      </section>

      <PublicWhatsAppButton />
    </main>
  );
}

export default About;