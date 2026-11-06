import type { CSSProperties, RefObject } from "react";
import { Link } from "react-router";
import type { Chat } from "@/services/v2/chats";
import type { V2Project } from "@/services/v2/projects";
import type { Theme } from "@/providers/theme-provider";
import { FluResizeHandle } from "./flu-resize-handle";
import { ChatIcon, ChevronIcon, FolderIcon, LogoutIcon } from "./flu-chats-icons";

type Props = {
    navOpen: boolean;
    navWidth: number;
    onNavWidthChange: (width: number) => void;
    onCloseBackdrop: () => void;
    onCollapse: () => void;
    closeButtonRef: RefObject<HTMLButtonElement | null>;
    onNewChat: () => void;
    chatSearch: string;
    onChatSearch: (value: string) => void;
    chatId: string;
    projectId: string;
    looseChats: Chat[];
    loading: boolean;
    unreadChats: Set<string>;
    onOpenChat: (chat: Chat, projectId?: string) => void;
    onViewAll: (projectId?: string) => void;
    projects: V2Project[];
    projectChats: Chat[];
    hasMoreProjectChats: boolean;
    expandedProjectId: string | null;
    onExpandProject: (projectId: string | null) => void;
    onOpenProject: (projectId: string) => void;
    onNewChatInProject: (projectId: string) => void;
    onCreateProject: () => void;
    account: {
        name: string;
        initial: string;
        email?: string;
        menuOpen: boolean;
        onToggleMenu: () => void;
        buttonRef: RefObject<HTMLButtonElement | null>;
        menuRef: RefObject<HTMLDivElement | null>;
        theme: Theme;
        onTheme: (theme: Theme) => void;
        memoryAvailable: boolean;
        onOpenMemory: () => void;
        showReferences: boolean;
        onToggleReferences: () => void;
        onLogout: () => void;
    };
};

/** Barra lateral del chat: chats sueltos, proyectos y la cuenta. */
export function FluChatSidebar({ navOpen, navWidth, onNavWidthChange, onCloseBackdrop, onCollapse, closeButtonRef, onNewChat, chatSearch, onChatSearch, chatId, projectId, looseChats, loading, unreadChats, onOpenChat, onViewAll, projects, projectChats, hasMoreProjectChats, expandedProjectId, onExpandProject, onOpenProject, onNewChatInProject, onCreateProject, account }: Props) {
    return <>
        {navOpen ? <button type="button" aria-label="Cerrar navegación" className="flu-mobile-backdrop" onClick={onCloseBackdrop} /> : null}
        <aside aria-label="Navegación de chats" aria-hidden={!navOpen} inert={!navOpen} className="flu-nav flex shrink-0 flex-col p-4" style={{ "--flu-nav-width": `${navWidth}px` } as CSSProperties}>
            <div className="flu-brand"><Link to="/flu" aria-label="Flu3nce, inicio"><img className="fl-logo-light" src="/landing/img/logo-fluence.svg" alt="Flu3nce" /><img className="fl-logo-dark" src="/landing/img/logo-fluence-white.svg" alt="" aria-hidden="true" /></Link><button ref={closeButtonRef} type="button" aria-label="Plegar navegación" title="Plegar navegación" onClick={onCollapse}>‹</button></div>
            <p className="flu-label">ESPACIO DE TRABAJO</p>
            <button type="button" onClick={onNewChat} className="flu-primary rounded-xl px-3 py-2.5 text-sm font-semibold text-white">＋ Nuevo chat</button>
            <label className="flu-search"><span aria-hidden="true">⌕</span><input aria-label="Buscar chats" value={chatSearch} onChange={(event) => onChatSearch(event.target.value)} placeholder="Buscar chats" /></label>
            <div className="flu-nav-list mt-5 flex min-h-0 flex-1 flex-col overflow-y-auto">
                <p className="flu-nav-heading">CHATS</p>
                {looseChats.length ? looseChats.slice(0, 10).map((chat) => <button key={chat.id} type="button" onClick={() => onOpenChat(chat)} className={`flu-chat-link ${chatId === chat.id ? "is-selected" : ""}`} title={unreadChats.has(chat.id) ? `${chat.title} · nueva respuesta` : chat.title}><ChatIcon /><span className="truncate">{chat.title}</span>{unreadChats.has(chat.id) ? <span className="flu-chat-unread-dot" title="Nueva respuesta de Flu3nce"><span className="sr-only">Nueva respuesta de Flu3nce</span></span> : null}</button>) : loading ? <div aria-label="Cargando chats" aria-busy="true" className="flu-chat-nav-skeleton"><div className="flu-chat-skeleton" /><div className="flu-chat-skeleton" /><div className="flu-chat-skeleton" /></div> : <p className="flu-nav-empty">{chatSearch ? "Sin coincidencias." : "Aún no hay chats aquí."}</p>}
                <button type="button" onClick={() => onViewAll()} className="flu-more">Ver todos los chats</button>
                <div className="flu-project-heading-row"><p className="flu-nav-heading with-space">PROYECTOS</p><button type="button" onClick={onCreateProject} aria-label="Crear proyecto" title="Crear proyecto">＋</button></div>
                {projects.map((project) => {
                    const expanded = expandedProjectId === project.id;
                    return <div key={project.id} className="flu-project-group"><div className={`flu-project-row ${projectId === project.id ? "flu-project-selected" : ""}`}><button type="button" aria-expanded={expanded} aria-controls={`project-chats-${project.id}`} onClick={() => { if (expanded) onExpandProject(null); else if (projectId === project.id) onExpandProject(project.id); else onOpenProject(project.id); }} className="flu-project-toggle min-w-0 flex-1 rounded-lg px-2 py-2 text-left text-sm" title={project.name}><ChevronIcon /><FolderIcon /><span className="truncate">{project.name}</span></button>{project.rol !== "lector" ? <button type="button" aria-label={`Nuevo chat en ${project.name}`} title={`Nuevo chat en ${project.name}`} onClick={() => onNewChatInProject(project.id)} className="flu-project-new">＋</button> : null}</div>{expanded && projectId === project.id ? <div id={`project-chats-${project.id}`} className="flu-project-chats">{projectChats.length ? projectChats.slice(0, 10).map((chat) => <button key={chat.id} type="button" onClick={() => onOpenChat(chat, project.id)} className={`flu-chat-link ${chatId === chat.id ? "is-selected" : ""}`} title={unreadChats.has(chat.id) ? `${chat.title} · nueva respuesta` : chat.title}><ChatIcon /><span className="truncate">{chat.title}{chat.shared ? " · compartido" : ""}</span>{unreadChats.has(chat.id) ? <span className="flu-chat-unread-dot" title="Nueva respuesta de Flu3nce"><span className="sr-only">Nueva respuesta de Flu3nce</span></span> : null}</button>) : <p className="flu-nav-empty">{loading ? "Cargando…" : "Aún no hay chats aquí."}</p>}{projectChats.length > 10 || hasMoreProjectChats ? <button type="button" onClick={() => onViewAll(project.id)} className="flu-more">Ver todos los chats</button> : null}</div> : null}</div>;
                })}
                <button type="button" onClick={() => onViewAll()} className="flu-more">Ver todos los proyectos</button>
            </div>
            <div className="flu-account-area">
                <button ref={account.buttonRef} type="button" className="flu-account-avatar" aria-label={`Abrir cuenta de ${account.name}`} aria-expanded={account.menuOpen} aria-controls="flu-account-menu" title={account.name} onClick={account.onToggleMenu}>{account.initial}</button>
                {account.menuOpen ? <div ref={account.menuRef} id="flu-account-menu" role="menu" aria-label="Cuenta" className="flu-account-menu">
                    <div className="flu-account-identity"><strong>{account.name}</strong>{account.email ? <span>{account.email}</span> : null}</div>
                    <div className="flu-account-theme" role="group" aria-label="Apariencia">
                        <span>Apariencia</span>
                        <div className="flu-account-theme-options">
                            {([ ["light", "Claro"], ["dark", "Oscuro"], ["system", "Sistema"] ] as const).map(([value, label]) => <button key={value} type="button" role="menuitemradio" aria-checked={account.theme === value} onClick={() => account.onTheme(value)}>{label}</button>)}
                        </div>
                    </div>
                    <button type="button" role="menuitem" disabled={!account.memoryAvailable} onClick={account.onOpenMemory}><span aria-hidden="true">⚙</span> Memoria</button>
                    <button type="button" role="menuitemcheckbox" aria-checked={account.showReferences} onClick={account.onToggleReferences}>Mostrar IDs de prueba {account.showReferences ? "✓" : ""}</button>
                    <button type="button" role="menuitem" onClick={account.onLogout}><LogoutIcon /> Cerrar sesión</button>
                </div> : null}
            </div>
            <FluResizeHandle label="Ajustar ancho de navegación" value={navWidth} min={220} max={480} direction={1} onChange={onNavWidthChange} />
        </aside>
    </>;
}
