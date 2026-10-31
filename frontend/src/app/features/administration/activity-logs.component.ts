import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { ActorNamesService } from '../../core/actor-names.service';

export interface ActivityLogsComponent {
  toggle(id: string): void;
}

@Component({
  standalone: true,
  imports: [DatePipe, FormsModule],
  styleUrl: './activity-logs.component.scss',
  templateUrl: './activity-logs.component.html',
})
export class ActivityLogsComponent implements OnInit {
  rows = signal<any[]>([]);
  error = signal('');
  loading = signal(false);
  loadingMore = signal(false);
  hasMore = signal(false);
  query = '';
  module = '';
  action = '';
  userFilter = '';
  dateFrom = '';
  dateTo = '';
  expanded = signal<string | null>(null);
  clientsMap = signal<Record<string, string>>({});
  vehiclesMap = signal<Record<string, string>>({});
  private pageSize = 200;
  modules = [
    ['profiles', 'Utilisateurs'],
    ['clients', 'Clients'],
    ['vehicles', 'Véhicules'],
    ['rentals', 'Locations'],
    ['contracts', 'Contrats'],
    ['contract_templates', 'Modèles'],
    ['contract_template_versions', 'Versions'],
    ['contract_signatures', 'Signatures'],
    ['payments', 'Paiements'],
    ['deposits', 'Cautions'],
    ['vehicle_inspections', 'Inspections'],
    ['vehicle_maintenance', 'Maintenance'],
    ['incidents', 'Incidents'],
  ].map(([key, label]) => ({ key, label }));

  constructor(
    private auth: AuthService,
    private actors: ActorNamesService,
  ) {}

  async ngOnInit() {
    this.loading.set(true);
    const logs = await this.auth
      .supabase()
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(0, this.pageSize - 1);
    this.loading.set(false);
    const data = logs.data ?? [];
    this.rows.set(data);
    this.hasMore.set(data.length === this.pageSize);
    this.error.set(logs.error ? this.auth.errorMessage(logs.error) : '');
    await this.actors.load(data.map((entry) => entry.user_id));
    await this.resolveRefs(data);
  }

  async loadMore() {
    this.loadingMore.set(true);
    const from = this.rows().length;
    const logs = await this.auth
      .supabase()
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + this.pageSize - 1);
    this.loadingMore.set(false);
    if (logs.error) {
      this.error.set(this.auth.errorMessage(logs.error));
      return;
    }
    const data = logs.data ?? [];
    this.rows.set([...this.rows(), ...data]);
    this.hasMore.set(data.length === this.pageSize);
    await this.actors.load(data.map((entry) => entry.user_id));
    await this.resolveRefs(data);
  }

  private async resolveRefs(entries: any[]) {
    const clientIds = new Set<string>();
    const vehicleIds = new Set<string>();
    for (const e of entries) {
      const v = e.new_values ?? e.old_values ?? {};
      if (v.client_id) clientIds.add(v.client_id);
      if (v.vehicle_id) vehicleIds.add(v.vehicle_id);
    }
    const missingClients = [...clientIds].filter((id) => !this.clientsMap()[id]);
    const missingVehicles = [...vehicleIds].filter((id) => !this.vehiclesMap()[id]);
    if (missingClients.length) {
      const r = await this.auth
        .supabase()
        .from('clients')
        .select('id,first_name,last_name')
        .in('id', missingClients);
      if (!r.error) {
        const next = { ...this.clientsMap() };
        for (const row of r.data ?? [])
          next[row.id] = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || 'Client';
        this.clientsMap.set(next);
      }
    }
    if (missingVehicles.length) {
      const r = await this.auth
        .supabase()
        .from('vehicles')
        .select('id,registration_number,make,model')
        .in('id', missingVehicles);
      if (!r.error) {
        const next = { ...this.vehiclesMap() };
        for (const row of r.data ?? [])
          next[row.id] =
            row.registration_number || `${row.make ?? ''} ${row.model ?? ''}`.trim() || 'Véhicule';
        this.vehiclesMap.set(next);
      }
    }
  }

  reset() {
    this.query = '';
    this.module = '';
    this.action = '';
    this.userFilter = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.expanded.set(null);
  }

  visible() {
    const q = this.query.trim().toLowerCase();
    const from = this.dateFrom ? new Date(this.dateFrom + 'T00:00:00') : null;
    const to = this.dateTo ? new Date(this.dateTo + 'T23:59:59') : null;
    return this.rows().filter((e) => {
      if (this.module && e.entity_type !== this.module) return false;
      if (this.action && e.action !== this.action) return false;
      if (this.userFilter && e.user_id !== this.userFilter) return false;
      const created = new Date(e.created_at);
      if (from && created < from) return false;
      if (to && created > to) return false;
      if (
        q &&
        !`${this.userLabel(e.user_id)} ${this.moduleLabel(e.entity_type)} ${this.plainSentence(e)}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }

  groupedVisible() {
    const map = new Map<string, any[]>();
    for (const e of this.visible()) {
      const key = String(e.created_at).slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return [...map.entries()].map(([key, entries]) => ({ label: this.dayLabel(key), entries }));
  }

  private dayLabel(key: string) {
    const date = new Date(key + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.getTime() === today.getTime()) return 'Aujourd’hui';
    if (date.getTime() === yesterday.getTime()) return 'Hier';
    const label = date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  userOptions() {
    const seen = new Map<string, string>();
    for (const e of this.rows())
      if (e.user_id && !seen.has(e.user_id)) seen.set(e.user_id, this.userLabel(e.user_id));
    return [...seen.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }

  userLabel(id: string | null) {
    return this.actors.label(id);
  }
  moduleLabel(type: string) {
    return this.modules.find((x) => x.key === type)?.label ?? 'Autre';
  }
  tone(value: string) {
    return (
      ({ INSERT: 'success', UPDATE: 'primary', DELETE: 'danger' } as any)[value] ?? 'secondary'
    );
  }
  private values(e: any) {
    return e.new_values ?? e.old_values ?? {};
  }

  private entityPhrase(e: any) {
    const v = this.values(e);
    switch (e.entity_type) {
      case 'clients':
        return `le client <strong>${[v.first_name, v.last_name].filter(Boolean).join(' ') || 'sans nom'}</strong>`;
      case 'vehicles':
        return `le véhicule <strong>${v.registration_number || [v.make, v.model].filter(Boolean).join(' ') || 'sans immatriculation'}</strong>`;
      case 'rentals':
        return `la location de <strong>${this.clientsMap()[v.client_id] ?? 'un client'}</strong> (${this.vehiclesMap()[v.vehicle_id] ?? 'véhicule'})`;
      case 'contracts':
        return `le contrat <strong>${v.contract_number || ''}</strong>`;
      case 'payments':
        return `un paiement de <strong>${this.money(v.amount)}</strong>`;
      case 'deposits':
        return `une caution de <strong>${this.money(v.amount)}</strong>`;
      case 'vehicle_inspections':
        return v.inspection_type === 'departure'
          ? "l'inspection de départ"
          : v.inspection_type === 'return'
            ? "l'inspection de retour"
            : 'une inspection';
      case 'vehicle_maintenance':
        return `la maintenance (${v.maintenance_type || 'type non précisé'}) du véhicule <strong>${this.vehiclesMap()[v.vehicle_id] ?? ''}</strong>`;
      case 'incidents':
        return `l'incident (${v.incident_type || 'type non précisé'}) sur <strong>${this.vehiclesMap()[v.vehicle_id] ?? 'un véhicule'}</strong>`;
      case 'profiles':
        return `le compte de <strong>${v.full_name || v.email || 'un utilisateur'}</strong>`;
      case 'contract_templates':
        return `le modèle de contrat <strong>${v.name || ''}</strong>`;
      case 'contract_template_versions':
        return `une nouvelle version de modèle de contrat`;
      case 'contract_signatures':
        return v.signer_type === 'client'
          ? 'la signature du locataire'
          : 'la signature du responsable';
      default:
        return 'un élément';
    }
  }

  sentence(e: any) {
    const actor = this.userLabel(e.user_id);
    const verb =
      e.action === 'INSERT' ? 'a créé' : e.action === 'DELETE' ? 'a supprimé' : 'a modifié';
    return `<strong>${actor}</strong> ${verb} ${this.entityPhrase(e)}`;
  }
  private plainSentence(e: any) {
    return this.sentence(e).replace(/<[^>]+>/g, '');
  }

  private statusLabels: Record<string, Record<string, string>> = {
    rentals: {
      pending: 'En attente',
      active: 'En cours',
      overdue: 'En retard',
      completed: 'Terminée',
    },
    vehicles: {
      available: 'Disponible',
      on_rental: 'En location',
      maintenance: 'Maintenance',
      unavailable: 'Indisponible',
    },
    vehicle_maintenance: {
      planned: 'Planifiée',
      in_progress: 'En cours',
      completed: 'Terminée',
      cancelled: 'Annulée',
    },
    incidents: { open: 'Ouvert', in_progress: 'En cours', resolved: 'Résolu', closed: 'Clôturé' },
  };

  changes(e: any): string[] {
    if (e.action !== 'UPDATE') return [];
    const old = e.old_values ?? {},
      next = e.new_values ?? {};
    const fieldLabels: Record<string, string> = {
      status: 'Statut',
      rental_price: 'Prix',
      deposit_amount: 'Caution',
      mileage: 'Kilométrage',
      is_active: 'Compte',
      insurance_expiry_date: 'Expiration assurance',
      technical_inspection_expiry_date: 'Contrôle technique',
      returned_amount: 'Montant restitué',
      retained_amount: 'Montant retenu',
    };
    const fmt = (key: string, v: any) => {
      if (v === null || v === undefined) return '—';
      if (key === 'status') return this.statusLabels[e.entity_type]?.[v] ?? v;
      if (['rental_price', 'deposit_amount', 'returned_amount', 'retained_amount'].includes(key))
        return this.money(v);
      if (key === 'is_active') return v ? 'Actif' : 'Inactif';
      return String(v);
    };
    const out: string[] = [];
    for (const key of Object.keys(fieldLabels)) {
      if (!(key in next)) continue;
      if (JSON.stringify(old[key]) === JSON.stringify(next[key])) continue;
      out.push(`${fieldLabels[key]} : ${fmt(key, old[key])} → ${fmt(key, next[key])}`);
    }
    return out.slice(0, 4);
  }

  detail(e: any) {
    const v = this.values(e),
      info: string[] = [];
    if (v.payment_date)
      info.push(`Enregistré le ${new Date(v.payment_date).toLocaleDateString('fr-FR')}`);
    if (v.departure_date)
      info.push(
        `Départ : ${new Date(v.departure_date).toLocaleString('fr-FR').replace(/ /g, ' ')}`,
      );
    if (v.return_date)
      info.push(`Retour : ${new Date(v.return_date).toLocaleString('fr-FR').replace(/ /g, ' ')}`);
    if (v.contract_number) info.push(`N° contrat : ${v.contract_number}`);
    return info.length
      ? info.join(' · ')
      : 'Aucun contenu sensible, document, signature ou JSON n’est affiché dans le journal.';
  }

  private money(v: any) {
    return `${Number(v ?? 0)
      .toLocaleString('fr-FR')
      .replace(/ /g, ' ')} FCFA`;
  }
}
ActivityLogsComponent.prototype.toggle = function (this: ActivityLogsComponent, id: string) {
  this.expanded.set(this.expanded() === id ? null : id);
};
