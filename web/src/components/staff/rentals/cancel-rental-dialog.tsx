'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cancelRental } from '@/lib/data/rentals';
import { formatMoney } from '@/lib/data/public-catalog';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';

/**
 * Annule une location qui n'a pas commencé (statut « en attente ») : motif obligatoire, action définitive.
 * Commun à l'équipe et au partenaire ; les droits sont vérifiés côté serveur (docs/business-rules.md).
 * `received` : paiements déjà enregistrés (rappelé car l'application ne rembourse rien).
 */
export function CancelRentalDialog({
  rentalId,
  open,
  onOpenChange,
  received = 0,
  onDone,
}: {
  rentalId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  received?: number;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setError('');
    if (reason.trim().length < 3) return setError('Indiquez le motif de l’annulation (3 caractères au minimum).');
    setSaving(true);
    const { error: failure } = await cancelRental(createClient(), rentalId, reason.trim());
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    toast.success('Location annulée. Le motif est conservé dans l’historique.');
    setReason('');
    onOpenChange(false);
    onDone();
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Annuler cette location ?</AlertDialogTitle>
          <AlertDialogDescription>
            La location n’a pas encore commencé : elle passera à « Annulée » et le véhicule restera disponible sur ces dates. Cette action est définitive.
            Un contrat en attente de signature sera annulé (son lien de signature ne fonctionnera plus) ; un contrat déjà signé est conservé tel quel.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {received > 0 && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {formatMoney(received)} déjà enregistrés : l’application ne les rembourse pas et ne les modifie pas, à régler avec le client.
          </p>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="cancel-rental-reason">Motif (obligatoire)</Label>
          <Textarea
            id="cancel-rental-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ex. : le client a changé d’avis, véhicule indisponible…"
            rows={3}
            maxLength={500}
          />
        </div>
        <FormMessage error={error} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Retour</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={saving || reason.trim().length < 3}>
            {saving ? 'Annulation…' : 'Annuler la location'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
