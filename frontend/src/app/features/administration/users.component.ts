import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { AccountsService } from '../../core/data/accounts.service';
import { AdministrationService } from '../../core/data/administration.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit {
  users = signal<any[]>([]);
  invite = signal<any>(null);
  editing = signal<any>(null);
  error = signal('');
  message = signal('');
  saving = signal(false);
  permissions: Record<string, Record<string, boolean>> = {};
  actions = ['view', 'create', 'update', 'delete', 'validate'];
  modules = [
    ['vehicles', 'Véhicules'],
    ['clients', 'Clients'],
    ['reservations', 'Réservations'],
    ['rentals', 'Locations'],
    ['contracts', 'Contrats'],
    ['payments', 'Paiements'],
    ['deposits', 'Cautions'],
    ['inspections', 'Inspections'],
    ['maintenance', 'Maintenance'],
    ['incidents', 'Incidents'],
    ['documents', 'Documents'],
    ['notifications', 'Notifications'],
    ['reports', 'Rapports'],
    ['contract_templates', 'Modèles de contrat'],
    ['activity_logs', 'Journal'],
    ['partners', 'Partenaires'],
  ].map(([key, label]) => ({ key, label }));
  constructor(
    private auth: AuthService,
    private admin: AdministrationService,
    private accounts: AccountsService,
  ) {}
  ngOnInit() {
    this.load();
  }
  internalUsers() {
    return this.users().filter(
      (user) => user.role === 'super_admin' || user.role === 'responsable',
    );
  }
  clientUsers() {
    return this.users().filter((user) => user.role === 'client');
  }
  async load() {
    const result = await this.admin.accounts();
    this.users.set(result.data ?? []);
    this.error.set(result.error ? this.auth.errorMessage(result.error) : '');
  }
  startInvite() {
    this.invite.set({ full_name: '', email: '' });
    this.editing.set(null);
    this.permissions = {};
  }
  startEdit(user: any) {
    this.editing.set({ ...user });
    this.invite.set(null);
    this.permissions = structuredClone(user.permissions ?? {});
  }
  cancel() {
    this.invite.set(null);
    this.editing.set(null);
    this.permissions = {};
  }
  allowed(module: string, action: string) {
    return this.permissions[module]?.[action] === true;
  }
  setAllowed(module: string, action: string, value: boolean) {
    const permissions = structuredClone(this.permissions);
    permissions[module] ??= {};
    if (value) permissions[module][action] = true;
    else delete permissions[module][action];
    if (!Object.keys(permissions[module]).length) delete permissions[module];
    this.permissions = permissions;
  }
  allModuleSelected(module: string) {
    return this.actions.every((action) => this.allowed(module, action));
  }
  toggleModule(module: string, value: boolean) {
    const permissions = structuredClone(this.permissions);
    if (value)
      permissions[module] = Object.fromEntries(this.actions.map((action) => [action, true]));
    else delete permissions[module];
    this.permissions = permissions;
  }
  allActionSelected(action: string) {
    return this.modules.every((module) => this.allowed(module.key, action));
  }
  toggleAction(action: string, value: boolean) {
    const permissions = structuredClone(this.permissions);
    for (const module of this.modules) {
      permissions[module.key] ??= {};
      if (value) permissions[module.key][action] = true;
      else {
        delete permissions[module.key][action];
        if (!Object.keys(permissions[module.key]).length) delete permissions[module.key];
      }
    }
    this.permissions = permissions;
  }
  allSelected() {
    return this.modules.every((module) => this.allModuleSelected(module.key));
  }
  toggleAll(value: boolean) {
    const permissions: Record<string, Record<string, boolean>> = {};
    if (value)
      for (const module of this.modules)
        permissions[module.key] = Object.fromEntries(this.actions.map((action) => [action, true]));
    this.permissions = permissions;
  }
  async call(body: any) {
    await this.accounts.run(body);
  }
  async toggleClientAccess(client: any) {
    const enable = !client.is_active;
    if (
      !window.confirm(
        enable
          ? `Donner l’accès au portail à ${client.full_name || client.email} ?`
          : `Retirer l’accès au portail à ${client.full_name || client.email} ?`,
      )
    )
      return;
    try {
      this.saving.set(true);
      this.error.set('');
      await this.call({ action: 'update_client_access', user_id: client.id, is_active: enable });
      this.message.set(
        enable ? 'Accès client rétabli.' : 'Accès client retiré. Les historiques sont conservés.',
      );
      await this.load();
    } catch (error) {
      this.error.set(this.auth.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  async deleteUser(target: any) {
    const name = target.full_name || target.email;
    if (
      !window.confirm(
        `Supprimer définitivement le compte de ${name} ?\n\nCette action est irréversible. Son historique (locations, contrats, paiements…) est conservé, mais ne sera plus attribué nommément à cette personne.`,
      )
    )
      return;
    try {
      this.saving.set(true);
      this.error.set('');
      await this.call({ action: 'delete', user_id: target.id });
      this.message.set('Compte supprimé.');
      await this.load();
    } catch (error) {
      this.error.set(this.auth.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  async submit() {
    try {
      this.saving.set(true);
      this.error.set('');
      if (this.invite())
        await this.call({
          action: 'invite',
          ...this.invite(),
          permissions: this.permissions,
          redirect_to: location.origin + '/invite',
        });
      else
        await this.call({
          action: 'update',
          user_id: this.editing().id,
          is_active: this.editing().is_active,
          permissions: this.permissions,
        });
      this.message.set(this.invite() ? 'Invitation envoyée.' : 'Utilisateur mis à jour.');
      this.cancel();
      await this.load();
    } catch (error) {
      this.error.set(this.auth.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
