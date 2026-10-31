import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import type { TablesInsert } from '../database.types';

/** Comptes, journal d'activité, modèles de contrat et rapports (écrans d'administration). */
@Injectable({ providedIn: 'root' })
export class AdministrationService {
  private auth = inject(AuthService);
  private get db() {
    return this.auth.supabase();
  }

  // ── Comptes ──
  accounts() {
    return this.db
      .from('profiles')
      .select('*')
      .in('role', ['super_admin', 'responsable', 'client'])
      .order('created_at');
  }

  updateOwnName(profileId: string, firstName: string, lastName: string) {
    return this.db
      .from('profiles')
      .update({ first_name: firstName, last_name: lastName })
      .eq('id', profileId);
  }

  // ── Journal d'activité ──
  activityPage(from: number, size: number) {
    return this.db
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + size - 1);
  }

  clientNames(ids: string[]) {
    return this.db.from('clients').select('id,first_name,last_name').in('id', ids);
  }

  vehicleLabels(ids: string[]) {
    return this.db.from('vehicles').select('id,registration_number,make,model').in('id', ids);
  }

  // ── Modèles de contrat (versionnés : une version créée est figée) ──
  templates() {
    return this.db.from('contract_templates').select('*').order('updated_at', { ascending: false });
  }

  templateVersions(templateId: string) {
    return this.db
      .from('contract_template_versions')
      .select('*')
      .eq('template_id', templateId)
      .order('version_number', { ascending: false });
  }

  createTemplate(values: TablesInsert<'contract_templates'>) {
    return this.db.from('contract_templates').insert(values).select().single();
  }

  setTemplateActive(templateId: string, isActive: boolean) {
    return this.db
      .from('contract_templates')
      .update({ is_active: isActive })
      .eq('id', templateId)
      .select()
      .single();
  }

  createTemplateVersion(values: TablesInsert<'contract_template_versions'>) {
    return this.db.from('contract_template_versions').insert(values).select().single();
  }

  // ── Rapports ──
  /** Encaissements, locations, incidents et maintenances (filtrés par période côté écran). */
  reportSources() {
    return Promise.all([
      this.db
        .from('payments')
        .select('amount,payment_date,rental_id,rentals(vehicles(make,model,registration_number))'),
      this.db
        .from('rentals')
        .select('id,departure_date,client_id,vehicles(make,model,registration_number)'),
      this.db.from('incidents').select('cost,incident_date'),
      this.db.from('vehicle_maintenance').select('cost,maintenance_date'),
    ]);
  }
}
