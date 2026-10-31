import { Component, OnInit, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { AdministrationService } from '../../core/data/administration.service';

@Component({
  standalone: true,
  imports: [FormsModule, SlicePipe],
  templateUrl: './contract-templates.component.html',
})
export class ContractTemplatesComponent implements OnInit {
  templates = signal<any[]>([]);
  versions = signal<any[]>([]);
  selected = signal<any>(null);
  templateForm = signal<any>(null);
  editingVersion = signal<any>(null);
  error = signal('');
  message = signal('');
  loading = signal(false);
  saving = signal(false);
  contentJson = '{}';
  variablesJson = '{}';
  constructor(
    public auth: AuthService,
    private admin: AdministrationService,
  ) {}
  ngOnInit() {
    this.load();
  }
  async load() {
    this.loading.set(true);
    const r = await this.admin.templates();
    this.loading.set(false);
    this.templates.set(r.data ?? []);
    this.error.set(r.error ? this.auth.errorMessage(r.error) : '');
  }
  async selectTemplate(t: any) {
    this.selected.set(t);
    this.editingVersion.set(null);
    const r = await this.admin.templateVersions(t.id);
    this.versions.set(r.data ?? []);
    if (r.error) this.error.set(this.auth.errorMessage(r.error));
  }
  startTemplate() {
    this.templateForm.set({ name: '', description: '', template_type: 'rental', is_active: true });
  }
  async saveTemplate() {
    const f = this.templateForm();
    if (!f?.name?.trim()) {
      this.error.set('Le nom du modèle est requis.');
      return;
    }
    const r = await this.admin.createTemplate({ ...f, name: f.name.trim() });
    if (r.error) {
      this.error.set(this.auth.errorMessage(r.error));
      return;
    }
    this.templateForm.set(null);
    this.message.set('Modèle créé. Créez maintenant sa première version.');
    await this.load();
    await this.selectTemplate(r.data);
  }
  async toggleActive() {
    const t = this.selected(),
      r = await this.admin.setTemplateActive(t.id, !t.is_active);
    if (r.error) this.error.set(this.auth.errorMessage(r.error));
    else {
      this.selected.set(r.data);
      await this.load();
    }
  }
  readVersion(v: any) {
    this.editingVersion.set(v);
    this.contentJson = JSON.stringify(v.content ?? {}, null, 2);
    this.variablesJson = JSON.stringify(v.variables ?? {}, null, 2);
  }
  newVersion() {
    const latest = this.versions()[0];
    this.editingVersion.set({
      template_id: this.selected().id,
      version_number: (latest?.version_number ?? 0) + 1,
    });
    this.contentJson = JSON.stringify(latest?.content ?? { sections: [] }, null, 2);
    this.variablesJson = JSON.stringify(latest?.variables ?? {}, null, 2);
  }
  async saveVersion() {
    try {
      const content = JSON.parse(this.contentJson),
        variables = JSON.parse(this.variablesJson);
      if (!Array.isArray(content.sections)) {
        throw new Error('Le contenu doit contenir un tableau sections.');
      }
      this.saving.set(true);
      const v = this.editingVersion();
      const r = await this.admin.createTemplateVersion({
        template_id: v.template_id,
        version_number: v.version_number,
        content,
        variables,
      });
      if (r.error) throw r.error;
      this.message.set(`Version ${r.data.version_number} créée et figée.`);
      this.editingVersion.set(null);
      await this.selectTemplate(this.selected());
    } catch (e) {
      this.error.set(
        e instanceof SyntaxError
          ? 'Le contenu JSON est invalide. Vérifiez la structure saisie.'
          : this.auth.errorMessage(e),
      );
    } finally {
      this.saving.set(false);
    }
  }
}
