// In-memory access token (never persisted — the refresh token lives in an
// httpOnly cookie). The API client reads it via getAccessToken().
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
