import { useEffect, useState } from "react";
import type { ContractA } from "@/services/v2/types";
import { bpmnPipeline } from "./bpmn-editor/bpmn-pipeline";
import { BpmnPreview } from "./bpmn-editor/bpmn-preview";

/** Full read-only diagram, built from the selected version's Contract A on demand. */
export function FluDiagramPreview({ content }: { content: ContractA }) {
    const [state, setState] = useState<{ xml?: string; error?: string }>({});

    useEffect(() => {
        let active = true;
        setState({});
        void bpmnPipeline.generate(content, 0)
            .then(({ xml }) => { if (active) setState({ xml }); })
            .catch(() => { if (active) setState({ error: "No pude dibujar esta versión del diagrama. Puedes descargarla y volver a intentarlo." }); });
        return () => { active = false; };
    }, [content]);

    if (state.error) return <p role="alert" className="flu-diagram-error">{state.error}</p>;
    if (!state.xml) return <p role="status" className="flu-diagram-loading">Preparando el diagrama…</p>;
    return <div className="flu-diagram-view">
        <p>Arrastra para moverte · usa la rueda o el gesto de pellizcar para acercar</p>
        <div className="flu-diagram-canvas"><BpmnPreview xml={state.xml} controls /></div>
    </div>;
}
