import { Outlet } from "react-router";

export const AppLayout = () => {
    return (
        <div className="flex h-dvh min-h-0 overflow-hidden bg-[color:var(--fl-bg)]">
            <Outlet />
        </div>
    );
};
