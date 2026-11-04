import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const generate = vi.hoisted(() => vi.fn());
const data = vi.hoisted(() => ({ schemaVersion: "contrato-a", processName: "Compras", lanes: [], nodes: [], edges: [] }));
const api = vi.hoisted(() => ({ getDeliverable: vi.fn(), getDeliverableJson: vi.fn(), getDeliverableVersionJson: vi.fn(), listDeliverableVersions: vi.fn(), saveDeliverableContent: vi.fn() }));
const getProject = vi.hoisted(() => vi.fn());
vi.mock("@/services/v2/projects", () => ({ getProject }));
vi.mock("@/services/v2/deliverables", () => ({ ...api, DeliverableConflictError: class extends Error {} }));
vi.mock("@/components/custom/bpmn-editor/bpmn-editor", async () => {
    const { forwardRef, useImperativeHandle } = await import("react");
    return { BpmnEditor: forwardRef((_props, ref) => { useImperativeHandle(ref, () => ({ generate, getContract: async () => data })); return <div>Canvas BPMN</div>; }) };
});
vi.mock("@/components/custom/bpmn-editor/pdf-export", () => ({ exportDiagramPdf: vi.fn() }));
vi.mock("@/components/custom/bpmn-editor/symbology-legend", () => ({ SymbologyLegend: () => null }));
import { BpmnEditorPage } from "./bpmn-editor";

beforeEach(() => {
    generate.mockReset().mockResolvedValue(undefined);
    getProject.mockReset().mockResolvedValue({ rol: "propietario" });
    api.getDeliverable.mockReset().mockResolvedValue({ id: "d1", type: "diagram_as_is", title: "Compras", currentVersion: 2 });
    api.getDeliverableJson.mockReset().mockResolvedValue(data);
    api.getDeliverableVersionJson.mockReset().mockResolvedValue(data);
    api.listDeliverableVersions.mockReset().mockResolvedValue({ current: "v2", versions: [{ id: "v1", number: 1 }, { id: "v2", number: 2 }] });
    api.saveDeliverableContent.mockReset().mockResolvedValue({ currentVersion: 3 });
});
afterEach(cleanup);
const open = (version: string) => render(<MemoryRouter initialEntries={[`/flu/diagrams/d1?project=p1&chat=c1&version=${version}`]}><Routes><Route path="/flu/diagrams/:deliverableId" element={<BpmnEditorPage />} /></Routes></MemoryRouter>);

describe("editor ligado al entregable del chat", () => {
    it("abre exactamente la versión histórica solicitada y no permite guardarla sobre la vigente", async () => {
        open("v1");
        await waitFor(() => expect(generate).toHaveBeenCalledWith(data));
        expect(api.getDeliverable).toHaveBeenCalledWith("p1", "d1");
        expect(api.getDeliverableVersionJson).toHaveBeenCalledWith("p1", "d1", "v1");
        expect(api.getDeliverableJson).not.toHaveBeenCalled();
        expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Volver al chat" })).toHaveAttribute("href", "/flu?chat=c1");
    });
    it("guarda la edición explícita de la vigente con su versión de concurrencia", async () => {
        open("v2");
        fireEvent.click(await screen.findByRole("button", { name: "Guardar" }));
        await waitFor(() => expect(api.saveDeliverableContent).toHaveBeenCalledWith("p1", "d1", data, 2));
    });
});
