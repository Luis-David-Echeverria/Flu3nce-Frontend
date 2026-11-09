import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSpeechRecognition } from "./use-speech-recognition";

type VoiceEvent = { resultIndex: number; results: Array<{ isFinal: boolean; 0: { transcript: string } }> };
const instances: FakeRecognition[] = [];
class FakeRecognition {
    lang = "";
    continuous = false;
    interimResults = false;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onresult: ((event: VoiceEvent) => void) | null = null;
    onerror: ((event: { error: string }) => void) | null = null;
    start = vi.fn();
    stop = vi.fn();
    abort = vi.fn();
    constructor() { instances.push(this); }
}
const words = (text: string, isFinal = false) => ({ isFinal, 0: { transcript: text } });
beforeEach(() => { instances.length = 0; vi.stubGlobal("SpeechRecognition", FakeRecognition); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("dictado del borrador", () => {
    it("solo dice que escucha cuando el navegador confirma el inicio", () => {
        const { result } = renderHook(() => useSpeechRecognition());
        act(() => result.current.start());
        expect(result.current.isStarting).toBe(true);
        expect(result.current.isListening).toBe(false);
        act(() => instances[0].onstart?.());
        expect(result.current.isStarting).toBe(false);
        expect(result.current.isListening).toBe(true);
    });

    it("actualiza las palabras provisionales y no duplica resultados finales repetidos", () => {
        const onResult = vi.fn();
        const { result } = renderHook(() => useSpeechRecognition({ onResult }));
        act(() => result.current.start());
        const recognition = instances[0];
        act(() => recognition.onresult?.({ resultIndex: 0, results: [words("prepara una")] }));
        expect(result.current.interimTranscript).toBe("prepara una");
        expect(onResult).not.toHaveBeenCalled();
        act(() => recognition.onresult?.({ resultIndex: 0, results: [words("prepara una política", true), words("de compras")] }));
        expect(onResult).toHaveBeenCalledExactlyOnceWith("prepara una política");
        expect(result.current.interimTranscript).toBe("de compras");
        act(() => recognition.onresult?.({ resultIndex: 0, results: [words("prepara una política", true), words("de compras", true)] }));
        expect(onResult.mock.calls).toEqual([["prepara una política"], ["de compras"]]);
        expect(result.current.interimTranscript).toBe("");
    });

    it("no abre varias capturas al pulsar de nuevo durante el arranque", () => {
        const { result } = renderHook(() => useSpeechRecognition());
        act(() => { result.current.start(); result.current.start(); });
        expect(instances).toHaveLength(1);
    });

    it("permite cancelar el arranque y descarta eventos tardíos de esa captura", () => {
        const onResult = vi.fn();
        const { result } = renderHook(() => useSpeechRecognition({ onResult }));
        act(() => result.current.start());
        const lateResult = instances[0].onresult;
        const lateEnd = instances[0].onend;
        act(() => result.current.stop());
        expect(instances[0].abort).toHaveBeenCalledOnce();
        expect(result.current.error).toBeNull();
        act(() => result.current.start());
        act(() => { lateResult?.({ resultIndex: 0, results: [words("otro chat", true)] }); lateEnd?.(); });
        expect(onResult).not.toHaveBeenCalled();
        expect(result.current.isStarting).toBe(true);
    });

    it("conserva lo reconocido cuando el navegador cierra sin mandar el resultado final", () => {
        const onResult = vi.fn();
        const { result } = renderHook(() => useSpeechRecognition({ onResult }));
        act(() => result.current.start());
        act(() => instances[0].onstart?.());
        act(() => instances[0].onresult?.({ resultIndex: 0, results: [words("texto que ya se veía")] }));
        act(() => result.current.stop());
        expect(result.current.isStopping).toBe(true);
        act(() => instances[0].onend?.());
        expect(onResult).toHaveBeenCalledExactlyOnceWith("texto que ya se veía");
        expect(result.current.isActive).toBe(false);
    });

    it("sale del arranque si el servicio no llega a responder", () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useSpeechRecognition());
        act(() => result.current.start());
        act(() => vi.advanceTimersByTime(15000));
        expect(result.current.isActive).toBe(false);
        expect(result.current.error).toContain("no logró activar el dictado");
        expect(instances[0].abort).toHaveBeenCalledOnce();
    });

    it("termina la captura si el navegador no confirma el cierre", () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useSpeechRecognition());
        act(() => result.current.start());
        act(() => instances[0].onstart?.());
        act(() => result.current.stop());
        act(() => vi.advanceTimersByTime(3000));
        expect(result.current.isActive).toBe(false);
        expect(instances[0].abort).toHaveBeenCalledOnce();
    });

    it("distingue el servicio de voz no habilitado de un permiso de micrófono denegado", () => {
        const { result } = renderHook(() => useSpeechRecognition());
        act(() => result.current.start());
        act(() => instances[0].onerror?.({ error: "service-not-allowed" }));
        expect(result.current.error).toContain("servicio de dictado no está habilitado");
        act(() => result.current.start());
        act(() => instances[1].onerror?.({ error: "not-allowed" }));
        expect(result.current.error).toContain("No se permitió usar el micrófono");
    });

    it("aborta al salir y no escribe resultados en otro compositor", () => {
        const onResult = vi.fn();
        const { result, unmount } = renderHook(() => useSpeechRecognition({ onResult }));
        act(() => result.current.start());
        const lateResult = instances[0].onresult;
        unmount();
        expect(instances[0].abort).toHaveBeenCalledOnce();
        act(() => lateResult?.({ resultIndex: 0, results: [words("texto tardío", true)] }));
        expect(onResult).not.toHaveBeenCalled();
    });
    it("explica un cierre sin texto en vez de aparentar que el dictado funcionó", () => {
        const { result } = renderHook(() => useSpeechRecognition());
        act(() => result.current.start());
        act(() => instances[0].onstart?.());
        act(() => instances[0].onend?.());
        expect(result.current.isActive).toBe(false);
        expect(result.current.error).toContain("terminó sin recibir texto");
    });

    it("explica si el navegador cierra el servicio sin llegar a abrirlo", () => {
        const { result } = renderHook(() => useSpeechRecognition());
        act(() => result.current.start());
        act(() => instances[0].onend?.());
        expect(result.current.isActive).toBe(false);
        expect(result.current.error).toContain("antes de activarlo");
    });

});
