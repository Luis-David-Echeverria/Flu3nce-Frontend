import { useEffect, useState } from "react";
import { CtaFinalSection } from "./cta-final-section";
import { DiferenciadoresSection } from "./diferenciadores-section";
import { FrameworkSection } from "./framework-section";
import { HeroSection } from "./hero-section";
import { LandingFooter } from "./landing-footer";
import { LandingNav } from "./landing-nav";
import { PlanesSection } from "./planes-section";
import { ProblemaSection } from "./problema-section";
import { ServiciosSection } from "./servicios-section";
import "./landing.css";
import "./landing-overrides.css";

type LandingTheme = "light" | "dark";
const THEME_KEY = "flu3nce-theme";

/**
 * Landing pública de Flu3nce. Maneja su propio tema (data-theme) y estado de scroll,
 * de forma independiente al ThemeProvider de la app para no interferir con el resto.
 */
export const LandingPage = () => {
    const [theme, setTheme] = useState<LandingTheme>(() => {
        if (typeof window === "undefined") return "light";
        return (localStorage.getItem(THEME_KEY) as LandingTheme | null) ?? "light";
    });
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        let raf = 0;
        let last = false;
        const onScroll = () => {
            if (raf) return; // throttle a un cálculo por frame
            raf = requestAnimationFrame(() => {
                raf = 0;
                const next = window.scrollY > 30;
                if (next !== last) {
                    last = next;
                    setScrolled(next); // solo re-render cuando cambia de verdad
                }
            });
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", onScroll);
            if (raf) cancelAnimationFrame(raf);
        };
    }, []);

    const toggleTheme = () => {
        setTheme((prev) => {
            const next = prev === "light" ? "dark" : "light";
            localStorage.setItem(THEME_KEY, next);
            return next;
        });
    };

    return (
        <div className="flu3nce-landing" data-theme={theme}>
            <div className="bg-canvas">
                <div className="bg-orb bg-orb-1" />
                <div className="bg-orb bg-orb-2" />
                <div className="bg-orb bg-orb-3" />
                <div className="bg-grid" />
            </div>

            <LandingNav scrolled={scrolled} onToggleTheme={toggleTheme} />
            <HeroSection />
            <ProblemaSection />
            <ServiciosSection />
            <FrameworkSection />
            <DiferenciadoresSection />
            <PlanesSection />
            <CtaFinalSection />
            <LandingFooter />
        </div>
    );
};
