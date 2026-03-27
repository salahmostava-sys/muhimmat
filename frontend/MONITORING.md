# Frontend Monitoring

This project supports lightweight production monitoring through the centralized logger in `shared/lib/logger.ts`.

## Enable

Set this env var in deployment:

```env
VITE_MONITORING_ENDPOINT=https://logs.example.com/frontend-events
```

If the variable is empty, events are not sent externally.

## What is captured

- `logger.error(...)`
- `logger.warn(...)`
- Global runtime handlers installed in `app/main.tsx`:
  - `window.error`
  - `window.unhandledrejection`

## Payload contract

The logger sends JSON payloads with this shape:

```ts
type LogMeta = {
  level: 'error' | 'warn';
  message: string;
  payload: unknown; // Error serialized; may include `{ error, meta }` when meta is passed
  ts: string;       // ISO timestamp
  href: string;     // current page URL
};
```

`ErrorBoundary` reports `App crashed` with `meta` from `errorContextMeta`: `pathname`, optional `search`, `userId`, manifest `feature` (route id), and `routeGroup` when the path matches `routesManifest`.

## Transport

- Primary: `navigator.sendBeacon(...)`
- Fallback: `fetch(..., { keepalive: true })`

## Securing the receiving endpoint

The browser sends events with `Content-Type: application/json` to whatever URL you configure. Anyone who knows the URL can POST traffic unless the server rejects it.

Recommended for production:

- **Do not** use a public write-only URL without checks: add **authentication** (e.g. signed token in a header — set from a same-origin API route if you add one later), **rate limiting**, and **IP / WAF** rules where possible.
- Restrict **CORS** on the logging API so only your app origin is allowed, if the collector supports it.
- Treat payloads as **potentially sensitive** (URLs, error text, optional user id in meta); store and retain according to your privacy policy.

## Notes

- Logging must never throw; all transport errors are swallowed.
- Dev mode still prints to console for local debugging.
