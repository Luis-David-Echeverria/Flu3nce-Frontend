/** Filas de una tabla: la primera es el encabezado. */
export type TableRows = string[][];

/** Lee el texto visible de cada celda de una tabla ya pintada. */
export function rowsFromTable(table: HTMLTableElement): TableRows {
    return Array.from(table.rows, (row) => Array.from(row.cells, (cell) => (cell.textContent ?? "").replace(/\s+/g, " ").trim()));
}

/** Texto separado por tabuladores: se pega en Excel o Sheets como celdas. */
export function toTsv(rows: TableRows): string {
    return rows.map((row) => row.map((cell) => cell.replace(/[\t\r\n]+/g, " ")).join("\t")).join("\n");
}

const NUMBER = /^-?\d+(?:[.,]\d+)*$/;

function csvCell(value: string): string {
    // Una celda que empieza como fórmula se abriría como fórmula en Excel; se guarda como texto.
    const guarded = /^[=+@\t\r]/.test(value) || (value.startsWith("-") && !NUMBER.test(value)) ? `'${value}` : value;
    return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** CSV con comas y saltos CRLF; el archivo descargado lleva BOM para que Excel lea los acentos. */
export function toCsv(rows: TableRows): string {
    return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function downloadCsv(rows: TableRows, fileName: string) {
    const url = URL.createObjectURL(new Blob([`\ufeff${toCsv(rows)}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Tabla en Markdown, para copiar una respuesta completa con su tabla. */
export function toMarkdownTable(columns: string[], rows: string[][]): string {
    const clean = (cell: string) => cell.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
    return [
        `| ${columns.map(clean).join(" | ")} |`,
        `| ${columns.map(() => "---").join(" | ")} |`,
        ...rows.map((row) => `| ${columns.map((_, index) => clean(row[index] ?? "")).join(" | ")} |`),
    ].join("\n");
}
