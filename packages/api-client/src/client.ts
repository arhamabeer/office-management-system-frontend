import type { ApiErrorShape, HealthStatus } from '@ems/types';

/** Framework-agnostic API client used by web and mobile (PLAN.md §4).
 *  Uses the global `fetch` (available in browsers, React Native, and Node ≥18). */

export interface ApiClientOptions {
  baseUrl: string;
  /** Return the current access token (mobile: Bearer). Web uses httpOnly cookies. */
  getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Send cookies (web). Use 'include' for the cookie-based flow. */
  credentials?: RequestCredentials;
  /** Called on a 401 so the caller can attempt a refresh / redirect to login. */
  onUnauthorized?: () => void | Promise<void>;
  /** Extra default headers. */
  defaultHeaders?: Record<string, string>;
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, error: ApiErrorShape) {
    super(error.message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

export class ApiClient {
  private readonly opts: ApiClientOptions;

  constructor(opts: ApiClientOptions) {
    this.opts = opts;
  }

  private buildUrl(path: string, query?: Query): string {
    const base = this.opts.baseUrl.replace(/\/$/, '');
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
    if (!query) return url;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) qs.append(k, String(v));
    }
    const s = qs.toString();
    return s ? `${url}?${s}` : url;
  }

  async request<T>(
    path: string,
    init: RequestInit & { query?: Query } = {},
  ): Promise<T> {
    const { query, headers, ...rest } = init;
    const token = this.opts.getAccessToken ? await this.opts.getAccessToken() : null;

    const res = await fetch(this.buildUrl(path, query), {
      credentials: this.opts.credentials,
      ...rest,
      headers: {
        Accept: 'application/json',
        ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...this.opts.defaultHeaders,
        ...headers,
      },
    });

    if (res.status === 401 && this.opts.onUnauthorized) {
      await this.opts.onUnauthorized();
    }

    const text = await res.text();
    const json = text ? JSON.parse(text) : undefined;

    if (!res.ok) {
      const err: ApiErrorShape = json?.error ?? {
        code: 'unknown_error',
        message: res.statusText || 'Request failed',
      };
      throw new ApiClientError(res.status, err);
    }

    // Success bodies are wrapped as `{ data }` (see backend httpResponse). Unwrap
    // by presence, not truthiness, so a legitimately falsy payload (null, 0, '',
    // false) is returned as-is instead of leaking the whole envelope object.
    if (json && typeof json === 'object' && 'data' in json) {
      return (json as { data: T }).data;
    }
    return json as T;
  }

  get<T>(path: string, query?: Query) {
    return this.request<T>(path, { method: 'GET', query });
  }
  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  }
  put<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
  }
  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
  }
  delete<T>(path: string, query?: Query) {
    return this.request<T>(path, { method: 'DELETE', query });
  }

  /** Convenience: the health endpoint (PLAN.md §8). */
  health() {
    return this.get<HealthStatus>('/api/v1/health');
  }
}
