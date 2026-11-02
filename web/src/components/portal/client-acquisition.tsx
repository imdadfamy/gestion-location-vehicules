'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { AcquisitionField } from '@/components/site/acquisition-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { myRecord } from '@/lib/data/client-portal';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';

/** Le client indique (ou corrige) comment il a connu FIMA AUTO ; sert seulement aux statistiques de l'agence. */
export function ClientAcquisition({ profileId }: { profileId: string }) {
  const [source, setSource] = useState('');
  const [detail, setDetail] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [hasRecord, setHasRecord] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    myRecord(createClient(), profileId).then(({ data }) => {
      setHasRecord(!!data);
      setSource(data?.acquisition_source ?? '');
      setDetail(data?.acquisition_detail ?? '');
      setLoaded(true);
    });
  }, [profileId]);

  // Sans fiche client (profil pas encore complété), il n'y a rien à enregistrer.
  if (!loaded || !hasRecord) return null;

  async function save() {
    setError('');
    setSaving(true);
    const { error: failure } = await createClient().rpc('set_my_acquisition', { target_source: source || undefined, target_detail: detail || undefined });
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    toast.success('Merci, votre réponse est enregistrée.');
  }

  return (
    <Card>
      <CardContent className="grid gap-3">
        <div>
          <p className="font-medium">Comment nous avez-vous connus ?</p>
          <p className="text-sm text-muted-foreground">Facultatif. Cela nous aide à savoir où nous faire connaître.</p>
        </div>
        <AcquisitionField idPrefix="profile" source={source} detail={detail} onSourceChange={setSource} onDetailChange={setDetail} />
        <FormMessage error={error} />
        <Button variant="outline" className="justify-self-start" onClick={save} disabled={saving}>
          {saving && <Loader2 className="animate-spin" />} Enregistrer ma réponse
        </Button>
      </CardContent>
    </Card>
  );
}
