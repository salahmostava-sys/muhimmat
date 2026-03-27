# Documentation index

| Document | Audience | Purpose |
|----------|----------|---------|
| [HANDOVER.md](./HANDOVER.md) | New maintainer / owner | Run, folder map, first files to read |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Engineers | Layers, aliases, Query/services rules |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Anyone changing code | Before PR checklist, where to put code |
| [ENV.md](./ENV.md) | Local dev / deploy | `VITE_*` Supabase vars, `.env.local`, Vercel |

Start with **HANDOVER.md**, then **ARCHITECTURE.md**, then **CONTRIBUTING.md**. Use **ENV.md** when wiring Supabase or fixing “missing env” errors.

The root [README.md](../README.md) describes product features and UX; these docs describe **how the repo is organized** for maintenance.

**Automation:** opening a pull request on GitHub loads **`.github/pull_request_template.md`** into the description.
