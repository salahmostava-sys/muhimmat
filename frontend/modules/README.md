# Modules Structure

This folder follows a domain-first structure for easier onboarding and ownership:

- `hr/` → employees, attendance, alerts, apps
- `finance/` → salaries, advances
- `operations/` → orders, vehicles, fuel, platform accounts, violation resolver
- `settings/` → system settings and profile

Implementation note:

- Legacy routes still live under `modules/pages/*` during migration.
- Domain indexes (`hr/index.ts`, `finance/index.ts`, `operations/index.ts`, `settings/index.ts`)
  are the stable entry points to avoid scattered imports.
