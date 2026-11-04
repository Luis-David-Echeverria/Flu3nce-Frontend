import type { SVGProps } from "react";

/**
 * Iconos SVG de la landing de Flu3nce. Reproducen fielmente los del HTML original
 * (agent/flu3nce-landing-main/index.html). El color/stroke lo controla el CSS del
 * contenedor vía `currentColor`, salvo donde el original define colores explícitos.
 */

type IconProps = SVGProps<SVGSVGElement>;

const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
};

/* ── Theme toggle ── */
export const SunIcon = (props: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
);

export const MoonIcon = (props: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
);

/* ── Pain / problema (3) ── */
export const ClockIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...props}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </svg>
);

export const HomeIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...props}>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
);

export const UsersIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...props}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

/* ── Servicios (8) ── */
export const RowsIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...props}>
        <path d="M3 3h18v4H3z" />
        <path d="M3 10h18v4H3z" />
        <path d="M3 17h18v4H3z" />
        <circle cx="7" cy="5" r="1" fill="currentColor" stroke="none" />
        <circle cx="7" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="7" cy="19" r="1" fill="currentColor" stroke="none" />
    </svg>
);

export const StarIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...props}>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
);

export const ShieldIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...props}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

export const PresentationIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...props}>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
    </svg>
);

export const FileTextIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...props}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
);

export const GlobeIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...props}>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
);

export const CheckSquareIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...props}>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
);

export const MicIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...props}>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
);

/* ── Inputs aceptados (5) ── */
export const TextInputIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} {...props}>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

export const DocumentIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} {...props}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
    </svg>
);

export const AudioIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} {...props}>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
);

export const VideoIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} {...props}>
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
);

export const TargetIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" width="18" height="18" {...stroke} {...props}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

/* ── Diferenciadores / pilares (3) ── */
export const BoxIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...props}>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
);

export const EditIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...props}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
);

export const TrendingUpIcon = (props: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...props}>
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
    </svg>
);

/* ── Flecha del flujo Transform ── */
export const FlowArrowIcon = (props: IconProps) => (
    <svg width="20" height="12" viewBox="0 0 20 12" fill="none" {...props}>
        <path d="M1 6h18M13 1l5 5-5 5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

/* ── Check de los planes (color según variante) ── */
export const PlanCheckIcon = ({ circleFill = "#4895f4", tickStroke = "#ffffff" }: { circleFill?: string; tickStroke?: string }) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="7" fill={circleFill} />
        <polyline points="3.5,7 6,9.5 10.5,4.5" stroke={tickStroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
