export default function PublicFooter() {
  return (
    <footer className="public-footer" aria-labelledby="public-footer-title">
      <div className="homepage-container public-footer__grid">
        <section>
          <h2 id="public-footer-title">Grandessa School</h2>
          <p className="public-footer__motto">Learn To Be Great</p>
          <p>
            Grandessa School provides a safe, inclusive and excellent learning environment where
            every child is known, valued and encouraged to succeed.
          </p>
        </section>

        <section>
          <h3>Quick Links</h3>
          <ul className="public-footer__list">
            <li><a href="/">Home</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/admissions">Admissions</a></li>
            <li><a href="/faq">FAQ</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </section>

        <section>
          <h3>Admissions Contact</h3>
          <ul className="public-footer__list">
            <li>0818 673 9390</li>
            <li>0913 929 0283</li>
            <li>
              <a href="mailto:grandessaschool@gmail.com">grandessaschool@gmail.com</a>
            </li>
          </ul>
        </section>

        <section>
          <h3>Office Hours</h3>
          <p>Monday - Friday</p>
          <p>8:00 AM - 4:00 PM</p>
        </section>

        <section>
          <h3>Visit Us</h3>
          <p>
            No. 4, ADLAS Arisa Way, Alhaja Taibat Agbaje Street, Idi-Iroko Area, Ikorodu Local
            Government Area, Lagos State, Nigeria.
          </p>
          <p>
            <a href="https://maps.app.goo.gl/PpDpeq2zkJJCeGoZ9" target="_blank" rel="noreferrer">
              View on Google Maps
            </a>
          </p>
        </section>

        <section>
          <h3>Social</h3>
          <ul className="public-footer__list">
            <li><a href="https://facebook.com/grandessaschool" target="_blank" rel="noreferrer" aria-label="Grandessa School Facebook">Facebook</a></li>
            <li><a href="https://instagram.com/grandessaschool" target="_blank" rel="noreferrer" aria-label="Grandessa School Instagram">Instagram</a></li>
          </ul>
        </section>
      </div>

      <div className="public-footer__bottom">
        <div className="homepage-container public-footer__bottom-inner">
          <p>© 2026 Grandessa School</p>
          <p>Powered by Grandessa Smart Campus</p>
        </div>
      </div>
    </footer>
  );
}