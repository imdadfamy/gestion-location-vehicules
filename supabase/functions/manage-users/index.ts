import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const modules = new Set(['vehicles', 'clients', 'reservations', 'rentals', 'contracts', 'payments', 'deposits', 'inspections', 'maintenance', 'incidents', 'documents', 'notifications', 'reports', 'users', 'permissions', 'settings', 'contract_templates', 'activity_logs']);
const actions = new Set(['view', 'create', 'update', 'delete', 'validate']);

function normalizePermissions(input: unknown): Record<string, Record<string, boolean>> {
  if (input === undefined || input === null) return {};
  if (typeof input !== 'object' || Array.isArray(input)) throw new Error('Format de permissions invalide.');
  const result: Record<string, Record<string, boolean>> = {};
  for (const [module, value] of Object.entries(input as Record<string, unknown>)) {
    if (!modules.has(module) || typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`Module de permissions invalide : ${module}.`);
    const selected: Record<string, boolean> = {};
    for (const [action, allowed] of Object.entries(value as Record<string, unknown>)) {
      if (!actions.has(action) || typeof allowed !== 'boolean') throw new Error(`Action de permissions invalide : ${action}.`);
      if (allowed) selected[action] = true;
    }
    if (Object.keys(selected).length) result[module] = selected;
  }
  return result;
}
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) throw new Error('Authentification requise.');
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const callerClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) throw new Error('Session invalide.');
    const { data: caller, error: profileError } = await callerClient.from('profiles').select('role,is_active').eq('id', user.id).single();
    if (profileError || caller?.role !== 'super_admin' || !caller.is_active) throw new Error('Opération réservée à un Super Admin actif.');
    const body = await request.json();
    const admin = createClient(url, serviceKey);
    if (body.action === 'invite') {
      if (typeof body.email !== 'string' || !/^\S+@\S+\.\S+$/.test(body.email) || typeof body.full_name !== 'string' || !body.full_name.trim()) throw new Error('Nom complet et e-mail valides sont requis.');
      const permissions = normalizePermissions(body.permissions);
      const { data, error } = await admin.auth.admin.inviteUserByEmail(body.email, { data: { full_name: body.full_name } });
      if (error) throw new Error(error.message);
      const { error: updateError } = await admin.from('profiles').update({ full_name: body.full_name.trim(), email: body.email.trim().toLowerCase(), role: 'responsable', is_active: true, permissions }).eq('id', data.user.id);
      if (updateError) throw new Error(updateError.message);
      return Response.json({ user: data.user }, { headers: cors });
    }
    if (body.action === 'update') {
      if (typeof body.user_id !== 'string') throw new Error('Utilisateur requis.');
      if (typeof body.is_active !== 'boolean') throw new Error('Le statut actif doit être précisé.');
      const values = { is_active: body.is_active, permissions: normalizePermissions(body.permissions) };
      const { data, error } = await admin.from('profiles').update(values).eq('id', body.user_id).eq('role', 'responsable').select('id').maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Le compte Responsable demandé est introuvable.');
      return Response.json({ ok: true }, { headers: cors });
    }
    throw new Error('Action non prise en charge.');
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Erreur serveur.' }, { status: 400, headers: cors }); }
});
