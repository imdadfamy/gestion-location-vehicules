import { Injectable, signal } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

const translations: Array<[RegExp, string]> = [
  [/Authentication is required|JWT expired|invalid JWT|session.*expired|not authenticated/i, 'Votre session a expiré. Connectez-vous de nouveau puis réessayez.'],
  [/Only a Super Admin|super.?admin.*required|requires.*super.?admin/i, 'Cette action est réservée au Super Admin.'],
  [/Only.*(secured backend|administrator)|cannot change account privileges/i, 'Cette modification de compte doit être effectuée par un Super Admin autorisé.'],
  [/inactive|is_active.*false|account.*disabled/i, 'Ce compte est désactivé. Contactez le Super Admin pour le réactiver.'],
  [/new row violates row-level security|row-level security|permission denied|not authorized|insufficient privilege|42501/i, 'Action refusée : vous ne disposez pas de la permission nécessaire pour cette opération.'],
  [/duplicate key|already exists|unique constraint|23505/i, 'Cette information existe déjà. Vérifiez les données saisies avant de réessayer.'],
  [/foreign key|23503/i, 'Cette opération est impossible car cet élément est encore lié à une autre information de l’application.'],
  [/not-null|null value|23502/i, 'Veuillez compléter tous les champs obligatoires signalés par un astérisque.'],
  [/invalid input syntax|invalid.*uuid|invalid.*date|22007|22P02/i, 'Une valeur saisie est invalide. Vérifiez les dates et les champs obligatoires.'],
  [/violates check constraint|check constraint|23514/i, 'Les informations saisies ne respectent pas les règles de gestion. Vérifiez les montants, dates et statuts.'],
  [/bucket.*not found|storage.*bucket/i, 'Le stockage des documents est indisponible. Réessayez ou contactez un administrateur.'],
  [/object.*not found|file.*not found|not found.*object/i, 'Le fichier demandé est introuvable ou a été supprimé.'],
  [/mime|file.*type|invalid.*file/i, 'Le type de fichier sélectionné n’est pas autorisé. Choisissez un document ou une image compatible.'],
  [/email.*already|user.*already|email.*registered/i, 'Cette adresse e-mail est déjà associée à un compte interne.'],
  [/password.*(weak|short)|password should/i, 'Le mot de passe ne respecte pas les exigences de sécurité.'],
  [/Rental status is calculated automatically/i, 'Le statut de la location est calculé automatiquement par le contrat, les inspections et l’échéance de retour.'],
  [/A rental must begin as draft or reserved/i, 'Une location est créée automatiquement avec le statut « En attente ».'],
  [/Reservation status is managed/i, 'Le statut de la réservation est géré automatiquement par son workflow.'],
  [/Reservation update is not permitted|Reservation finalization is not permitted/i, 'Vous ne disposez pas de l’autorisation nécessaire pour modifier ou finaliser cette réservation.'],
  [/Only a pending reservation can be (cancelled|finalized)/i, 'Seule une réservation en attente peut être annulée ou finalisée.'],
  [/Reservation does not exist/i, 'Cette réservation est introuvable.'],
  [/Reservation conflicts with an existing rental|Rental conflicts with an active reservation/i, 'Ce véhicule est déjà engagé par une location ou une réservation active sur cette période.'],
  [/Vehicle is not available for this reservation/i, 'Ce véhicule est indisponible pour cette réservation.'],
  [/Rental access is not permitted/i, 'Vous ne disposez pas de l’autorisation nécessaire pour consulter les locations.'],
  [/Payment confirmation is not permitted/i, 'Vous ne disposez pas de l’autorisation nécessaire pour confirmer ce paiement.'],
  [/Rental creation is not permitted/i, 'Vous ne disposez pas de l’autorisation nécessaire pour créer une location.'],
  [/Client creation is not permitted/i, 'Vous ne disposez pas de l’autorisation nécessaire pour créer ce client.'],
  [/Payment receipt choice is required/i, 'Veuillez choisir explicitement si le paiement a été reçu.'],
  [/Required client information is missing/i, 'Veuillez renseigner toutes les informations client obligatoires.'],
  [/Rental details are locked once|Rental details are locked after payment/i, 'Les informations de cette location sont verrouillées après son activation ou la confirmation du paiement.'],
  [/A partial payment already exists/i, 'Un paiement partiel existe déjà. Utilisez une correction comptable explicite pour finaliser la situation.'],
  [/Invalid rental status transition/i, 'Cette transition de statut de location n’est pas autorisée.'],
  [/overlap|conflict.*rental|exclusion constraint/i, 'Ce véhicule est déjà réservé sur cette période.'],
  [/vehicle.*maintenance|vehicle.*unavailable/i, 'Ce véhicule est indisponible ou en maintenance pour cette location.'],
  [/signed contract|contract.*immutable|immutable/i, 'Ce contrat signé ou finalisé ne peut plus être modifié.'],
  [/signature.*already exists|duplicate.*signature/i, 'Cette signature a déjà été enregistrée pour ce contrat.'],
  [/payment.*exceed|total.*payment/i, 'Le paiement dépasse le montant restant à encaisser.'],
  [/deposit.*(negative|inconsistent)|returned_amount|retained_amount/i, 'Les montants de caution sont incohérents.'],
  [/inspection vehicle must match/i, 'Le véhicule de l’inspection doit correspondre au véhicule de la location.'],
  [/departure inspection must precede/i, 'L’inspection de départ doit être réalisée avant l’activation de la location.'],
  [/return inspection requires/i, 'L’inspection de retour exige une location en cours ou en retard.'],
  [/invalid login credentials/i, 'Adresse e-mail ou mot de passe incorrect.'],
  [/email not confirmed/i, 'Votre adresse e-mail doit être confirmée avant la connexion.'],
  [/network|fetch failed/i, 'La connexion au serveur a échoué. Vérifiez votre accès Internet puis réessayez.']
];

export function frenchError(value: unknown): string {
  const error = value as any;
  const message = typeof value === 'string' ? value : error?.message ?? error?.error_description ?? error?.details ?? '';
  const found = translations.find(([pattern]) => pattern.test(message));
  if (found) return found[1];
  if (typeof message === 'string' && /[àâçéèêëîïôûùüÿñæœ]/i.test(message)) return message;
  if (typeof message === 'string' && /^(Veuillez|Sélectionnez|Saisissez|Aucun|Cette|Ce |Le |La |Les |Un |Une |Impossible|Erreur)/i.test(message)) return message;
  return message ? 'L’opération n’a pas pu être réalisée. Vérifiez les informations saisies et vos autorisations, puis réessayez.' : 'Une erreur inattendue est survenue. Réessayez dans quelques instants.';
}

const localizedFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const type = response.headers.get('content-type') ?? '';
  if (response.ok || !type.includes('application/json')) return response;
  try {
    const body = await response.clone().json();
    const original = body?.message ?? body?.msg ?? body?.error_description;
    if (!original) return response;
    const message = frenchError(original);
    return new Response(JSON.stringify({ ...body, message, msg: message, error_description: message }), { status: response.status, statusText: response.statusText, headers: response.headers });
  } catch { return response; }
};

@Injectable({providedIn:'root'})
export class AuthService {
  private config = (globalThis as any).__appConfig ?? environment;
  private client = createClient(this.config.supabaseUrl, this.config.supabaseAnonKey, { global: { fetch: localizedFetch } });
  profile = signal<any>(null); ready = signal(false);
  async init(){ const {data:{session}}=await this.client.auth.getSession(); if(session) await this.load(); this.ready.set(true); }
  async login(email:string,password:string){ const r=await this.client.auth.signInWithPassword({email,password}); if(!r.error) await this.load(); return r.error; }
  async load(){ const {data:{user}}=await this.client.auth.getUser(); if(user){const {data}=await this.client.from('profiles').select('*').eq('id',user.id).single(); this.profile.set(data ? { ...data, email: data.email ?? user.email } : null);} }
  async logout(){await this.client.auth.signOut();this.profile.set(null);}
  can(module:string, action='view'){const p=this.profile(); return p?.role==='super_admin'||p?.permissions?.[module]?.[action]===true;}
  errorMessage(error: unknown){ return frenchError(error); }
  supabase(){return this.client;}
}

