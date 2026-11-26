import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { call, identity } from './api';
import { session, type SignedInUser } from './session';

type Auth = {
  user: SignedInUser | null;
  roles: string[];
  hasRole: (...roles: string[]) => boolean;
  /** Owner or manager: catalog, purchases, settings, activity log. */
  canManage: boolean;
  /** Owner, manager or accountant: reports, expenses, purchases. */
  isBackOffice: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SignedInUser | null>(() => (session.accessToken() ? session.user() : null));
  const queryClient = useQueryClient();

  useEffect(() => {
    const expired = () => {
      setUser(null);
      queryClient.clear();
    };
    window.addEventListener('trinobil:session-expired', expired);
    return () => window.removeEventListener('trinobil:session-expired', expired);
  }, [queryClient]);

  const signIn = useCallback(async (username: string, password: string) => {
    const tokens = await call(identity.POST('/api/v1/auth/login', { body: { username, password } }));
    session.save(tokens);
    setUser(tokens?.user ?? null);
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = session.refreshToken();
    if (refreshToken) {
      await identity.POST('/api/v1/auth/logout', { body: { refreshToken } }).catch(() => undefined);
    }
    session.clear();
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  const value = useMemo<Auth>(() => {
    const roles = user?.roles ?? [];
    const hasRole = (...r: string[]) => r.some((x) => roles.includes(x));
    return {
      user,
      roles,
      hasRole,
      canManage: hasRole('OWNER', 'MANAGER'),
      isBackOffice: hasRole('OWNER', 'MANAGER', 'ACCOUNTANT'),
      signIn,
      signOut,
    };
  }, [user, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
