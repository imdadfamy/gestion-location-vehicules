import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/database.types';

type Db = SupabaseClient<Database>;
export type Template = Database['public']['Tables']['contract_templates']['Row'];
export type TemplateVersion = Database['public']['Tables']['contract_template_versions']['Row'];
export type Section = { title: string; clauses: string[] };

export function listTemplates(db: Db) {
  return db.from('contract_templates').select('*').order('updated_at', { ascending: false });
}

export function templateVersions(db: Db, templateId: string) {
  return db.from('contract_template_versions').select('*').eq('template_id', templateId).order('version_number', { ascending: false });
}

export function createTemplate(db: Db, name: string, description: string) {
  return db
    .from('contract_templates')
    .insert({ name: name.trim(), description: description.trim() || null, template_type: 'rental', is_active: true })
    .select()
    .single();
}

export function setTemplateActive(db: Db, templateId: string, isActive: boolean) {
  return db.from('contract_templates').update({ is_active: isActive }).eq('id', templateId).select().single();
}

/** Sections d'une version (structure V1 : `sections` avec titres et clauses). */
export function sectionsOf(content: Json | null | undefined): Section[] {
  const sections = (content as { sections?: unknown } | null)?.sections;
  if (!Array.isArray(sections)) return [];
  return sections.map((section) => ({
    title: String((section as Section)?.title ?? ''),
    clauses: Array.isArray((section as Section)?.clauses) ? (section as Section).clauses.map(String) : [],
  }));
}

/**
 * Crée une nouvelle version, figée dès l'enregistrement : les contrats déjà générés
 * gardent la leur. Les autres clés du contenu précédent sont conservées.
 */
export function createTemplateVersion(
  db: Db,
  templateId: string,
  versionNumber: number,
  previousContent: Json | null | undefined,
  sections: Section[],
  variables: Json,
) {
  const base = previousContent && typeof previousContent === 'object' && !Array.isArray(previousContent) ? previousContent : {};
  return db
    .from('contract_template_versions')
    .insert({
      template_id: templateId,
      version_number: versionNumber,
      content: { ...base, sections } as unknown as Json,
      variables,
    })
    .select()
    .single();
}
