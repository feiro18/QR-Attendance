import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond(405, { error: 'Method not allowed.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return respond(500, { error: 'Admin function is missing required Supabase secrets.' });
  }

  const authorization = request.headers.get('Authorization');
  const accessToken = authorization?.replace(/^Bearer\s+/i, '');
  if (!accessToken) return respond(401, { error: 'Sign in is required.' });

  const userClient = createClient(supabaseUrl, anonKey);
  const { data: { user: caller }, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !caller) return respond(401, { error: 'Your session is invalid or expired.' });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('role, active')
    .eq('id', caller.id)
    .maybeSingle();
  if (profileError) return respond(500, { error: profileError.message });
  if (callerProfile?.role !== 'admin' || !callerProfile.active) {
    return respond(403, { error: 'Administrator access is required.' });
  }

  let body: { action?: string; userId?: string };
  try {
    body = await request.json();
  } catch {
    return respond(400, { error: 'Request body must be valid JSON.' });
  }

  if (body.action === 'deactivate' || body.action === 'reactivate') {
    const targetId = body.userId;
    if (!targetId) return respond(400, { error: 'A user ID is required.' });
    if (targetId === caller.id) return respond(400, { error: 'You cannot deactivate your own account.' });

    const { data: target, error: targetError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', targetId)
      .maybeSingle();
    if (targetError) return respond(500, { error: targetError.message });
    if (!target) return respond(404, { error: 'Account was not found.' });
    if (target.role === 'admin') return respond(403, { error: 'Admin accounts cannot be changed here.' });

    const active = body.action === 'reactivate';
    const { data: updatedProfile, error: statusError } = await adminClient
      .from('profiles')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', targetId)
      .select('id')
      .maybeSingle();
    if (statusError) return respond(500, { error: statusError.message });
    if (!updatedProfile) return respond(404, { error: 'Account profile was not found.' });

    const { error: banError } = await adminClient.auth.admin.updateUserById(targetId, {
      ban_duration: active ? 'none' : '876000h',
    });
    if (banError) {
      const { error: rollbackError } = await adminClient
        .from('profiles')
        .update({ active: !active, updated_at: new Date().toISOString() })
        .eq('id', targetId);
      const rollbackDetail = rollbackError ? ` Profile status rollback failed: ${rollbackError.message}` : '';
      return respond(500, { error: `Could not update sign-in access: ${banError.message}.${rollbackDetail}` });
    }
    return respond(200, { success: true });
  }

  return respond(400, { error: 'Unknown admin action.' });
});
