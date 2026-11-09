import type { Card } from "@/components/custom/consultation-deliverable-card";

/**
 * Lo que Flu3nce sabe hacer, como se ofrece en la bienvenida. Cada opción corresponde a un
 * tipo de entregable del contrato (o a conversar con los documentos) y solo escribe el inicio
 * de la petición en el compositor: el usuario la completa o adjunta sus archivos antes de enviar.
 */
export const WELCOME_CAPABILITIES: { prompt: string; type?: Card["deliverableType"] }[] = [
    { prompt: "Ayúdame a armar mi proceso", type: "understanding" },
    { prompt: "Ayúdame a dibujar el diagrama de mi proceso", type: "diagram_as_is" },
    { prompt: "Ayúdame a hacer el diagnóstico de mi proceso", type: "diagnostic" },
    { prompt: "Ayúdame a redactar una política", type: "policy_draft" },
    { prompt: "Ayúdame a analizar una política", type: "policy_analysis" },
    { prompt: "Ayúdame a preparar una presentación", type: "presentation" },
    { prompt: "Ayúdame a traducir un documento", type: "translation" },
    { prompt: "Ayúdame a transcribir una grabación", type: "transcription" },
    { prompt: "Ayúdame a encontrar algo en mis documentos" },
];
