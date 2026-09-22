import { Injectable, signal } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

const translations: Array<[RegExp, string]> = [
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
  [/row-level security|permission denied|not authorized/i, 'Vous ne disposez pas de l’autorisation nécessaire pour cette action.'],
  [/duplicate key|already exists/i, 'Un enregistrement avec ces informations existe déjà.'],
  [/violates.*not-null|null value/i, 'Veuillez renseigner tous les champs obligatoires.'],
  [/violates check constraint|check constraint/i, 'Les informations saisies ne respectent pas les règles de gestion.'],
  [/invalid login credentials/i, 'Adresse e-mail ou mot de passe incorrect.'],
  [/email not confirmed/i, 'Votre adresse e-mail doit être confirmée avant la connexion.'],
  [/network|fetch failed/i, 'La connexion au serveur a échoué. Vérifiez votre accès Internet puis réessayez.']
];

export function frenchError(value: unknown): string {
  const message = typeof value === 'string' ? value : (value as any)?.message ?? '';
  const found = translations.find(([pattern]) => pattern.test(message));
  return found?.[1] ?? (message ? 'Une erreur est survenue. Veuillez vérifier les informations saisies puis réessayer.' : 'Une erreur inattendue est survenue.');
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
  async load(){ const {data:{user}}=await this.client.auth.getUser(); if(user){const {data}=await this.client.from('profiles').select('*').eq('id',user.id).single(); this.profile.set(data);} }
  async logout(){await this.client.auth.signOut();this.profile.set(null);}
  can(module:string, action='view'){const p=this.profile(); return p?.role==='super_admin'||p?.permissions?.[module]?.[action]===true;}
  errorMessage(error: unknown){ return frenchError(error); }
  supabase(){return this.client;}
}
