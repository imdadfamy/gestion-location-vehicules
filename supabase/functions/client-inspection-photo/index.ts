import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authorization = request.headers.get('Authorization'); if (!authorization) throw new Error('Authentification requise.');
    const url = Deno.env.get('SUPABASE_URL')!; const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await caller.auth.getUser(); if (userError || !user) throw new Error('Session invalide.');
    if (request.headers.get('content-type')?.includes('application/json')) {
      const body = await request.json(); const inspectionId = String(body.inspection_id ?? '');
      const { data: owner } = await admin.from('vehicle_inspections').select('id,rentals!inner(client_id,clients!inner(profile_id))').eq('id', inspectionId).eq('rentals.clients.profile_id', user.id).maybeSingle();
      if (!owner) throw new Error('Cette inspection ne vous appartient pas.');
      const { data: photos, error } = await admin.from('inspection_photos').select('*').eq('inspection_id', inspectionId).order('created_at'); if (error) throw error;
      const withUrls = await Promise.all((photos ?? []).map(async photo => { const signed = await admin.storage.from('inspection-photos').createSignedUrl(photo.storage_path, 300); return { ...photo, url: signed.data?.signedUrl ?? null }; }));
      return Response.json({ photos: withUrls }, { headers: cors });
    }
    const form = await request.formData(), inspectionId = String(form.get('inspection_id') ?? ''), photoType = String(form.get('photo_type') ?? ''), file = form.get('file');
    if (!inspectionId || !['front', 'rear', 'left_side', 'right_side', 'interior'].includes(photoType) || !(file instanceof File)) throw new Error('Photo invalide.');
    const { data: owner } = await admin.from('vehicle_inspections').select('id,rentals!inner(client_id,clients!inner(profile_id))').eq('id', inspectionId).eq('rentals.clients.profile_id', user.id).maybeSingle();
    if (!owner) throw new Error('Cette inspection ne vous appartient pas.');
    const path = `inspections/${inspectionId}/${photoType}-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const upload = await admin.storage.from('inspection-photos').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' }); if (upload.error) throw new Error(upload.error.message);
    const { error } = await admin.from('inspection_photos').insert({ inspection_id: inspectionId, photo_type: photoType, storage_path: path }); if (error) { await admin.storage.from('inspection-photos').remove([path]); throw new Error(error.message); }
    return Response.json({ ok: true, path }, { headers: cors });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Erreur serveur.' }, { status: 400, headers: cors }); }
});
