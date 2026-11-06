import { useEffect, useRef, useState, type ReactNode } from "react";
import { Copy01, Download01 } from "@untitledui/icons";
import { downloadCsv, rowsFromTable, toTsv } from "@/lib/table-export";

/** Tabla de una respuesta con acciones para llevarla a Excel: copiar las celdas o bajar un CSV. */
export function ChatTable({ children, className }: { children: ReactNode; className?: string }) {
    const table = useRef<HTMLTableElement>(null);
    const [status, setStatus] = useState("");

    useEffect(() => {
        if (!status) return;
        const timer = window.setTimeout(() => setStatus(""), 2500);
        return () => window.clearTimeout(timer);
    }, [status]);

    const copy = async () => {
        if (!table.current) return;
        try {
            await navigator.clipboard.writeText(toTsv(rowsFromTable(table.current)));
            setStatus("Tabla copiada. Pégala en Excel o en tu documento.");
        } catch {
            setStatus("No se pudo copiar la tabla. Selecciónala y cópiala a mano.");
        }
    };

    const download = () => {
        if (!table.current) return;
        downloadCsv(rowsFromTable(table.current), "tabla-flu3nce.csv");
        setStatus("Descargaste la tabla en CSV.");
    };

    return <div className="flu-table-block">
        <div className="flu-table-scroll"><table ref={table} className={className}>{children}</table></div>
        <div className="flu-table-actions">
            <button type="button" onClick={() => void copy()}><Copy01 aria-hidden="true" />Copiar tabla</button>
            <button type="button" onClick={download}><Download01 aria-hidden="true" />Descargar CSV</button>
            <span role="status" className="flu-table-status">{status}</span>
        </div>
    </div>;
}
