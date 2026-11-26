import createClient from 'openapi-fetch';
import type { paths as CorePaths } from '@/api/core';
import type { paths as IdentityPaths } from '@/api/identity';
import { session } from './session';

/** Same origin by default (Vite proxies /api to the gateway in development). */
const baseUrl = import.meta.env.VITE_API_BASE ?? '';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

/** Exchanges the refresh token for new tokens. One refresh at a time: refresh tokens are single-use. */
async function refreshTokens(): Promise<boolean> {
  const refreshToken = session.refreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const body = await res.json();
    session.save(body.data);
    return true;
  } catch {
    return false;
  }
}

function withToken(request: Request): Request {
  const token = session.accessToken();
  if (token) request.headers.set('Authorization', `Bearer ${token}`);
  return request;
}

/** Adds the access token; on 401 refreshes once and retries the request. */
async function authFetch(input: Request): Promise<Response> {
  const retry = input.clone();
  const response = await fetch(withToken(input));
  // Only a request that carried a token can have an expired one.
  if (response.status !== 401 || input.url.includes('/api/v1/auth/') || !session.refreshToken()) {
    return response;
  }
  refreshing ??= refreshTokens().finally(() => {
    refreshing = null;
  });
  if (await refreshing) return fetch(withToken(retry));
  session.clear();
  window.dispatchEvent(new Event('trinobil:session-expired'));
  return response;
}

export const core = createClient<CorePaths>({ baseUrl, fetch: authFetch });
export const identity = createClient<IdentityPaths>({ baseUrl, fetch: authFetch });

type Wrapped<D> = D extends { data?: infer T } ? T : never;

/**
 * Awaits an API call and returns the payload inside the server's `{ success, data }` envelope, or throws
 * an {@link ApiError} with the server's message.
 */
export async function call<D>(
  request: Promise<{ data?: D; error?: unknown; response: Response }>,
): Promise<Wrapped<D>> {
  let result: { data?: D; error?: unknown; response: Response };
  try {
    result = await request;
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection.');
  }
  const { data, error, response } = result;
  if (error !== undefined || !response.ok) {
    const body = (error ?? {}) as { message?: string; code?: string; errors?: { message?: string }[] };
    const detail = body.errors?.[0]?.message;
    throw new ApiError(
      detail ?? body.message ?? (response.status >= 500 ? 'Something went wrong. Try again.' : 'Request failed'),
      response.status,
      body.code,
    );
  }
  return (data as { data?: unknown } | undefined)?.data as Wrapped<D>;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Random key so a retried checkout never creates two invoices. */
export function idempotencyKey(): string {
  return crypto.randomUUID().replaceAll('-', '');
}

export function imageUrl(id?: string | null): string | undefined {
  return id ? `${baseUrl}/api/v1/core/public/images/${id}` : undefined;
}

/** Records a print / share done in this browser in the owner's activity log (best effort). */
export function reportActivity(
  action: 'PRINTED' | 'REPRINTED' | 'SHARED',
  entityType: string,
  entityId: string | undefined,
  label: string | undefined,
  details: Record<string, string>,
) {
  core
    .POST('/api/v1/core/activity/events', { body: { action, entityType, entityId, label, details } })
    .catch(() => undefined);
}
