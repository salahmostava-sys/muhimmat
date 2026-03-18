# نظام إدارة التوصيل — Delivery Management System

## Overview
A full-featured delivery management SPA (Single Page Application) built with React/TypeScript/Vite. Migrated from Lovable to Replit. Uses Supabase exclusively for all backend needs (auth, PostgreSQL database, storage).

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

## Design System
- **Brand color**: `#1a56db` = HSL `221 77% 48%`
- **CSS variables**: `--brand`, `--brand-light`, `--brand-dark`, `--success`, `--warning`, `--danger`, etc. (in `index.css` `:root`)
- **Utility classes**: `.ds-card`, `.ds-btn-primary`, `.stat-card`, `.chart-card`, `.metric-card`, `.data-table`, etc.

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
| `/settings/trade-registers` | Trade registers |

## User Preferences
- App was migrated from Lovable — preserve existing code structure
- No server-side code (Express, Drizzle, Neon) — Supabase handles everything
- Secrets may historically be swapped by user — client.ts handles this gracefully
