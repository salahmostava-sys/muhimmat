import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Verify caller is authenticated and is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: callerUser } } = await supabaseClient.auth.getUser();
    if (!callerUser) throw new Error('Not authenticated');

    // Check caller is admin
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id)
      .maybeSingle();

    if (roleData?.role !== 'admin') throw new Error('Only admins can update users');

    // Use service role to update user
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const {
      user_id,
      password,
      action,
    } = await req.json() as {
      user_id?: string;
      password?: string;
      action?: 'update_password' | 'revoke_session';
    };
    if (!user_id) throw new Error('user_id is required');
    if (!isUuid(user_id)) throw new Error('Invalid user_id');
    const normalizedAction = action ?? (password ? 'update_password' : undefined);
    if (!normalizedAction) throw new Error('action is required');

    const rateKey = `admin-update-user:${callerUser.id}`;
    const { data: rateRows, error: rateError } = await supabaseAdmin.rpc('enforce_rate_limit', {
      p_key: rateKey,
      p_limit: 10,
      p_window_seconds: 60,
    } as Record<string, unknown>);
    if (rateError) throw rateError;

    const rate = Array.isArray(rateRows)
      ? (rateRows[0] as { allowed?: boolean; remaining?: number } | undefined)
      : undefined;

    if (!rate?.allowed) {
      logError('Rate limit exceeded', {
        request_id: requestId,
        admin_user_id: callerUser.id,
        target_user_id: user_id,
      });
      return new Response(JSON.stringify({ error: 'Too many requests. Please retry shortly.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429,
      });
    }

    logInfo('Admin update user request accepted', {
      request_id: requestId,
      admin_user_id: callerUser.id,
      target_user_id: user_id,
      remaining: rate.remaining ?? null,
    });

    if (normalizedAction === 'revoke_session') {
      // Revoke all refresh tokens/sessions for target user.
      const authSchema = supabaseAdmin.schema('auth');
      const { error: refreshTokensError } = await authSchema
        .from('refresh_tokens')
        .delete()
        .eq('user_id', user_id);
      if (refreshTokensError) throw refreshTokensError;

      const { error: sessionsError } = await authSchema
        .from('sessions')
        .delete()
        .eq('user_id', user_id);
      if (sessionsError) throw sessionsError;
    } else if (normalizedAction === 'update_password') {
      if (!password) throw new Error('password is required for update_password');
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password });
      if (error) throw error;
    } else {
      throw new Error('Unsupported action');
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logError('Admin update user request failed', {
      request_id: requestId,
      error: message,
    });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
