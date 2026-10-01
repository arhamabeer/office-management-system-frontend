import { ApiClient } from '@ems/api-client';
import { getAccessToken } from './authToken';

/** Shared API client for the web portal. Access token (in memory) is sent as a
 *  Bearer header; the refresh token travels as an httpOnly cookie
 *  (credentials: 'include'). */
export const api = new ApiClient({
  // Empty base = same-origin; /api/* is proxied to the backend (see next.config.mjs),
  // which keeps the refresh cookie first-party. Set NEXT_PUBLIC_API_URL only for a
  // separately-hosted API.
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
  credentials: 'include',
  getAccessToken: () => getAccessToken(),
});
