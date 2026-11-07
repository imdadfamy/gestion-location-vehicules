-- Le logo du partenaire peut être un PNG, un JPEG ou un WebP (l'écran « Mon contrat » les accepte tous) :
-- le stockage des contrats n'autorisait que le PDF et le PNG, un JPEG était donc refusé à l'envoi.
update storage.buckets
set allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
where id = 'contract-assets';
