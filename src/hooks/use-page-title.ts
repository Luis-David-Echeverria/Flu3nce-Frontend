import { useEffect } from "react";

export const usePageTitle = (title: string) => {
    useEffect(() => {
        document.title = title ? `${title} — Flu3nce` : "Flu3nce";
        return () => {
            document.title = "Flu3nce";
        };
    }, [title]);
};
