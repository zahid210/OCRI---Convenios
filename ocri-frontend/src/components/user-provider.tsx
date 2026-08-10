'use client';

import { createContext, useContext } from 'react';
import type { CurrentUser } from '@/lib/auth';

const UserContext = createContext<CurrentUser | null>(null);

/**
 * Provee el usuario actual a los componentes del dashboard.
 * El valor se lee en el LAYOUT (server component) desde la cookie `user`, así
 * server y cliente reciben exactamente el mismo valor y no hay hydration mismatch.
 */
export function UserProvider({
    user,
    children,
}: {
    user: CurrentUser | null;
    children: React.ReactNode;
}) {
    return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser(): CurrentUser | null {
    return useContext(UserContext);
}
