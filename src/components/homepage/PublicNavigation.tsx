const assetsBase = "/client-resources";
const logoPath = `${assetsBase}/branding/grandessa-logo-primary.png`;

type PublicNavigationProps = {
  active?: "home" | "about" | "admissions" | "contact" | "faq";
};

export default function PublicNavigation({ active }: PublicNavigationProps) {
  return (
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
          <li><a href="/" aria-current={active === "home" ? "page" : undefined}>Home</a></li>
          <li><a href="/about" aria-current={active === "about" ? "page" : undefined}>About</a></li>
          <li><a href="/admissions" aria-current={active === "admissions" ? "page" : undefined}>Admissions</a></li>
          <li><a href="/contact" aria-current={active === "contact" ? "page" : undefined}>Contact</a></li>
          <li><a href="/faq" aria-current={active === "faq" ? "page" : undefined}>FAQ</a></li>
        </ul>

        <a className="homepage-nav__cta" href="/admissions">Apply for Admission</a>
      </div>
    </nav>
  );
}