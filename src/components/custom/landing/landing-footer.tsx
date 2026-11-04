import { footerColumns } from "./data";
import { LandingLogo } from "./landing-logo";
import { handleAnchorClick } from "./utils";

export const LandingFooter = () => (
    <footer className="site-footer">
        <div className="footer-inner">
            <div className="footer-brand">
                <span className="footer-logo-svg">
                    <LandingLogo height={28} />
                </span>
                <p className="footer-tagline">AI-Powered Self-Consulting Methodology</p>
                <p className="footer-copy">© 2026 LN Creatividad y Tecnología. Todos los derechos reservados.</p>
            </div>
            <div className="footer-links">
                {footerColumns.map((col) => (
                    <div className="footer-col" key={col.title}>
                        <div className="footer-col-title">{col.title}</div>
                        {col.links.map((link) => (
                            <a key={link.label} href={link.href} onClick={link.href.startsWith("#") ? handleAnchorClick : undefined}>
                                {link.label}
                            </a>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    </footer>
);
