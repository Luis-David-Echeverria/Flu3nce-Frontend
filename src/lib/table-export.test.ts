import { describe, expect, it } from "vitest";
import { rowsFromTable, toCsv, toMarkdownTable, toTsv } from "./table-export";

describe("exportar tablas de una respuesta", () => {
    it("lee las celdas visibles de la tabla pintada", () => {
        document.body.innerHTML = "<table><thead><tr><th>Paso</th><th>Responsable</th></tr></thead><tbody><tr><td>Solicitar\n compra</td><td>Compras</td></tr></tbody></table>";
        expect(rowsFromTable(document.querySelector("table")!)).toEqual([["Paso", "Responsable"], ["Solicitar compra", "Compras"]]);
    });

    it("separa con tabuladores para pegar en Excel", () => {
        expect(toTsv([["A", "B"], ["uno\tdos", "tres"]])).toBe("A\tB\nuno dos\ttres");
    });

    it("escribe CSV con comillas cuando hace falta y no deja pasar fórmulas", () => {
        expect(toCsv([["Monto", "Nota"], ["-1500", "Incluye, IVA"], ["=SUMA(A1)", "dice \"hola\""], ["-texto", "+1"]]))
            .toBe("Monto,Nota\r\n-1500,\"Incluye, IVA\"\r\n'=SUMA(A1),\"dice \"\"hola\"\"\"\r\n'-texto,'+1");
    });

    it("convierte una tabla del mensaje en Markdown", () => {
        expect(toMarkdownTable(["Área", "Dueño"], [["Compras | menores", "Ana"]])).toBe("| Área | Dueño |\n| --- | --- |\n| Compras \\| menores | Ana |");
    });
});
