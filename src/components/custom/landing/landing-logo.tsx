import { ASSETS } from "./data";

/**
 * Logo de Flu3nce con variante clara/oscura. El CSS (.nav-logo-light / .nav-logo-dark)
 * decide cuál mostrar según el data-theme del contenedor `.flu3nce-landing`.
 */
export const LandingLogo = ({ height = 26 }: { height?: number }) => (
    <>
        <span className="nav-logo-light">
            <img src={ASSETS.logoLight} alt="Flu3nce" height={height} />
        </span>
        <span className="nav-logo-dark">
            <img src={ASSETS.logoDark} alt="Flu3nce" height={height} />
        </span>
    </>
);
