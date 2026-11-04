import type { ReactNode } from "react";
import {
    AudioIcon,
    BoxIcon,
    CheckSquareIcon,
    ClockIcon,
    DocumentIcon,
    EditIcon,
    FileTextIcon,
    GlobeIcon,
    HomeIcon,
    MicIcon,
    PresentationIcon,
    RowsIcon,
    ShieldIcon,
    StarIcon,
    TargetIcon,
    TextInputIcon,
    TrendingUpIcon,
    UsersIcon,
    VideoIcon,
} from "./icons";

/** Enlaces de navegación del nav y del footer */
export const navLinks = [
    { href: "#servicios", label: "Servicios" },
    { href: "#como-funciona", label: "Cómo funciona" },
    { href: "#diferenciadores", label: "Por qué Flu3nce" },
    { href: "#planes", label: "Planes" },
];

/** Stats del hero */
export const heroStats = [
    { number: "80", unit: "%", label: "Menos tiempo por entregable" },
    { number: "3", unit: "×", label: "Más proyectos en paralelo" },
    { number: "8", unit: "", label: "Herramientas especializadas" },
    { number: "$25", unit: "", label: "USD para empezar" },
];

/** Tarjetas de la sección "¿Te suena familiar?" */
export const painPoints: { icon: ReactNode; title: string; desc: string }[] = [
    {
        icon: <ClockIcon />,
        title: "Pasas más tiempo documentando que consultando",
        desc: "Levantar procesos, estructurar hallazgos y armar presentaciones consume la mitad de tu proyecto. Ese tiempo debería estar con el cliente.",
    },
    {
        icon: <HomeIcon />,
        title: "Cada proyecto empieza desde cero",
        desc: "El conocimiento de proyectos anteriores vive en tu cabeza o en carpetas que nadie encuentra. No hay sistema que lo capitalice.",
    },
    {
        icon: <UsersIcon />,
        title: "Tu capacidad está limitada por tus horas",
        desc: "Crecer significa contratar. Pero el cuello de botella no es headcount — es que los procesos analíticos no están sistematizados.",
    },
];

/** Las 8 herramientas */
export const services: { icon: ReactNode; num: string; name: string; desc: string; tags: string[] }[] = [
    {
        icon: <RowsIcon />,
        num: "01",
        name: "Documentación de Procesos",
        desc: "Levanta y documenta procesos As-Is desde audio, texto o documentos. Genera diagramas y matrices listos para presentar.",
        tags: ["Diagrama VSDX", "Tabla de actividades"],
    },
    {
        icon: <StarIcon />,
        num: "02",
        name: "Diagnóstico Operativo",
        desc: "Evalúa madurez operativa en 6 dimensiones con scoring, benchmark y quick wins priorizados por impacto y esfuerzo.",
        tags: ["Score 6D", "Roadmap de mejora"],
    },
    {
        icon: <ShieldIcon />,
        num: "03",
        name: "Cumplimiento y Gobernanza",
        desc: "Evalúa contratos, normas y políticas. Genera documentos de cumplimiento con marco jurídico aplicable y brechas identificadas.",
        tags: ["Análisis normativo", "Mapa de brechas"],
    },
    {
        icon: <PresentationIcon />,
        num: "04",
        name: "Presentaciones AI",
        desc: "Convierte hallazgos, diagnósticos o briefs en presentaciones ejecutivas listas para C-level o Comité Directivo.",
        tags: ["PPTX descargable", "Link compartible"],
    },
    {
        icon: <FileTextIcon />,
        num: "05",
        name: "Resumen y Minuta",
        desc: "Procesa audio, video o documentos y genera minutas estructuradas con acuerdos, responsables y fechas clave.",
        tags: ["Minuta estructurada", "Acuerdos y tareas"],
    },
    {
        icon: <GlobeIcon />,
        num: "06",
        name: "Traducción Multiidioma",
        desc: "Traduce documentos, audio o video al inglés, francés, alemán, italiano o chino con contexto organizacional preservado.",
        tags: ["5 idiomas", "Contexto preservado"],
    },
    {
        icon: <CheckSquareIcon />,
        num: "07",
        name: "Cuestionarios Inteligentes",
        desc: "Genera cuestionarios contextuales para acelerar levantamientos. Se adaptan al proceso, la audiencia y el objetivo del diagnóstico.",
        tags: ["PDF / DOCX", "Link distribuible"],
    },
    {
        icon: <MicIcon />,
        num: "08",
        name: "Grabación de Sesiones",
        desc: "Graba sesiones de trabajo en vivo y genera transcripciones, minutas y hallazgos estructurados de forma automática.",
        tags: ["Transcripción", "Minuta automática"],
    },
];

/** Inputs aceptados por todos los servicios */
export const serviceInputs: { icon: ReactNode; label: string }[] = [
    { icon: <TextInputIcon />, label: "Texto" },
    { icon: <DocumentIcon />, label: "Documento" },
    { icon: <AudioIcon />, label: "Audio" },
    { icon: <VideoIcon />, label: "Video" },
    { icon: <TargetIcon />, label: "Grabación en vivo" },
];

/** Fases del framework F-L-U-3-N-C-E */
export interface FrameworkPhase {
    dot: string;
    isPivot?: boolean;
    label: string;
    tag: string;
    title: string;
    desc: string;
    outputs: string[];
    transformFlow?: boolean;
}

export const frameworkPhases: FrameworkPhase[] = [
    {
        dot: "F",
        label: "Frame",
        tag: "Fase 01",
        title: "Frame",
        desc: "Define el contexto, los objetivos y los KPIs del proceso antes de cualquier diagnóstico. Sin claridad del marco, las recomendaciones no tienen ancla estratégica.",
        outputs: ["Contexto del proceso", "KPIs definidos", "Stakeholders mapeados"],
    },
    {
        dot: "L",
        label: "Listen",
        tag: "Fase 02",
        title: "Listen",
        desc: "Captura el proceso real mediante conversación, documentos o voz. La AI escucha, estructura y organiza sin formularios ni plantillas rígidas.",
        outputs: ["Transcripción estructurada", "Actividades identificadas", "Roles y sistemas"],
    },
    {
        dot: "U",
        label: "Understand",
        tag: "Fase 03",
        title: "Understand",
        desc: "Interpreta los datos capturados. Identifica brechas, dependencias críticas, riesgos operativos y oportunidades de mejora con criterio consultivo.",
        outputs: ["Diagnóstico As-Is", "Hallazgos priorizados", "Score de madurez"],
    },
    {
        dot: "3",
        isPivot: true,
        label: "Transform",
        tag: "Fase 04 — Pivote del framework",
        title: "Transform",
        desc: "El punto de inflexión. Lleva el proceso en tres oleadas: del estado actual al estado futuro deseado, y finalmente al estado automatizado e inteligente.",
        transformFlow: true,
        outputs: ["Proceso To-Be", "Quick wins", "Roadmap de automatización"],
    },
    {
        dot: "N",
        label: "Normalize",
        tag: "Fase 05",
        title: "Normalize",
        desc: "Estandariza los procesos mejorados. Genera políticas, manuales operativos y mejores prácticas documentadas automáticamente.",
        outputs: ["Manual de procesos", "Políticas corporativas", "Mejores prácticas"],
    },
    {
        dot: "C",
        label: "Control",
        tag: "Fase 06",
        title: "Control",
        desc: "Implementa gobierno operativo, métricas de seguimiento y alertas tempranas. Mide el impacto real de cada iniciativa con trazabilidad completa.",
        outputs: ["Dashboard de KPIs", "Alertas configuradas", "Compliance checks"],
    },
    {
        dot: "E",
        label: "Evolve",
        tag: "Fase 07",
        title: "Evolve",
        desc: "Mejora continua basada en datos reales. El sistema aprende de cada ciclo y genera nuevas hipótesis de optimización automáticamente.",
        outputs: ["Nuevas hipótesis", "Ciclo siguiente", "Memoria organizacional"],
    },
];

/** Capas de arquitectura del framework */
export const frameworkLayers: { num: string; name: string; sub: string; desc: string; mid?: boolean }[] = [
    {
        num: "01",
        name: "Foundation",
        sub: "AI Context Engine",
        desc: "Define objetivos, KPIs y contexto del negocio. La base que alimenta todo el framework.",
    },
    {
        num: "02",
        name: "Operating Framework",
        sub: "F-L-U-3-N-C-E",
        desc: "La lógica de transformación de 7 fases que convierte procesos en sistemas inteligentes.",
        mid: true,
    },
    {
        num: "03",
        name: "Ecosystem",
        sub: "AI · Automatización · Analytics",
        desc: "Herramientas integradas de AI, automatización e integraciones que ejecutan el framework.",
    },
];

/** Tabla comparativa de diferenciadores */
export type DiffValue = { kind: "yes" | "no" | "yes-muted"; text: string };

export const diffColumns = ["Consultoría tradicional", "AI genérica"];

export const diffRows: { feature: string; traditional: DiffValue; generic: DiffValue; flu3nce: DiffValue }[] = [
    {
        feature: "Tiempo al primer entregable",
        traditional: { kind: "no", text: "4–12 semanas" },
        generic: { kind: "no", text: "Minutos, sin estructura" },
        flu3nce: { kind: "yes", text: "Horas, con método" },
    },
    {
        feature: "Metodología estructurada",
        traditional: { kind: "yes-muted", text: "Sí, pero manual" },
        generic: { kind: "no", text: "No incluida" },
        flu3nce: { kind: "yes", text: "Embebida en cada herramienta" },
    },
    {
        feature: "Genera hipótesis y diagnósticos",
        traditional: { kind: "yes-muted", text: "El consultor, sí" },
        generic: { kind: "no", text: "No" },
        flu3nce: { kind: "yes", text: "Siempre" },
    },
    {
        feature: "Conocimiento que se acumula",
        traditional: { kind: "no", text: "Se va con el consultor" },
        generic: { kind: "no", text: "Sin memoria" },
        flu3nce: { kind: "yes", text: "RAG organizacional" },
    },
    {
        feature: "Escalable sin contratar",
        traditional: { kind: "no", text: "No" },
        generic: { kind: "yes-muted", text: "Parcialmente" },
        flu3nce: { kind: "yes", text: "Desde $25/mes" },
    },
    {
        feature: "Input por voz / audio / video",
        traditional: { kind: "no", text: "No" },
        generic: { kind: "no", text: "Limitado" },
        flu3nce: { kind: "yes", text: "Nativo" },
    },
];

/** Pilares de diferenciación */
export const diffPillars: { icon: ReactNode; title: string; desc: string }[] = [
    {
        icon: <BoxIcon />,
        title: "Hablas, Flu3nce estructura",
        desc: "No llenas formularios. Describes el proceso como lo harías con un colega y el sistema lo convierte en documentación lista para el cliente.",
    },
    {
        icon: <EditIcon />,
        title: "Tu conocimiento no se pierde",
        desc: "Cada proyecto queda en tu RAG empresarial. El próximo engagement arranca con ventaja — no desde cero.",
    },
    {
        icon: <TrendingUpIcon />,
        title: "Escala sin crecer el equipo",
        desc: "Un consultor con Flu3nce entrega lo que antes requería tres. Más proyectos en paralelo, sin sacrificar calidad metodológica.",
    },
];

/** Planes de precios */
export interface Plan {
    tier: string;
    price: string;
    priceCustom?: boolean;
    period?: string;
    profile: string;
    features: string[];
    ctaLabel: string;
    ctaHref: string;
    featured?: boolean;
}

export const plans: Plan[] = [
    {
        tier: "Pro",
        price: "$25",
        period: "USD / mes",
        profile: "Para consultores independientes",
        features: [
            "Framework F-L-U-3-N-C-E completo",
            "8 herramientas AI incluidas",
            "RAG metodológico Flu3nce",
            "1 espacio de trabajo",
            "Exportación PDF / DOCX / PPTX",
            "Soporte por chat",
        ],
        ctaLabel: "Empieza gratis",
        ctaHref: "/login",
    },
    {
        tier: "Max",
        price: "$100",
        period: "USD / mes",
        profile: "Para consultores avanzados y firmas pequeñas",
        features: [
            "Todo lo de Pro",
            "RAG empresarial personalizado",
            "Hasta 5 usuarios",
            "Proyectos ilimitados",
            "Grabación de sesiones en vivo",
            "Soporte prioritario",
        ],
        ctaLabel: "Empieza gratis",
        ctaHref: "/login",
        featured: true,
    },
    {
        tier: "Enterprise",
        price: "A la medida",
        priceCustom: true,
        profile: "Para firmas con necesidades específicas",
        features: [
            "Todo lo de Max",
            "Usuarios ilimitados",
            "Implementación y onboarding",
            "Integraciones personalizadas",
            "SLA garantizado",
            "Account manager dedicado",
        ],
        ctaLabel: "Contactar ventas",
        ctaHref: "mailto:hola@flu3nce.com",
    },
];

/** Columnas del footer */
export const footerColumns: { title: string; links: { label: string; href: string }[] }[] = [
    {
        title: "Producto",
        links: [
            { label: "Servicios", href: "#servicios" },
            { label: "Cómo funciona", href: "#como-funciona" },
            { label: "Planes", href: "#planes" },
            { label: "Changelog", href: "#" },
        ],
    },
    {
        title: "Recursos",
        links: [
            { label: "Documentación", href: "#" },
            { label: "Tutoriales", href: "#" },
            { label: "Academia", href: "#" },
            { label: "Blog", href: "#" },
        ],
    },
    {
        title: "Legal",
        links: [
            { label: "Términos de uso", href: "#" },
            { label: "Privacidad", href: "#" },
            { label: "Cookies", href: "#" },
        ],
    },
    {
        title: "Contacto",
        links: [
            { label: "hola@flu3nce.com", href: "mailto:hola@flu3nce.com" },
            { label: "LinkedIn", href: "#" },
            { label: "Twitter / X", href: "#" },
        ],
    },
];

/** Rutas a los assets de la landing (copiados a public/landing) */
export const ASSETS = {
    logoLight: "/landing/img/logo-fluence.svg",
    logoDark: "/landing/img/logo-fluence-white.svg",
    heroPoster: "/landing/img/hero-poster.jpg",
    heroVideoWebm: "/landing/video/hero-bg.webm",
    heroVideoMp4: "/landing/video/hero-bg-opt.mp4",
};
