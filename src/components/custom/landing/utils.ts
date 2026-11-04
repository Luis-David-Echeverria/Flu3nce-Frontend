import type { MouseEvent } from "react";

/**
 * Maneja clicks en enlaces ancla (#seccion) haciendo scroll suave hacia el destino,
 * sin tocar el historial ni recargar. Para enlaces que no son ancla, no hace nada.
 */
export function handleAnchorClick(e: MouseEvent<HTMLAnchorElement>) {
    const href = e.currentTarget.getAttribute("href");
    if (!href || !href.startsWith("#") || href === "#") return;
    const target = document.getElementById(href.slice(1));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
}
