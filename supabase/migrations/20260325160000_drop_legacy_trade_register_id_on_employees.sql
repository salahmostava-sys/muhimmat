-- ============================================================================
-- Final cleanup: remove legacy employees.trade_register_id
-- ----------------------------------------------------------------------------
-- Preconditions:
-- - employees.company_id already exists and is backfilled.
-- - RLS policies already migrated to company_id.
-- ============================================================================

-- Keep company_id populated from legacy column before dropping it.
UPDATE public.employees
SET company_id = trade_register_id
WHERE company_id IS NULL
  AND trade_register_id IS NOT NULL;

-- Update dependent trigger function to use canonical company_id.
CREATE OR REPLACE FUNCTION public.fn_handle_employee_sponsorship_alerts()
RETURNS TRIGGER AS $$
DECLARE
  status TEXT;
  account_list TEXT;
  vehicle_plate_list TEXT;
  vehicle_count INT;
  trade_name TEXT;
  trade_cr TEXT;
  msg TEXT;
  accounts_json JSONB;
  vehicles_json JSONB;
  trade_json JSONB;
BEGIN
  status := NEW.sponsorship_status::TEXT;

  IF (NEW.sponsorship_status IS DISTINCT FROM OLD.sponsorship_status)
     AND (status IN ('absconded', 'terminated')) THEN

    IF status = 'terminated' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.platform_accounts WHERE employee_id = NEW.id
      ) THEN
        RETURN NEW;
      END IF;
    END IF;

    SELECT
      STRING_AGG(format('%s: %s', a.name, pa.account_username), ', ' ORDER BY a.name),
      COALESCE(JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'app', a.name,
          'username', pa.account_username,
          'account_id_on_platform', pa.account_id_on_platform,
          'iqama_number', pa.iqama_number
        )
      ), '[]'::jsonb)
    INTO account_list, accounts_json
    FROM public.platform_accounts pa
    JOIN public.apps a ON a.id = pa.app_id
    WHERE pa.employee_id = NEW.id;

    SELECT
      COUNT(*)::int,
      STRING_AGG(v.plate_number, ', ' ORDER BY v.plate_number),
      COALESCE(JSONB_AGG(
        JSONB_BUILD_OBJECT('vehicle_id', v.id, 'plate_number', v.plate_number)
      ), '[]'::jsonb)
    INTO vehicle_count, vehicle_plate_list, vehicles_json
    FROM public.vehicle_assignments va
    JOIN public.vehicles v ON v.id = va.vehicle_id
    WHERE va.employee_id = NEW.id
      AND va.end_date IS NULL
      AND va.returned_at IS NULL;

    SELECT
      tr.name,
      tr.cr_number,
      COALESCE(JSONB_BUILD_OBJECT(
        'company_id', tr.id,
        'name', tr.name,
        'cr_number', tr.cr_number,
        'notes', tr.notes
      ), '{}'::jsonb)
    INTO trade_name, trade_cr, trade_json
    FROM public.trade_registers tr
    WHERE tr.id = NEW.company_id;

    msg :=
      format(
        'الموظف: %s (الهوية: %s) | منصات: %s | مركبات: %s | سجل تجاري: %s',
        COALESCE(NEW.name, '—'),
        COALESCE(NEW.national_id, '—'),
        COALESCE(account_list, '—'),
        COALESCE(vehicle_plate_list, CASE WHEN vehicle_count IS NULL THEN '—' ELSE vehicle_count::TEXT || ' مركبة' END),
        COALESCE(trade_name, '—')
      );

    INSERT INTO public.alerts (
      type,
      entity_id,
      entity_type,
      due_date,
      message,
      details
    )
    VALUES (
      CASE WHEN status = 'absconded' THEN 'employee_absconded' ELSE 'employee_terminated' END,
      NEW.id,
      'employee',
      CURRENT_DATE,
      msg,
      JSONB_BUILD_OBJECT(
        'employee_id', NEW.id,
        'employee_name', NEW.name,
        'national_id', NEW.national_id,
        'sponsorship_status', status,
        'platform_accounts', accounts_json,
        'vehicle_count', COALESCE(vehicle_count, 0),
        'vehicle_plates', COALESCE(vehicle_plate_list, ''),
        'vehicles', vehicles_json,
        'trade_register', trade_json,
        'trade_cr_number', trade_cr
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove temporary sync layer introduced during transition.
DROP TRIGGER IF EXISTS trg_sync_employees_company_columns ON public.employees;
DROP FUNCTION IF EXISTS public.sync_employees_company_columns();

-- Remove legacy FK and column.
ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_trade_register_id_fkey;

ALTER TABLE public.employees
  DROP COLUMN IF EXISTS trade_register_id;
