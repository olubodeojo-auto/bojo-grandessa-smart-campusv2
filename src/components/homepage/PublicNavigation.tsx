import { NavLink } from "react-router-dom";

const assetsBase = "/client-resources";
const logoPath = `${assetsBase}/branding/grandessa-logo-primary.png`;

type PublicNavigationProps = {
  active?: "home" | "about" | "admissions" | "gallery" | "announcements" | "contact" | "faq" | "our-team";
};

export default function PublicNavigation({ active }: PublicNavigationProps) {
  return (
    <nav className="homepage-nav" aria-label="Primary">
      <div className="homepage-container homepage-nav__inner">
        <NavLink to="/" className="homepage-brand">
          <img src={logoPath} alt="Grandessa School logo" loading="eager" />
          <span className="homepage-brand__text">
            <span className="homepage-brand__name">Grandessa School</span>
            <span className="homepage-brand__motto">Learn To Be Great</span>
          </span>
        </NavLink>

        <ul className="homepage-nav__links">
          <li>
            <NavLink to="/" aria-current={active === "home" ? "page" : undefined}>
              Home
            </NavLink>
          </li>

          <li>
            <NavLink to="/about" aria-current={active === "about" ? "page" : undefined}>
              About
            </NavLink>
          </li>

          <li>
            <NavLink
              to="/admissions"
              aria-current={active === "admissions" ? "page" : undefined}
            >
              Admissions
            </NavLink>
          </li>

          <li>
            <NavLink to="/gallery" aria-current={active === "gallery" ? "page" : undefined}>
              Gallery
            </NavLink>
          </li>

          <li>
            <NavLink to="/our-team" aria-current={active === "our-team" ? "page" : undefined}>
              Our Team
            </NavLink>
          </li>

          <li>
            <NavLink
              to="/announcements"
              aria-current={active === "announcements" ? "page" : undefined}
            >
              Announcements
            </NavLink>
          </li>

          <li>
            <NavLink
              to="/contact"
              aria-current={active === "contact" ? "page" : undefined}
            >
              Contact
            </NavLink>
          </li>

          <li>
            <NavLink to="/faq" aria-current={active === "faq" ? "page" : undefined}>
              FAQ
            </NavLink>
          </li>

          <li>
            <NavLink to="/portal/reports">Parent Portal</NavLink>
          </li>
        </ul>

        <NavLink className="homepage-nav__cta" to="/admissions">
          Apply for Admission
        </NavLink>
      </div>
    </nav>
  );
}