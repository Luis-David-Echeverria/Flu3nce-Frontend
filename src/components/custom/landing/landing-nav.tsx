import { Link } from "react-router";
import { navLinks } from "./data";
import { MoonIcon, SunIcon } from "./icons";
import { LandingLogo } from "./landing-logo";
import { handleAnchorClick } from "./utils";

interface LandingNavProps {
    scrolled: boolean;
    onToggleTheme: () => void;
}

export const LandingNav = ({ scrolled, onToggleTheme }: LandingNavProps) => (
    <nav id="main-nav" className={scrolled ? "scrolled" : undefined}>
        <a href="#" className="nav-logo" onClick={(e) => e.preventDefault()}>
            <LandingLogo height={26} />
        </a>
        <ul className="nav-links">
            {navLinks.map((link) => (
                <li key={link.href}>
                    <a href={link.href} onClick={handleAnchorClick}>
                        {link.label}
                    </a>
                </li>
            ))}
        </ul>
        <div className="nav-actions">
            <button className="theme-toggle" onClick={onToggleTheme} aria-label="Toggle theme" type="button">
                <span className="theme-toggle-sun">
                    <SunIcon />
                </span>
                <span className="theme-toggle-moon">
                    <MoonIcon />
                </span>
            </button>
            <Link to="/login" className="btn-ghost">
                Iniciar sesión
            </Link>
        </div>
    </nav>
);
