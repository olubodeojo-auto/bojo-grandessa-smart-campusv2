import FeatureCard from "../components/homepage/FeatureCard";
import PublicFooter from "../components/homepage/PublicFooter";
import PublicNavigation from "../components/homepage/PublicNavigation";
import PublicWhatsAppButton from "../components/homepage/PublicWhatsAppButton";
import SectionHeading from "../components/homepage/SectionHeading";
import "./homepage.css";

const assetsBase = "/client-resources";

const heroImage = `${assetsBase}/photos/homepage/hero-homepage-grandessa-school.jpg`;
const storyImage = `${assetsBase}/photos/classroom/teacher-guiding-student.jpg`;
const playtimeImage = `${assetsBase}/photos/students/students-playtime.jpg`;
const birthdayImage = `${assetsBase}/photos/gallery/students-birthday-celebration.jpg`;
const missMasterImage = `${assetsBase}/photos/gallery/gallery-miss-master-grandessa.jpg`;
const graduationImage = `${assetsBase}/photos/graduation/graduating-class-2026.jpg`;
const topGraduateImage = `${assetsBase}/photos/graduation/graduation-top-student.jpg`;
const bestStudentImage = `${assetsBase}/photos/graduation/best-student-award.jpg`;
const proprietressImage = `${assetsBase}/photos/staff/proprietress-with-graduate.jpg`;

const whyGrandessa = [
    {
        title: "Academic Excellence",
        description:
            "A balanced curriculum that encourages curiosity, confidence and lifelong learning.",
    },
    {
        title: "Character Development",
        description:
            "We nurture integrity, discipline, respect and responsibility alongside academic achievement.",
    },
    {
        title: "Technology & Innovation",
        description:
            "Learners develop essential digital skills through technology-enhanced education.",
    },
    {
        title: "Safe Learning Environment",
        description:
            "A welcoming and secure community where every child feels valued and supported.",
    },
];

const learningAreas = [
    "Nigerian Curriculum",
    "Literacy",
    "Numeracy",
    "Science",
    "Technology",
    "STEM",
    "Creative Arts",
    "Leadership",
    "Sports",
];

const lifeHighlights = [
    { label: "Classroom Learning", image: storyImage },
    { label: "Playtime", image: playtimeImage },
    { label: "School Events", image: birthdayImage },
    { label: "Miss & Master Grandessa", image: missMasterImage },
];

function Home() {
    return (
        <main className="homepage">
            <PublicNavigation active="home" />

            <section className="homepage-hero" id="top">
                <div className="homepage-container homepage-hero__grid">
                    <article className="homepage-hero__copy">
                        <p className="homepage-eyebrow">Grandessa School</p>
                        <h1>Every Child Deserves the Opportunity to Learn, Grow and Shine.</h1>
                        <p>
                            Grandessa School provides quality education in a safe, caring and inspiring
                            environment where every learner is encouraged to build confidence, develop character
                            and achieve academic excellence.
                        </p>
                        <p>
                            Since 2014, we have remained committed to nurturing young minds through dedicated
                            teaching, meaningful learning experiences and strong partnerships with parents.
                        </p>
                        <div className="homepage-hero__buttons">
                            <a className="homepage-button homepage-button--primary" href="/admissions">Apply for Admission</a>
                            <a className="homepage-button homepage-button--secondary" href="/contact">Book a School Visit</a>
                        </div>
                    </article>

                    <figure className="homepage-hero__image">
                        <img src={heroImage} alt="Grandessa pupils learning in a vibrant classroom environment" loading="eager" />
                    </figure>
                </div>
            </section>

            <section className="homepage-section homepage-section--tint" id="why-grandessa">
                <div className="homepage-container">
                    <SectionHeading
                        eyebrow="Why Grandessa"
                        title="Choosing the right school is one of the most important decisions a parent can make."
                        description="Grandessa School combines academic excellence, strong values and personalised support to help every learner reach their full potential."
                    />
                    <div className="homepage-features">
                        {whyGrandessa.map((item) => (
                            <FeatureCard key={item.title} title={item.title} description={item.description} />
                        ))}
                    </div>
                </div>
            </section>

            <section className="homepage-section" id="our-story">
                <div className="homepage-container homepage-story">
                    <figure className="homepage-story__image">
                        <img src={proprietressImage} alt="Grandessa leadership celebrating learners" loading="lazy" />
                    </figure>

                    <article>
                        <SectionHeading
                            eyebrow="Our Story"
                            title="Established in 2014 to build confident learners, responsible citizens and future leaders."
                            description="Today we continue to inspire excellence through dedicated teaching, strong values and meaningful partnerships with families."
                        />
                        <p>
                            Grandessa School was founded with a clear vision: to provide quality education that
                            develops confident learners, responsible citizens and future leaders.
                        </p>
                    </article>
                </div>
            </section>

            <section className="homepage-section homepage-section--tint" id="learning-experience">
                <div className="homepage-container homepage-story">
                    <article>
                        <SectionHeading
                            eyebrow="Learning Experience"
                            title="Every lesson inspires curiosity, creativity and critical thinking."
                            description="Learning at Grandessa combines classroom instruction, practical activities and character development to build strong foundations for life."
                        />
                        <p className="homepage-list-intro">Learning Areas</p>
                        <div className="homepage-pills" aria-label="Learning areas">
                            {learningAreas.map((area) => (
                                <span key={area} className="homepage-pill">{area}</span>
                            ))}
                        </div>
                    </article>

                    <figure className="homepage-story__image">
                        <img src={storyImage} alt="Teacher guiding a Grandessa pupil during classwork" loading="lazy" />
                    </figure>
                </div>
            </section>

            <section className="homepage-section" id="life-at-grandessa">
                <div className="homepage-container">
                    <SectionHeading
                        eyebrow="Life at Grandessa"
                        title="Learning extends beyond the classroom."
                        description="Our pupils enjoy a vibrant school experience that encourages creativity, teamwork, leadership and personal growth."
                    />
                    <div className="homepage-gallery">
                        {lifeHighlights.map((item) => (
                            <figure key={item.label} className="homepage-media-card">
                                <img src={item.image} alt={item.label} loading="lazy" />
                                <figcaption>{item.label}</figcaption>
                            </figure>
                        ))}
                    </div>
                </div>
            </section>

            <section className="homepage-section homepage-section--tint" id="celebrating-success">
                <div className="homepage-container">
                    <SectionHeading
                        eyebrow="Celebrating Success"
                        title="We proudly recognise learner dedication, achievement and growth."
                        description="Through graduations, awards and school celebrations, we inspire every child to pursue excellence."
                    />
                    <div className="homepage-success-grid">
                        <figure className="homepage-media-card">
                            <img src={graduationImage} alt="Grandessa graduating class celebration" loading="lazy" />
                            <figcaption>Graduation</figcaption>
                        </figure>
                        <figure className="homepage-media-card">
                            <img src={topGraduateImage} alt="Top graduate receiving recognition" loading="lazy" />
                            <figcaption>Top Graduate</figcaption>
                        </figure>
                        <figure className="homepage-media-card">
                            <img src={bestStudentImage} alt="Best student award presentation" loading="lazy" />
                            <figcaption>Best Student Award</figcaption>
                        </figure>
                    </div>
                </div>
            </section>

            <section className="homepage-section" id="admissions">
                <div className="homepage-container homepage-contact-grid">
                    <article className="homepage-card-soft">
                        <SectionHeading
                            eyebrow="Admissions"
                            title="We welcome families seeking a caring and academically focused learning environment."
                            description="Our Admissions Team is available to guide you through every stage of the enrolment process."
                        />
                        <div className="homepage-hero__buttons">
                            <a className="homepage-button homepage-button--primary" href="/admissions">Apply for Admission</a>
                            <a className="homepage-button homepage-button--secondary" href="/contact">Contact Admissions</a>
                        </div>
                    </article>

                    <article className="homepage-card-soft">
                        <SectionHeading
                            eyebrow="Fees & Admissions"
                            title="For school fees, admission requirements and payment information, contact the Admissions Office."
                        />
                        <div className="homepage-pills">
                            <span className="homepage-pill">WhatsApp</span>
                            <span className="homepage-pill">Call</span>
                            <span className="homepage-pill">Email</span>
                            <span className="homepage-pill">Visit Campus</span>
                        </div>
                    </article>
                </div>
            </section>

            <section className="homepage-section homepage-section--tint" id="contact">
                <div className="homepage-container homepage-contact-grid">
                    <article className="homepage-card-soft">
                        <SectionHeading eyebrow="Contact" title="Visit Our Campus" />
                        <p>
                            No. 4, ADLAS Arisa Way<br />
                            Alhaja Taibat Agbaje Street<br />
                            Idi-Iroko Area<br />
                            Ikorodu Local Government Area<br />
                            Lagos State, Nigeria
                        </p>
                    </article>

                    <article className="homepage-card-soft">
                        <SectionHeading eyebrow="Contact" title="Speak with Admissions" />
                        <p><strong>Phone:</strong> 0818 673 9390, 0913 929 0283</p>
                        <p><strong>Email:</strong> grandessaschool@gmail.com</p>
                        <p><strong>Instagram:</strong> @grandessaschool</p>
                        <p><strong>Facebook:</strong> grandessaschool</p>
                    </article>
                </div>
            </section>

            <PublicFooter />

            <PublicWhatsAppButton />
        </main>
    );
}

export default Home;