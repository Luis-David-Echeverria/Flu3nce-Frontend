import { describe, expect, it } from "vitest";
import { hasCapability } from "./capabilities";

describe("capacidades efectivas", () => {
    it("no concede funciones por el nombre del perfil ni por una capacidad desconocida", () => {
        const user = { userId: "u1", profile: "lista_actual", capabilities: ["chat", "future_capability"] };
        expect(hasCapability(user, "chat")).toBe(true);
        expect(hasCapability(user, "stream")).toBe(false);
    });
    it("conserva el descubrimiento de API para servidores anteriores sin metadatos", () => {
        expect(hasCapability({ userId: "u1" }, "stream")).toBe(true);
        expect(hasCapability({ userId: "u1", capabilities: [] }, "stream")).toBe(false);
    });
});
