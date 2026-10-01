# @ems/api-client

A small, typed, framework-agnostic API client (PLAN.md §4) used by the web and mobile apps instead
of hand-writing `fetch` calls. Uses the global `fetch` (browser / React Native / Node ≥18).

- Bearer-token hook (`getAccessToken`) for mobile; `credentials: 'include'` for the web cookie flow.
- `onUnauthorized` hook for refresh/redirect.
- Unwraps the `{ data }` envelope and throws a typed `ApiClientError` on `{ error }` (PLAN.md §8).

Endpoint methods per module are added in M1–M4; `health()` ships in M0.
