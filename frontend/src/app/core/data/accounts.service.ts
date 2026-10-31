import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';

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
    const error = result.error ?? (result.data?.error ? new Error(result.data.error) : null);
    return { data: result.data, error };
  }

  setPartnerAccess(userId: string, isActive: boolean) {
    return this.manage({ action: 'update_partner_access', user_id: userId, is_active: isActive });
  }
}
