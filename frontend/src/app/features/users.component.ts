import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page-heading"><div><p class="eyebrow">ADMINISTRATION</p><h1>Utilisateurs</h1><p>Gérez les comptes internes et les accès au portail client.</p></div><button class="btn btn-primary" (click)="startInvite()">+ Inviter un Responsable</button></div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> } @if (message()) { <div class="alert alert-success">{{ message() }}</div> }

    <section class="mb-5"><div class="d-flex align-items-center justify-content-between mb-3"><div><h2 class="h4 mb-1">Équipe interne</h2><p class="text-muted mb-0">Super Admin et Responsables avec permissions configurables.</p></div><span class="badge text-bg-secondary">{{ internalUsers().length }}</span></div>
    @if (!internalUsers().length) { <div class="empty-state">Aucun utilisateur interne accessible.</div> }
    @else { <div class="table-responsive app-table"><table class="table align-middle mb-0"><thead><tr><th>Utilisateur</th><th>Rôle</th><th>Statut</th><th class="text-end">Action</th></tr></thead><tbody>@for (user of internalUsers(); track user.id) { <tr><td><strong>{{ user.full_name || 'Sans nom' }}</strong><small class="d-block text-muted">{{ user.email }}</small></td><td><span class="badge text-bg-{{ user.role === 'super_admin' ? 'dark' : 'secondary' }}">{{ user.role === 'super_admin' ? 'Super Admin' : 'Responsable' }}</span></td><td><span class="badge text-bg-{{ user.is_active ? 'success' : 'secondary' }}">{{ user.is_active ? 'Actif' : 'Désactivé' }}</span></td><td class="text-end">@if (user.role === 'responsable') { <button class="btn btn-sm btn-outline-primary me-2" (click)="startEdit(user)">Gérer</button><button class="btn btn-sm btn-outline-danger" [disabled]="saving()" (click)="deleteUser(user)">Supprimer</button> }</td></tr> }</tbody></table></div> }
    </section>

    <section><div class="d-flex align-items-center justify-content-between mb-3"><div><h2 class="h4 mb-1">Clients</h2><p class="text-muted mb-0">Accès au portail client uniquement. Les clients ne reçoivent aucune permission interne.</p></div><span class="badge text-bg-info">{{ clientUsers().length }}</span></div>
    @if (!clientUsers().length) { <div class="empty-state">Aucun compte client.</div> }
    @else { <div class="table-responsive app-table"><table class="table align-middle mb-0"><thead><tr><th>Client</th><th>Accès portail</th><th class="text-end">Action</th></tr></thead><tbody>@for (client of clientUsers(); track client.id) { <tr><td><strong>{{ client.full_name || 'Sans nom' }}</strong><small class="d-block text-muted">{{ client.email }}</small></td><td><span class="badge text-bg-{{ client.is_active ? 'success' : 'secondary' }}">{{ client.is_active ? 'Accès autorisé' : 'Accès retiré' }}</span></td><td class="text-end"><button class="btn btn-sm me-2" [class.btn-outline-danger]="client.is_active" [class.btn-outline-success]="!client.is_active" [disabled]="saving()" (click)="toggleClientAccess(client)">{{ client.is_active ? 'Retirer l’accès' : 'Donner l’accès' }}</button><button class="btn btn-sm btn-outline-danger" [disabled]="saving()" (click)="deleteUser(client)">Supprimer</button></td></tr> }</tbody></table></div> }
    </section>

    @if (invite() || editing()) { <section class="card form-card mt-4"><div class="card-body"><div class="d-flex justify-content-between"><div><h2 class="h4">{{ invite() ? 'Inviter un Responsable' : 'Gérer le Responsable' }}</h2><p class="text-muted">Les permissions prennent effet côté base via RLS.</p></div><button class="btn-close" (click)="cancel()"></button></div>@if (invite()) { <div class="row g-3"><div class="col-md-6"><label>Nom complet</label><input class="form-control" [(ngModel)]="invite()!.full_name"></div><div class="col-md-6"><label>E-mail professionnel</label><input class="form-control" type="email" [(ngModel)]="invite()!.email"></div></div> }@if (editing()) { <div class="form-check form-switch mt-3"><input class="form-check-input" type="checkbox" id="active" [(ngModel)]="editing()!.is_active"><label class="form-check-label" for="active">Compte actif</label></div> }
      <div class="d-flex justify-content-between align-items-center mt-4 mb-2"><h3 class="h6 mb-0">Permissions</h3><button type="button" class="btn btn-sm btn-outline-secondary" (click)="toggleAll(!allSelected())">{{ allSelected() ? 'Tout décocher' : 'Tout cocher' }}</button></div>
      <div class="table-responsive perm-matrix"><table class="table table-sm align-middle mb-0"><thead><tr><th>Module</th>@for (action of actions; track action) { <th class="text-center"><label class="perm-col"><input class="form-check-input" type="checkbox" [ngModel]="allActionSelected(action)" (ngModelChange)="toggleAction(action, $event)"><span>{{ action }}</span></label></th> }</tr></thead><tbody>@for (module of modules; track module.key) { <tr><td><label class="perm-row"><input class="form-check-input" type="checkbox" [ngModel]="allModuleSelected(module.key)" (ngModelChange)="toggleModule(module.key, $event)">{{ module.label }}</label></td>@for (action of actions; track action) { <td class="text-center"><input class="form-check-input" type="checkbox" [ngModel]="allowed(module.key, action)" (ngModelChange)="setAllowed(module.key, action, $event)"></td> }</tr> }</tbody></table></div>
    <button class="btn btn-primary mt-3" [disabled]="saving()" (click)="submit()">{{ saving() ? 'Enregistrement…' : invite() ? 'Envoyer l’invitation' : 'Enregistrer' }}</button></div></section> }
  `,
  styles: [`
    .perm-matrix{border:1px solid var(--app-border);border-radius:14px;overflow:auto}
    .perm-matrix table{min-width:720px}
    .perm-matrix thead th{position:sticky;top:0;background:var(--app-surface-soft);z-index:1}
    .perm-matrix tbody tr{transition:background-color .15s ease}
    .perm-matrix tbody tr:hover{background:var(--app-accent-soft)}
    .perm-col{display:flex;flex-direction:column-reverse;align-items:center;gap:4px;font-weight:700;font-size:.72rem;text-transform:capitalize;cursor:pointer;margin:0}
    .perm-row{display:flex;align-items:center;gap:8px;font-weight:650;cursor:pointer;margin:0;white-space:nowrap}
  `]
})
export class UsersComponent implements OnInit {
  users = signal<any[]>([]); invite = signal<any>(null); editing = signal<any>(null); error = signal(''); message = signal(''); saving = signal(false);
  permissions: Record<string, Record<string, boolean>> = {};
  actions = ['view', 'create', 'update', 'delete', 'validate'];
  modules = [['vehicles', 'Véhicules'], ['clients', 'Clients'], ['reservations', 'Réservations'], ['rentals', 'Locations'], ['contracts', 'Contrats'], ['payments', 'Paiements'], ['deposits', 'Cautions'], ['inspections', 'Inspections'], ['maintenance', 'Maintenance'], ['incidents', 'Incidents'], ['documents', 'Documents'], ['notifications', 'Notifications'], ['reports', 'Rapports'], ['contract_templates', 'Modèles de contrat'], ['activity_logs', 'Journal'], ['partners', 'Partenaires']].map(([key, label]) => ({ key, label }));
  constructor(private auth: AuthService) {}
  ngOnInit() { this.load(); }
  internalUsers() { return this.users().filter(user => user.role === 'super_admin' || user.role === 'responsable'); }
  clientUsers() { return this.users().filter(user => user.role === 'client'); }
  async load() { const result = await this.auth.supabase().from('profiles').select('*').in('role', ['super_admin', 'responsable', 'client']).order('created_at'); this.users.set(result.data ?? []); this.error.set(result.error ? this.auth.errorMessage(result.error) : ''); }
  startInvite() { this.invite.set({ full_name: '', email: '' }); this.editing.set(null); this.permissions = {}; }
  startEdit(user: any) { this.editing.set({ ...user }); this.invite.set(null); this.permissions = structuredClone(user.permissions ?? {}); }
  cancel() { this.invite.set(null); this.editing.set(null); this.permissions = {}; }
  allowed(module: string, action: string) { return this.permissions[module]?.[action] === true; }
  setAllowed(module: string, action: string, value: boolean) { const permissions = structuredClone(this.permissions); permissions[module] ??= {}; if (value) permissions[module][action] = true; else delete permissions[module][action]; if (!Object.keys(permissions[module]).length) delete permissions[module]; this.permissions = permissions; }
  allModuleSelected(module: string) { return this.actions.every(action => this.allowed(module, action)); }
  toggleModule(module: string, value: boolean) { const permissions = structuredClone(this.permissions); if (value) permissions[module] = Object.fromEntries(this.actions.map(action => [action, true])); else delete permissions[module]; this.permissions = permissions; }
  allActionSelected(action: string) { return this.modules.every(module => this.allowed(module.key, action)); }
  toggleAction(action: string, value: boolean) { const permissions = structuredClone(this.permissions); for (const module of this.modules) { permissions[module.key] ??= {}; if (value) permissions[module.key][action] = true; else { delete permissions[module.key][action]; if (!Object.keys(permissions[module.key]).length) delete permissions[module.key]; } } this.permissions = permissions; }
  allSelected() { return this.modules.every(module => this.allModuleSelected(module.key)); }
  toggleAll(value: boolean) { const permissions: Record<string, Record<string, boolean>> = {}; if (value) for (const module of this.modules) permissions[module.key] = Object.fromEntries(this.actions.map(action => [action, true])); this.permissions = permissions; }
  async call(body: any) { const result = await this.auth.supabase().functions.invoke('manage-users', { body }); if (result.error) throw result.error; if (result.data?.error) throw new Error(result.data.error); }
  async toggleClientAccess(client: any) {
    const enable = !client.is_active;
    if (!window.confirm(enable ? `Donner l’accès au portail à ${client.full_name || client.email} ?` : `Retirer l’accès au portail à ${client.full_name || client.email} ?`)) return;
    try { this.saving.set(true); this.error.set(''); await this.call({ action: 'update_client_access', user_id: client.id, is_active: enable }); this.message.set(enable ? 'Accès client rétabli.' : 'Accès client retiré. Les historiques sont conservés.'); await this.load(); }
    catch (error) { this.error.set(this.auth.errorMessage(error)); } finally { this.saving.set(false); }
  }
  async deleteUser(target: any) {
    const name = target.full_name || target.email;
    if (!window.confirm(`Supprimer définitivement le compte de ${name} ?\n\nCette action est irréversible. Son historique (locations, contrats, paiements…) est conservé, mais ne sera plus attribué nommément à cette personne.`)) return;
    try { this.saving.set(true); this.error.set(''); await this.call({ action: 'delete', user_id: target.id }); this.message.set('Compte supprimé.'); await this.load(); }
    catch (error) { this.error.set(this.auth.errorMessage(error)); } finally { this.saving.set(false); }
  }
  async submit() {
    try { this.saving.set(true); this.error.set(''); if (this.invite()) await this.call({ action: 'invite', ...this.invite(), permissions: this.permissions, redirect_to: location.origin + '/invite' }); else await this.call({ action: 'update', user_id: this.editing().id, is_active: this.editing().is_active, permissions: this.permissions }); this.message.set(this.invite() ? 'Invitation envoyée.' : 'Utilisateur mis à jour.'); this.cancel(); await this.load(); }
    catch (error) { this.error.set(this.auth.errorMessage(error)); } finally { this.saving.set(false); }
  }
}
