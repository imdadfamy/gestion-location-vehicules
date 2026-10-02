import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authorization = request.headers.get('Authorization'); if (!authorization) throw new Error('Authentification requise.');
    const url = Deno.env.get('SUPABASE_URL')!; const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await caller.auth.getUser(); if (userError || !user) throw new Error('Session invalide.');
    const { contract_id: contractId } = await request.json();
    const { data: contract } = await admin.from('contracts').select('final_pdf_storage_path,rentals!inner(clients!inner(profile_id))').eq('id', contractId).eq('rentals.clients.profile_id', user.id).maybeSingle();
    if (!contract?.final_pdf_storage_path) throw new Error('Ce contrat ne vous appartient pas ou son PDF est indisponible.');
    const signed = await admin.storage.from('contract-assets').createSignedUrl(contract.final_pdf_storage_path, 120);
    if (signed.error) throw new Error(signed.error.message);
    return Response.json({ signedUrl: signed.data.signedUrl }, { headers: cors });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Erreur serveur.' }, { status: 400, headers: cors }); }
});
