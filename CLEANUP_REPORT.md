# Project Cleanup Report

## What Was Cleaned

- Removed duplicate Supabase migration that caused fresh-db conflicts.
- Reorganized project into top-level `backend/` and `frontend/`.
- Moved Supabase backend assets into `backend/supabase/`.
- Moved Vite/React app into `frontend/`.
- Reduced frontend route/page surface to core pages only.

## Removed Files/Folders

- `.replit`
- `replit.md`
- `frontend/src/test/`
- `frontend/src/pages/Advances.tsx`
- `frontend/src/pages/Alerts.tsx`
- `frontend/src/pages/Apps.tsx`
- `frontend/src/pages/EmployeeTiers.tsx`
- `frontend/src/pages/ForgotPassword.tsx`
- `frontend/src/pages/Fuel.tsx`
- `frontend/src/pages/GeneralSettings.tsx`
- `frontend/src/pages/MaintenanceLogs.tsx`
- `frontend/src/pages/Motorcycles.tsx`
- `frontend/src/pages/PlatformAccounts.tsx`
- `frontend/src/pages/ResetPassword.tsx`
- `frontend/src/pages/SalarySchemes.tsx`
- `frontend/src/pages/UsersAndPermissions.tsx`
- `frontend/src/pages/VehicleAssignment.tsx`
- `frontend/src/pages/ViolationResolver.tsx`
- `backend/supabase/migrations/20260323100000_locked_months.sql` (duplicate migration)

## Kept Files (Core)

- `backend/supabase/` (all backend migration/function logic retained except the duplicate migration)
- `backend/server.js`
- `backend/src/controllers/`
- `backend/src/routes/`
- `backend/src/models/`
- `backend/src/middlewares/`
- `backend/src/utils/`
- `backend/src/config/`
- `backend/documentation.md`
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/Employees.tsx`
- `frontend/src/pages/Orders.tsx`
- `frontend/src/pages/Attendance.tsx`
- `frontend/src/pages/Salaries.tsx`
- `frontend/src/pages/SettingsHub.tsx`

## Improvements

- Updated app routing to only expose required pages.
- Updated sidebar/menu structure to remove links to deleted pages.
- Simplified route title mapping to match the reduced navigation.

## Manual Review Required

- Verify `frontend` app startup from the new location (`frontend/`).
- Validate permissions (`PageGuard` keys) still map correctly to backend policy names.
- Review remaining service files in `frontend/src/services/` for further pruning (some may now be unused).
- If you want a runnable backend app (Express/Fastify), feature modules for Employees/Orders/Salary/Attendance/Platforms/Roles still need to be implemented in `backend/src/`.
