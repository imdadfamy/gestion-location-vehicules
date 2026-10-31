import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { edgeFunctionError } from './edge-function';

/**
 * Gestion des comptes via l'Edge Function `manage-users` (seule à détenir la clé
 * service_role, et réservée à un Super Admin actif).
 */
@Injectable({ providedIn: 'root' })
export class AccountsService {
  private auth = inject(AuthService);

  /** Appelle la fonction ; renvoie l'erreur éventuelle (réseau ou métier) et la réponse. */
  async manage(body: Record<string, unknown>) {
    const result = await this.auth.supabase().functions.invoke('manage-users', { body });
    return { data: result.data, error: await edgeFunctionError(result) };
  }

  /** Variante qui lève l'erreur, pour les écrans qui enchaînent dans un try/catch. */
  async run(body: Record<string, unknown>) {
    const result = await this.manage(body);
    if (result.error) throw result.error;
    return result.data;
  }

  setPartnerAccess(userId: string, isActive: boolean) {
    return this.manage({ action: 'update_partner_access', user_id: userId, is_active: isActive });
  }
}
