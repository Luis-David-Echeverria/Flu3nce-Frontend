// src/components/custom/top-bar.tsx
import type { ReactNode } from "react";
import { Link } from "react-router";

export interface Breadcrumb {
    label: string;
    href?: string;
}

interface TopBarProps {
    breadcrumbs: Breadcrumb[];
    actions?: ReactNode;
}

export const TopBar = ({ breadcrumbs, actions }: TopBarProps) => {
    return (
        <header
            style={{
                background: "var(--fl-bg)",
                borderBottom: "1px solid var(--fl-divider)",
                height: 52,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 32px",
                flexShrink: 0,
                position: "sticky",
                top: 0,
                zIndex: 10,
            }}
        >
            {/* Breadcrumbs */}
            <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {breadcrumbs.map((crumb, i) => {
                    const isLast = i === breadcrumbs.length - 1;
                    return (
                        <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {i > 0 && (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            )}
                            {crumb.href && !isLast ? (
                                <Link
                                    to={crumb.href}
                                    style={{ fontSize: 13, color: "var(--fl-text-3)", textDecoration: "none", fontWeight: 500 }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--fl-text)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fl-text-3)")}
                                >
                                    {crumb.label}
                                </Link>
                            ) : (
                                <span style={{ fontSize: 13, fontWeight: isLast ? 600 : 500, color: isLast ? "var(--fl-text)" : "var(--fl-text-3)" }}>
                                    {crumb.label}
                                </span>
                            )}
                        </span>
                    );
                })}
            </nav>

            {/* Actions */}
            {actions && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{actions}</div>}
        </header>
    );
};
