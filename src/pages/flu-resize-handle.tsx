import { useRef } from "react";

type Props = {
    label: string;
    value: number;
    min: number;
    max: number;
    direction: 1 | -1;
    onChange: (width: number) => void;
};

/** Keyboard- and pointer-accessible splitter. direction=1 grows to the right. */
export function FluResizeHandle({ label, value, min, max, direction, onChange }: Props) {
    const drag = useRef<{ pointerId: number; x: number; width: number } | null>(null);
    const clamp = (width: number) => Math.min(max, Math.max(min, width));
    const stopDrag = (element: HTMLElement) => {
        drag.current = null;
        element.closest(".flu-shell")?.classList.remove("is-resizing");
    };

    return <div
        role="separator"
        aria-label={label}
        aria-orientation="vertical"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={clamp(value)}
        tabIndex={0}
        className="flu-rail-resize-handle"
        onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            drag.current = { pointerId: event.pointerId, x: event.clientX, width: value };
            event.currentTarget.closest(".flu-shell")?.classList.add("is-resizing");
            event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
            if (drag.current?.pointerId !== event.pointerId) return;
            onChange(clamp(drag.current.width + (event.clientX - drag.current.x) * direction));
        }}
        onPointerUp={(event) => {
            if (drag.current?.pointerId !== event.pointerId) return;
            stopDrag(event.currentTarget);
            event.currentTarget.releasePointerCapture?.(event.pointerId);
        }}
        onPointerCancel={(event) => stopDrag(event.currentTarget)}
        onLostPointerCapture={(event) => stopDrag(event.currentTarget)}
        onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
            event.preventDefault();
            if (event.key === "Home") onChange(min);
            else if (event.key === "End") onChange(max);
            else onChange(clamp(value + (event.key === "ArrowRight" ? 1 : -1) * direction * (event.shiftKey ? 40 : 16)));
        }}
    />;
}
