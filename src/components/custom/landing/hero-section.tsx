import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { ASSETS, heroStats } from "./data";
import { handleAnchorClick } from "./utils";

export const HeroSection = () => {
    const videoRef = useRef<HTMLVideoElement>(null);

    // Garantiza el autoplay: React no siempre fija `muted` a tiempo y el navegador
    // bloquea la reproducción automática si el video no está silenciado.
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = true;
        const playPromise = video.play();
        if (playPromise) playPromise.catch(() => {});
    }, []);

    return (
    <section className="hero">
        <video ref={videoRef} className="hero-video" autoPlay muted loop playsInline preload="auto" poster={ASSETS.heroPoster}>
            <source src={ASSETS.heroVideoWebm} type="video/webm" />
            <source src={ASSETS.heroVideoMp4} type="video/mp4" />
        </video>
        <div className="hero-overlay" />
        <div className="hero-badge">
            <span className="hero-badge-dot" />
            Para consultores y firmas de consultoría
        </div>
        <h1 className="hero-headline">
            Entrega en horas lo que
            <br />
            antes tomaba <span className="accent">semanas.</span>
        </h1>
        <p className="hero-subhead">
            Flu3nce es la plataforma AI para consultores y firmas que quieren diagnosticar, documentar y presentar resultados — sin perder tiempo en el proceso.
        </p>
        <div className="hero-ctas">
            <Link to="/login" className="btn-cta-primary">
                Prueba gratis
            </Link>
            <a href="#servicios" className="btn-cta-secondary" onClick={handleAnchorClick}>
                Ver servicios
            </a>
        </div>
        <div className="hero-stats">
            {heroStats.map((stat) => (
                <div className="stat-item" key={stat.label}>
                    <div className="stat-number">
                        {stat.number}
                        {stat.unit && <span className="unit">{stat.unit}</span>}
                    </div>
                    <div className="stat-label">{stat.label}</div>
                </div>
            ))}
        </div>
    </section>
    );
};
