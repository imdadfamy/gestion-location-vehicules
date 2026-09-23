import { Injectable, signal } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ActorNamesService {
  private readonly known = signal<Record<string, string>>({});

  constructor(private auth: AuthService) {}

  async load(ids: Array<string | null | undefined>) {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    const missing = unique.filter(id => !this.known()[id]);
    if (!missing.length) return;

    const result = await this.auth.supabase().rpc('get_staff_display_names', { target_ids: missing });
    if (result.error) return;

    const next = { ...this.known() };
    for (const row of result.data ?? []) next[row.id] = row.display_name;
    this.known.set(next);
  }

  label(id: string | null | undefined) {
    if (!id) return 'Système';
    return this.known()[id] ?? 'Utilisateur interne';
  }
}
