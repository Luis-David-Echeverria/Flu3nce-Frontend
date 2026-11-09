import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionEvent {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

// La Web Speech API sigue usando prefijos en algunos navegadores.
interface SpeechRecognition {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onstart: (() => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onend: (() => void) | null;
    onerror: ((event: { error: string }) => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
}

interface UseSpeechRecognitionOptions {
    lang?: string;
    continuous?: boolean;
    interimResults?: boolean;
    onResult?: (transcript: string) => void;
    onError?: (error: string) => void;
    onEnd?: () => void;
}

const getSpeechRecognition = (): (new () => SpeechRecognition) | null => {
    if (typeof window === "undefined") return null;
    const speechWindow = window as unknown as { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition };
    return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
};

function errorMessage(code: string) {
    if (code === "not-allowed") return "No se permitió usar el micrófono. Revisa el permiso de este sitio en tu navegador y vuelve a intentarlo.";
    if (code === "service-not-allowed") return "El servicio de dictado no está habilitado en este navegador. Prueba desde Chrome o Safari; el permiso del micrófono no basta para activar ese servicio.";
    if (code === "no-speech") return "No se detectó voz. Comprueba el micrófono e inténtalo de nuevo.";
    if (code === "audio-capture") return "No se encontró un micrófono disponible. Comprueba que esté conectado y que otra aplicación no lo esté bloqueando.";
    if (code === "network") return "El servicio de dictado del navegador no respondió. Comprueba tu conexión o prueba desde otro navegador.";
    if (code === "language-not-supported") return "El servicio de dictado de este navegador no admite español de México.";
    return "No se pudo completar el dictado. Lo que ya escribiste se conserva; puedes volver a intentarlo.";
}

export const useSpeechRecognition = ({
    lang = "es-MX", continuous = true, interimResults = true, onResult, onError, onEnd,
}: UseSpeechRecognitionOptions = {}) => {
    const [phase, setPhase] = useState<"idle" | "starting" | "listening" | "stopping">("idle");
    const [interimTranscript, setInterimTranscript] = useState("");
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const phaseRef = useRef(phase);
    const interimRef = useRef("");
    const startupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const callbacks = useRef({ onResult, onError, onEnd });
    callbacks.current = { onResult, onError, onEnd };

    const clearStartupTimer = useCallback(() => {
        if (startupTimer.current !== null) clearTimeout(startupTimer.current);
        startupTimer.current = null;
    }, []);

    const changePhase = useCallback((next: typeof phase) => {
        phaseRef.current = next;
        setPhase(next);
    }, []);

    const start = useCallback(() => {
        // No sustituir una sesión que todavía está arrancando o terminando.
        if (recognitionRef.current) return;
        setError(null);
        setInterimTranscript("");
        interimRef.current = "";
        const failBeforeStart = (message: string) => { setError(message); callbacks.current.onError?.(message); };
        if (window.isSecureContext === false) {
            failBeforeStart("Para usar el micrófono, abre Flu3nce mediante una conexión HTTPS.");
            return;
        }
        const Recognition = getSpeechRecognition();
        if (!Recognition) {
            failBeforeStart("Este navegador no ofrece dictado. Abre Flu3nce en un navegador compatible, como Chrome o Safari.");
            return;
        }

        let recognition: SpeechRecognition;
        try { recognition = new Recognition(); }
        catch { failBeforeStart("El navegador no pudo iniciar el servicio de dictado."); return; }
        recognitionRef.current = recognition;
        recognition.lang = lang;
        recognition.continuous = continuous;
        recognition.interimResults = interimResults;
        const finalized = new Set<number>();
        const current = () => recognitionRef.current === recognition;
        const finish = (keepInterim: boolean) => {
            if (!current()) return;
            clearStartupTimer();
            recognitionRef.current = null;
            recognition.onstart = recognition.onresult = recognition.onend = recognition.onerror = null;
            const remaining = interimRef.current;
            interimRef.current = "";
            setInterimTranscript("");
            if (keepInterim && remaining) callbacks.current.onResult?.(remaining);
            changePhase("idle");
            callbacks.current.onEnd?.();
        };
        const fail = (message: string) => {
            if (!current()) return;
            setError(message);
            callbacks.current.onError?.(message);
            finish(true);
            try { recognition.abort(); } catch { /* Ya puede haber terminado. */ }
        };
        recognition.onstart = () => {
            if (!current() || phaseRef.current !== "starting") return;
            clearStartupTimer();
            changePhase("listening");
        };
        recognition.onresult = (event) => {
            if (!current()) return;
            const committed: string[] = [];
            const interim: string[] = [];
            for (let index = 0; index < event.results.length; index++) {
                const result = event.results[index];
                const text = result[0]?.transcript.trim();
                if (!text) continue;
                if (result.isFinal) {
                    if (!finalized.has(index)) { finalized.add(index); committed.push(text); }
                } else interim.push(text);
            }
            interimRef.current = interim.join(" ");
            setInterimTranscript(interimRef.current);
            if (committed.length) callbacks.current.onResult?.(committed.join(" "));
        };
        recognition.onend = () => {
            if (current() && !finalized.size && !interimRef.current && phaseRef.current !== "idle") {
                const message = phaseRef.current === "starting"
                    ? "El navegador cerró el dictado antes de activarlo. Revisa el permiso del micrófono o prueba desde otro navegador."
                    : "El dictado terminó sin recibir texto. Comprueba el micrófono y el servicio de voz de tu navegador e inténtalo de nuevo.";
                setError(message);
                callbacks.current.onError?.(message);
            }
            finish(true);
        };
        recognition.onerror = ({ error: code }) => {
            if (code === "aborted") finish(true);
            else fail(errorMessage(code));
        };
        changePhase("starting");
        // start() puede retornar sin llegar a abrir el servicio de voz del navegador.
        startupTimer.current = setTimeout(() => fail("El navegador no logró activar el dictado. Revisa el permiso del micrófono o prueba desde otro navegador."), 15000);
        try { recognition.start(); }
        catch { fail("No se pudo iniciar el dictado. Comprueba el permiso del micrófono e inténtalo de nuevo."); }
    }, [lang, continuous, interimResults, clearStartupTimer, changePhase]);

    const stop = useCallback(() => {
        const recognition = recognitionRef.current;
        if (!recognition || phaseRef.current === "stopping") return;
        clearStartupTimer();
        if (phaseRef.current === "starting") {
            // Cancelar el arranque también debe liberar el botón inmediatamente.
            changePhase("idle");
            recognition.onend?.();
            try { recognition.abort(); } catch { /* Ya puede haber terminado. */ }
            return;
        }
        changePhase("stopping");
        startupTimer.current = setTimeout(() => {
            recognition.onend?.();
            try { recognition.abort(); } catch { /* Conservar lo reconocido si no llega el cierre. */ }
        }, 3000);
        try { recognition.stop(); }
        catch {
            recognition.onend?.();
            try { recognition.abort(); } catch { /* Liberar la captura aunque falle stop(). */ }
        }
    }, [clearStartupTimer, changePhase]);

    useEffect(() => () => {
        clearStartupTimer();
        const recognition = recognitionRef.current;
        recognitionRef.current = null;
        if (recognition) {
            recognition.onstart = recognition.onresult = recognition.onend = recognition.onerror = null;
            try { recognition.abort(); } catch { /* No insertar resultados al salir del chat. */ }
        }
    }, [clearStartupTimer]);

    const toggle = useCallback(() => { if (phaseRef.current === "idle") start(); else stop(); }, [start, stop]);
    return { isListening: phase === "listening", isStarting: phase === "starting", isStopping: phase === "stopping", isActive: phase !== "idle", interimTranscript, isSupported: !!getSpeechRecognition(), error, start, stop, toggle };
};
