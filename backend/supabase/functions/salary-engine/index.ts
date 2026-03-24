import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SalaryEngineRequest =
  | {
      mode: 'employee';
      employee_id: string;
      month_year: string;
      payment_method?: string;
      manual_deduction?: number;
      manual_deduction_note?: string | null;
    }
  | {
      mode: 'month';
      month_year: string;
      payment_method?: string;
    }
  | {
      mode: 'month_preview';
      month_year: string;
    };

const isValidMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const logInfo = (message: string, meta: Record<string, unknown> = {}) => {
  console.log(JSON.stringify({ level: 'info', message, ...meta, ts: new Date().toISOString() }));
};

const logError = (message: string, meta: Record<string, unknown> = {}) => {
  console.error(JSON.stringify({ level: 'error', message, ...meta, ts: new Date().toISOString() }));
};

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    // Caller context (RLS + role checks)
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user: callerUser },
    } = await callerClient.auth.getUser();
    if (!callerUser) throw new Error('Not authenticated');

    const { data: roleRows, error: roleError } = await callerClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id);
    if (roleError) throw roleError;

    const roles = new Set((roleRows || []).map((row: { role: string }) => row.role));
    if (!roles.has('admin') && !roles.has('finance')) {
      throw new Error('Only admin/finance can run salary engine');
    }

    const payload = (await req.json()) as SalaryEngineRequest;

    if (!payload?.month_year || !isValidMonth(payload.month_year)) {
      throw new Error('Invalid month_year format. Expected YYYY-MM');
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const mode = payload.mode;
    const rateLimitKey = `salary-engine:${callerUser.id}:${mode}`;
    const { data: rateLimitRows, error: rateLimitError } = await adminClient.rpc('enforce_rate_limit', {
      p_key: rateLimitKey,
      p_limit: 30,
      p_window_seconds: 60,
    } as Record<string, unknown>);
    if (rateLimitError) throw rateLimitError;

    const rate = Array.isArray(rateLimitRows)
      ? (rateLimitRows[0] as { allowed?: boolean; remaining?: number; reset_at?: string } | undefined)
      : undefined;

    if (!rate?.allowed) {
      logError('Rate limit exceeded', {
        request_id: requestId,
        user_id: callerUser.id,
        mode,
        month_year: payload.month_year,
      });
      return new Response(JSON.stringify({ error: 'Too many requests. Please retry shortly.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429,
      });
    }

    logInfo('Salary engine request accepted', {
      request_id: requestId,
      user_id: callerUser.id,
      mode,
      month_year: payload.month_year,
      remaining: rate.remaining ?? null,
    });

    if (payload.mode === 'employee') {
      if (!isUuid(payload.employee_id)) {
        throw new Error('Invalid employee_id');
      }

      const { data, error } = await adminClient.rpc('calculate_salary_for_employee_month', {
        p_employee_id: payload.employee_id,
        p_month_year: payload.month_year,
        p_payment_method: payload.payment_method || 'cash',
        p_manual_deduction: Number(payload.manual_deduction || 0),
        p_manual_deduction_note: payload.manual_deduction_note ?? null,
      } as Record<string, unknown>);

      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (payload.mode === 'month') {
      const { data, error } = await adminClient.rpc('calculate_salary_for_month', {
        p_month_year: payload.month_year,
        p_payment_method: payload.payment_method || 'cash',
      } as Record<string, unknown>);

      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (payload.mode === 'month_preview') {
      const { data, error } = await adminClient.rpc('preview_salary_for_month', {
        p_month_year: payload.month_year,
      } as Record<string, unknown>);

      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    throw new Error('Invalid mode. Use "employee", "month", or "month_preview"');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logError('Salary engine request failed', {
      request_id: requestId,
      error: message,
    });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
