import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionEvent {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

// La Web Speech API es vendor-prefixed y no está en lib.dom; declaramos lo que usamos.
interface SpeechRecognition {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
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

const DENIED_MESSAGE = "Permiso de micrófono denegado.";

export const useSpeechRecognition = ({
    lang = "es-MX",
    continuous = true,
    interimResults = true,
    onResult,
    onError,
    onEnd,
}: UseSpeechRecognitionOptions = {}) => {
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const onResultRef = useRef(onResult);
    const onErrorRef = useRef(onError);
    const onEndRef = useRef(onEnd);

    onResultRef.current = onResult;
    onErrorRef.current = onError;
    onEndRef.current = onEnd;

    const isSupported = !!getSpeechRecognition();

    const createRecognition = useCallback(() => {
        const SpeechRecognitionCtor = getSpeechRecognition();
        if (!SpeechRecognitionCtor) return null;

        const recognition = new SpeechRecognitionCtor();
        recognition.lang = lang;
        recognition.continuous = continuous;
        recognition.interimResults = interimResults;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let transcript = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    transcript += result[0].transcript;
                }
            }
            if (transcript && onResultRef.current) {
                onResultRef.current(transcript);
            }
        };

        recognition.onend = () => {
            setIsListening(false);
            recognitionRef.current = null;
            onEndRef.current?.();
        };

        recognition.onerror = (event: { error: string }) => {
            if (event.error !== "aborted") {
                const message = event.error === "not-allowed" || event.error === "service-not-allowed"
                    ? DENIED_MESSAGE
                    : event.error === "no-speech"
                        ? "No se detectó voz. Comprueba el micrófono e inténtalo de nuevo."
                        : event.error === "audio-capture"
                            ? "No se encontró un micrófono disponible."
                            : event.error === "network"
                                ? "El servicio de dictado no respondió. Comprueba la conexión e inténtalo de nuevo."
                                : `Error de reconocimiento de voz: ${event.error}`;
                setError(message);
                onErrorRef.current?.(message);
            }
            setIsListening(false);
            recognitionRef.current = null;
        };

        return recognition;
    }, [lang, continuous, interimResults]);

    const stop = useCallback(() => {
        recognitionRef.current?.stop();
    }, []);

    const start = useCallback(() => {
        setError(null);

        // Clean up any previous instance
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch { /* ignore */ }
            recognitionRef.current = null;
        }

        // SpeechRecognition solicita su propio permiso. Un getUserMedia previo
        // puede fallar o quedarse esperando aunque el reconocimiento sí funcione.
        const recognition = createRecognition();
        if (!recognition) {
            const message = "El dictado no está disponible en este navegador.";
            setError(message);
            onErrorRef.current?.(message);
            return;
        }

        recognitionRef.current = recognition;

        try {
            recognition.start();
            setIsListening(true);
        } catch {
            const message = "No se pudo iniciar el reconocimiento de voz. Comprueba el permiso del micrófono e inténtalo de nuevo.";
            setError(message);
            onErrorRef.current?.(message);
            recognitionRef.current = null;
        }
    }, [createRecognition]);

    const toggle = useCallback(() => {
        if (isListening) {
            stop();
        } else {
            start();
        }
    }, [isListening, start, stop]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            recognitionRef.current?.stop();
            recognitionRef.current = null;
        };
    }, []);

    return { isListening, isSupported, error, start, stop, toggle };
};
