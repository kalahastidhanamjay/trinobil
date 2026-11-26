import type { components } from '@/api/identity';

export type SignedInUser = components['schemas']['UserSummary'];
type Tokens = components['schemas']['TokenResponse'];

const ACCESS = 'trinobil.access';
const REFRESH = 'trinobil.refresh';
const USER = 'trinobil.user';

/** Tokens and the signed-in user, kept in this browser. */
export const session = {
  accessToken: () => localStorage.getItem(ACCESS),
  refreshToken: () => localStorage.getItem(REFRESH),
  user(): SignedInUser | null {
    try {
      const raw = localStorage.getItem(USER);
      return raw ? (JSON.parse(raw) as SignedInUser) : null;
    } catch {
      return null;
    }
  },
  save(tokens: Tokens | undefined) {
    if (!tokens?.accessToken) return;
    localStorage.setItem(ACCESS, tokens.accessToken);
    if (tokens.refreshToken) localStorage.setItem(REFRESH, tokens.refreshToken);
    if (tokens.user) localStorage.setItem(USER, JSON.stringify(tokens.user));
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
    localStorage.removeItem(USER);
  },
};
