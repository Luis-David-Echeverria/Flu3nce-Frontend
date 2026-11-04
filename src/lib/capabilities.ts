import type { CurrentUser } from "@/services/auth-service";

/** Missing metadata keeps legacy API discovery; a profile name never grants access. */
export function hasCapability(user: CurrentUser | null | undefined, name: string): boolean {
    return user?.capabilities === undefined || user.capabilities.includes(name);
}
