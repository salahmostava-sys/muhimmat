# نظام إدارة التوصيل — Delivery Management System

## Overview
A full-featured delivery management SPA (Single Page Application) built with React/TypeScript/Vite. Running on Replit. Uses Supabase exclusively for all backend needs (auth, PostgreSQL database, storage).

## Replit Setup
- **Run command**: `npm run dev` (Vite dev server on port 5000)
- **Env vars**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` configured in Replit environment
- **No server needed**: Pure frontend SPA — Supabase handles all backend logic via RLS policies

## Architecture
- **Frontend**: React 18 + TypeScript + Vite (port 5000)
- **Backend**: Supabase (no server-side code — pure frontend SPA)
- **Database**: PostgreSQL via Supabase (schema in `supabase/migrations/`)
- **Auth**: Supabase Auth with role-based access control
- **Styling**: Tailwind CSS + shadcn/ui components

## Features
- Role-based access: `admin`, `hr`, `finance`, `operations`, `viewer`
- Bilingual: Arabic (RTL) and English (LTR)
- Dark/Light theme
- Collapsible sidebar (64px collapsed / 260px expanded, state in localStorage)
- Dashboard (Overview tab): Employee analysis (city × license × sponsorship cross-filter), Orders by platform with target %, configurable Top-N leaderboard (per platform + overall), Comprehensive attendance section (today breakdown + 7-day chart)
- Dashboard (Analytics tab): 6-month trend chart, predictive projections for current month, "needs improvement" vs "improving" rider lists, platform MoM comparison, riders below average list

## Key Configuration
- **Supabase project ID**: `bumamlmemykmffxmtofk`
- **Secrets**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Replit Secrets
- **Smart secret detection**: `src/integrations/supabase/client.ts` auto-detects if secrets are swapped
- **Workflow**: `npm run dev` on port 5000, output type webview

## Project Structure
```
src/
├── App.tsx                    # Root router + lazy-loaded pages
├── main.tsx                   # React entry point
├── index.css                  # Tailwind + design system tokens
├── components/
│   ├── AppLayout.tsx           # Main layout with dynamic sidebar margin
│   ├── AppSidebar.tsx          # Collapsible sidebar navigation
│   ├── ProtectedRoute.tsx      # Auth guard
│   ├── ErrorBoundary.tsx       # Error boundary
│   ├── GlobalSearch.tsx        # Global search
│   ├── NotificationCenter.tsx  # Notifications
│   ├── StatCard.tsx            # Reusable stat card
│   ├── AlertsList.tsx          # Alerts list component
│   ├── NavLink.tsx             # Navigation link
│   ├── UserProfileModal.tsx    # User profile modal
│   ├── advances/               # Advance-specific components
│   ├── attendance/             # Attendance-specific components
│   ├── employees/              # Employee-specific components
│   ├── settings/               # Settings components
│   └── ui/                     # shadcn/ui base components
├── context/
│   ├── AuthContext.tsx          # Supabase auth + role
│   ├── LanguageContext.tsx      # Arabic/English toggle
│   ├── ThemeContext.tsx         # Dark/light theme
│   ├── SystemSettingsContext.tsx# Project name, logo from DB
│   └── MobileSidebarContext.tsx # Mobile sidebar open/close
├── hooks/
│   ├── use-toast.ts            # Toast notifications
│   ├── use-mobile.tsx          # Mobile breakpoint detection
│   ├── useAppColors.ts         # App brand colors from DB
│   ├── usePermissions.ts       # Role-based permission checks
│   └── useSignedUrl.ts         # Supabase storage signed URLs
├── pages/                      # All page components (lazy-loaded)
│   ├── Login.tsx / ForgotPassword.tsx / ResetPassword.tsx
│   ├── Dashboard.tsx           # Main dashboard with Overview + Analytics tabs
│   ├── Employees.tsx / Attendance.tsx / Orders.tsx
│   ├── Salaries.tsx / Advances.tsx / Fuel.tsx
│   ├── Motorcycles.tsx / VehicleAssignment.tsx
│   ├── Apps.tsx / Alerts.tsx
│   ├── Reports.tsx             # Reports center (Excel export)
│   ├── TradeRegisters.tsx      # Trade register management
│   ├── SalarySchemes.tsx / EmployeeTiers.tsx
│   ├── UsersAndPermissions.tsx / GeneralSettings.tsx
│   ├── ViolationResolver.tsx / ActivityLog.tsx
│   └── NotFound.tsx
├── i18n/
│   └── index.ts               # i18next config (Arabic/English translations)
├── integrations/supabase/
│   ├── client.ts              # Supabase client (with smart URL detection)
│   └── types.ts               # Auto-generated DB types
└── lib/
    ├── utils.ts               # Tailwind class merging (cn)
    ├── whatsapp.ts            # WhatsApp deep link helpers
    └── salarySlipTranslations.ts # Salary slip bilingual labels
```

## Design System — High-End Editorial Dashboard
- **Font**: IBM Plex Sans Arabic (replaces Cairo/Outfit) — loaded via Google Fonts in `index.html`
- **Primary color**: `#2642e6` (HSL 232 77% 52%) / Container: `#465fff`
- **Surface palette**: `surface #f9f9fb` (page), `surface-lowest #ffffff` (cards), `surface-low #f3f3f5` (sidebar), `surface-container #edeef0` (dividers/table heads)
- **On-surface**: `#1a1c1d` (text), `#444656` (muted/variant text)
- **Outline-variant**: `#c5c5d8` (subtle borders only when absolutely needed)
- **Card style**: `bg-white rounded-2xl shadow-card` — NO `border` classes on cards (use bg-color shifts)
- **Shadow**: `0px 10px 40px rgba(26,28,29,0.06)` mapped to Tailwind `shadow-card`
- **Sidebar**: `surface-low` (#f3f3f5) background. Active item: blue gradient pill `linear-gradient(135deg,#2642e6,#465fff)` with `shadow-brand-sm`
- **Header**: Glass morphism — `rgba(255,255,255,0.85)` + `backdrop-filter: blur(12px)` + `surface-container` bottom line
- **Primary CTA button**: `linear-gradient(135deg, #2642e6, #465fff)` with brand shadow
- **CSS variables**: All MD3 surface tokens as `--ds-surface*`, `--ds-on-surface*`, `--ds-primary`, etc. in `index.css` `:root`
- **Utility classes**: `.ds-card`, `.ds-btn--primary`, `.stat-card`, `.chart-card`, `.metric-card`, `.data-table`, `.ta-table-wrap`, etc.

## Routes
| Path | Page |
|------|------|
| `/login` | Login |
| `/` | Dashboard (Overview + Analytics tabs) |
| `/employees` | Employees management |
| `/attendance` | Attendance tracking |
| `/orders` | Daily orders |
| `/salaries` | Salary management |
| `/advances` | Advances/loans |
| `/motorcycles` | Vehicle management |
| `/vehicle-assignment` | Vehicle assignment |
| `/fuel` | Fuel logs |
| `/apps` | Delivery app management |
| `/alerts` | System alerts |
| `/reports` | Reports center |
| `/employee-tiers` | Employee tiers |
| `/violation-resolver` | Violation resolver |
| `/activity-log` | Activity log |
| `/settings/schemes` | Salary schemes |
| `/settings/users` | Users & permissions |
| `/settings/general` | General settings |


## User Preferences
- App was migrated from Lovable — preserve existing code structure
- No server-side code (Express, Drizzle, Neon) — Supabase handles everything
- Secrets may historically be swapped by user — client.ts handles this gracefully
