import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatComposer } from "./chat-composer";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("compositor del chat", () => {
    it("deja un reintento discreto abajo cuando el servidor no devuelve modelos", () => {
        const retry = vi.fn();
        render(<ChatComposer id="model-off" value="" onChange={vi.fn()} onSubmit={vi.fn()} onAttach={vi.fn()} label="Mensaje" placeholder="Escribe" modelStatus={{ state: "unavailable", onRetry: retry }} />);
        expect(screen.queryByRole("combobox", { name: "Modelo de Flu3nce" })).not.toBeInTheDocument();
        expect(screen.getByText("No disponible").closest(".flu-chat-composer-toolbar")).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Reintentar consulta de modelos" }));
        expect(retry).toHaveBeenCalledOnce();
    });

    it("muestra solo el modelo seleccionado junto a las acciones inferiores", () => {
        const onChange = vi.fn();
        render(<ChatComposer id="model-on" value="" onChange={vi.fn()} onSubmit={vi.fn()} onAttach={vi.fn()} label="Mensaje" placeholder="Escribe" modelControls={{ catalog: { default: "gpt-5.4", models: [{ id: "gpt-5.4", label: "GPT-5.4", provider: "openai", default: true }, { id: "second", label: "Segundo modelo", provider: "other", default: false }] }, selected: "gpt-5.4", onChange }} />);
        const select = screen.getByRole("combobox", { name: "Modelo de Flu3nce" });
        expect(select).toHaveValue("gpt-5.4");
        expect(select.closest(".flu-chat-composer-toolbar")).not.toBeNull();
        expect(screen.queryByText("Modelo")).not.toBeInTheDocument();
        expect(screen.getByRole("option", { name: "GPT-5.4" })).toBeInTheDocument();
        fireEvent.change(select, { target: { value: "second" } });
        expect(onChange).toHaveBeenCalledWith("second");
    });

    it("deja escribir mientras Flu3nce trabaja, pero no envía hasta que termina", () => {
        const submit = vi.fn();
        const change = vi.fn();
        render(<ChatComposer id="busy-composer" value="Siguiente pregunta" onChange={change} onSubmit={submit} onAttach={vi.fn()} label="Mensaje" placeholder="Escribe" sendBlocked />);
        const box = screen.getByRole("textbox", { name: "Mensaje" });
        expect(box).toBeEnabled();
        fireEvent.change(box, { target: { value: "Siguiente pregunta, ampliada" } });
        expect(change).toHaveBeenCalledWith("Siguiente pregunta, ampliada");
        fireEvent.keyDown(box, { key: "Enter" });
        expect(submit).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeDisabled();
        expect(screen.getByText("Puedes seguir escribiendo; lo envías cuando Flu3nce termine")).toBeInTheDocument();
    });

    it("permite adjuntar y enviar con Enter sin eliminar Shift + Enter", () => {
        const submit = vi.fn();
        const attach = vi.fn();
        const change = vi.fn();
        render(<ChatComposer id="test-composer" value="Hola" onChange={change} onSubmit={submit} onAttach={attach} label="Mensaje" placeholder="Escribe" />);
        fireEvent.click(screen.getByRole("button", { name: "Adjuntar archivos" }));
        expect(attach).toHaveBeenCalledOnce();
        fireEvent.keyDown(screen.getByRole("textbox", { name: "Mensaje" }), { key: "Enter", shiftKey: true });
        expect(submit).not.toHaveBeenCalled();
        fireEvent.keyDown(screen.getByRole("textbox", { name: "Mensaje" }), { key: "Enter" });
        expect(submit).toHaveBeenCalledOnce();
    });

    it("agrega el dictado al borrador sin enviarlo automáticamente", async () => {
        let recognizer: FakeSpeechRecognition;
        class FakeSpeechRecognition {
            onresult: ((event: { resultIndex: number; results: Array<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null = null;
            onend: (() => void) | null = null;
            constructor() { recognizer = this; }
            start() {}
            stop() { this.onend?.(); }
            abort() {}
        }
        vi.stubGlobal("SpeechRecognition", FakeSpeechRecognition);
        const submit = vi.fn();
        const change = vi.fn();
        render(<ChatComposer id="dictation" value="Hola" onChange={change} onSubmit={submit} onAttach={vi.fn()} label="Mensaje" placeholder="Escribe" />);
        fireEvent.click(screen.getByRole("button", { name: "Iniciar dictado" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "Detener dictado" })).toHaveAttribute("aria-pressed", "true"));
        act(() => recognizer.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "mundo" } }] }));
        expect(change).toHaveBeenCalledWith("Hola mundo");
        expect(submit).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Detener dictado" }));
        expect(screen.getByRole("button", { name: "Iniciar dictado" })).toBeInTheDocument();
    });

    it("muestra varios archivos pendientes y permite quitarlos antes de enviar", () => {
        const submit = vi.fn();
        const remove = vi.fn();
        const files = [new File(["uno"], "proceso.pdf"), new File(["dos"], "entrevista.mp3")];
        render(<ChatComposer id="tray" value="" onChange={vi.fn()} onSubmit={submit} onAttach={vi.fn()} attachments={files} onRemoveAttachment={remove} label="Mensaje" placeholder="Escribe" />);
        expect(screen.getByLabelText("Archivos pendientes de enviar")).toHaveTextContent("proceso.pdf");
        expect(screen.getByLabelText("Archivos pendientes de enviar")).toHaveTextContent("entrevista.mp3");
        fireEvent.click(screen.getByRole("button", { name: "Quitar proceso.pdf" }));
        expect(remove).toHaveBeenCalledWith(0);
        fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));
        expect(submit).toHaveBeenCalledOnce();
    });

    it("conserva visible la terminación de un archivo largo", () => {
        const file = new File(["dato"], "Presentación de capacitación del proceso de vacaciones-v1.pdf");
        render(<ChatComposer id="long-file" value="" onChange={vi.fn()} onSubmit={vi.fn()} onAttach={vi.fn()} attachments={[file]} label="Mensaje" placeholder="Escribe" />);
        const name = screen.getByTitle(file.name);
        expect(name.querySelector(".flu-chat-attachment-name-end")).toHaveTextContent("ones-v1.pdf");
        expect(name.querySelector(".flu-chat-attachment-name-start")).toHaveClass("flu-chat-attachment-name-start");
    });

    it("sustituye enviar por detener y permite cancelar mientras el compositor está ocupado", () => {
        const submit = vi.fn();
        const stop = vi.fn();
        const common = { id: "running", value: "Otro mensaje", onChange: vi.fn(), onSubmit: submit, onAttach: vi.fn(), label: "Mensaje", placeholder: "Escribe" };
        const view = render(<ChatComposer {...common} disabled stopControl={{ onStop: stop }} />);
        expect(screen.queryByRole("button", { name: "Enviar mensaje" })).not.toBeInTheDocument();
        fireEvent.keyDown(screen.getByRole("textbox", { name: "Mensaje" }), { key: "Enter" });
        expect(submit).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Detener Flu3nce" }));
        expect(stop).toHaveBeenCalledOnce();
        view.rerender(<ChatComposer {...common} disabled stopControl={{ onStop: stop, requested: true }} />);
        expect(screen.getByRole("button", { name: "Deteniendo Flu3nce" })).toBeDisabled();
    });

    it("permite cancelar una subida mientras bloquea otro envío por botón y por Enter", () => {
        const submit = vi.fn(), cancel = vi.fn();
        render(<ChatComposer id="uploading" value="Otra petición" onChange={vi.fn()} onSubmit={submit} onAttach={vi.fn()} label="Mensaje" placeholder="Escribe" submitDisabled uploadControl={cancel} />);
        fireEvent.keyDown(screen.getByRole("textbox", { name: "Mensaje" }), { key: "Enter" });
        expect(submit).not.toHaveBeenCalled();
        expect(screen.queryByRole("button", { name: "Enviar mensaje" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Cancelar envío de archivos" }));
        expect(cancel).toHaveBeenCalledOnce();
    });

    it("explica cuando no se detectó voz en vez de detenerse en silencio", async () => {
        let recognizer: { onerror: ((event: { error: string }) => void) | null };
        class FakeSpeechRecognition {
            onerror: ((event: { error: string }) => void) | null = null;
            constructor() { recognizer = this; }
            start() {}
            stop() {}
            abort() {}
        }
        vi.stubGlobal("SpeechRecognition", FakeSpeechRecognition);
        render(<ChatComposer id="voice-error" value="" onChange={vi.fn()} onSubmit={vi.fn()} onAttach={vi.fn()} label="Mensaje" placeholder="Escribe" />);
        fireEvent.click(screen.getByRole("button", { name: "Iniciar dictado" }));
        act(() => recognizer.onerror?.({ error: "no-speech" }));
        expect(await screen.findByText(/No se detectó voz/)).toBeInTheDocument();
    });
});
