import { useEffect, useRef, useState } from "react";

/** Anchos de la navegación, el contexto y el panel lateral, ajustados al tamaño de la ventana. */
export function useChatLayout() {
    const [navOpen, setNavOpen] = useState(() => window.innerWidth > 760);
    const [contextOpen, setContextOpen] = useState(false);
    const previousViewportWidth = useRef(window.innerWidth);
    const [navWidth, setNavWidth] = useState(274);
    const [contextWidth, setContextWidth] = useState(330);
    const [panelWidth, setPanelWidth] = useState(550);
    const [panelMaximized, setPanelMaximized] = useState(false);
    const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

    useEffect(() => {
        const onResize = () => {
            const width = window.innerWidth;
            if (previousViewportWidth.current > 760 && width <= 760) {
                setNavOpen(false);
                setContextOpen(false);
            }
            previousViewportWidth.current = width;
            setViewportWidth(width);
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const maxContextWidth = viewportWidth <= 1200 ? Math.floor(viewportWidth * .85) : Math.max(280, viewportWidth - (navOpen ? navWidth : 0) - 320);
    const maxPanelWidth = viewportWidth <= 940 ? viewportWidth : Math.max(360, viewportWidth - (navOpen ? navWidth : 0) - 320);
    return {
        navOpen, setNavOpen,
        contextOpen, setContextOpen,
        navWidth, setNavWidth,
        setContextWidth,
        setPanelWidth,
        panelMaximized, setPanelMaximized,
        viewportWidth,
        maxContextWidth,
        visibleContextWidth: Math.min(contextWidth, maxContextWidth),
        maxPanelWidth,
        visiblePanelWidth: Math.min(panelWidth, maxPanelWidth),
    };
}
