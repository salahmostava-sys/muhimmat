## System-Wide Consistency (Single Source of Truth)

This document is the **single source of truth** for architectural decisions in this React/Vite/Supabase project.

### Stack Rules (Strict)

#### Data Fetching & Caching
- **Server state**: `@tanstack/react-query` only.
- **Forbidden**: `useEffect`-driven data fetching patterns (fetch/axios) for server state.

#### UI Components & Styling
- **UI**: Tailwind CSS + `shadcn/ui` components.
- **Icons**: `lucide-react` only.
- **Forbidden**: inline styles (`style={{...}}`) and ad-hoc icon libraries.

#### Forms & Validation
- **Forms**: `react-hook-form` + `zod` (schema-first).
- **Forbidden**: `useState`-controlled data entry forms without a Zod schema.

#### Supabase Backend Logic
- **Simple reads/writes**: Supabase JS client directly.
- **Complex aggregation / reporting**: PostgreSQL SQL Functions (RPC).
- **Third-party integrations** (WhatsApp/webhooks/n8n): Supabase Edge Functions only.

#### State Management
- **Server state**: React Query.
- **Local component state**: `useState` / `useReducer`.
- **Global UI state** (only if needed): React Context or `zustand` (pick one per concern, avoid mixing managers).

### Code Organization Conventions
- **DB access** lives in `src/services/*Service.ts`.
- **Query hooks** live in `src/hooks/use*.ts` and call services, then return React Query results.
- **Pages/components** should not contain complex aggregation logic; move it to RPC/Edge/service layer.

