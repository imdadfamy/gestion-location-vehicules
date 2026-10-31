import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { StorageService } from './storage.service';
import type { TablesInsert } from '../database.types';

export type SignerType = 'client' | 'responsable';

/**
 * Contrats de location : génération depuis la dernière version du modèle actif,
 * signatures manuscrites et PDF archivé. Un contrat signé est figé côté base.
 */
@Injectable({ providedIn: 'root' })
export class ContractsService {
  private auth = inject(AuthService);
  private storage = inject(StorageService);
  private get db() {
    return this.auth.supabase();
  }

  list() {
    return this.db.from('contracts').select('*').order('created_at', { ascending: false });
  }

  /** Locations en attente qui n'ont pas encore de contrat. */
  async rentalsWithoutContract() {
    const [rentals, contracts] = await Promise.all([
      this.db.from('rentals').select('*,clients(*),vehicles(*)').eq('status', 'pending'),
      this.db.from('contracts').select('rental_id'),
    ]);
    const error = rentals.error ?? contracts.error;
    if (error) return { data: null, error };
    const used = new Set((contracts.data ?? []).map((c) => c.rental_id));
    return { data: (rentals.data ?? []).filter((r) => !used.has(r.id)), error: null };
  }

  existingFor(rentalId: string) {
    return this.db
      .from('contracts')
      .select('contract_number')
      .eq('rental_id', rentalId)
      .maybeSingle();
  }

  /** Dernière version du modèle de location actif (celle qui sera figée dans le contrat). */
  async latestTemplateVersion() {
    const template = await this.db
      .from('contract_templates')
      .select('id')
      .eq('template_type', 'rental')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    if (template.error) return template;
    return this.db
      .from('contract_template_versions')
      .select('*')
      .eq('template_id', template.data.id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();
  }

  create(values: TablesInsert<'contracts'>) {
    return this.db.from('contracts').insert(values).select().single();
  }

  signatures(contractId: string) {
    return this.db.from('contract_signatures').select('*').eq('contract_id', contractId);
  }

  /** Enregistre l'image de la signature puis la ligne contract_signatures. */
  async addSignature(contractId: string, signerType: SignerType, signerName: string, image: Blob) {
    const path = `contracts/${contractId}/signatures/${signerType}.png`;
    const upload = await this.db.storage
      .from('contract-assets')
      .upload(path, image, { upsert: false, contentType: 'image/png' });
    if (upload.error) return upload.error;
    const saved = await this.db.from('contract_signatures').insert({
      contract_id: contractId,
      signer_type: signerType,
      signer_name: signerName,
      signature_storage_path: path,
      signer_user_agent: navigator.userAgent,
    });
    return saved.error;
  }

  signatureImage(path: string) {
    return this.storage.download('contract-assets', path);
  }

  /** Archive le PDF final puis passe le contrat à « signé ». */
  async archiveSignedPdf(contractId: string, fileName: string, pdf: Blob) {
    const path = `contracts/${contractId}/pdf/${fileName}`;
    const upload = await this.db.storage
      .from('contract-assets')
      .upload(path, pdf, { upsert: false, contentType: 'application/pdf' });
    if (upload.error) return { data: null, error: upload.error };
    return this.db
      .from('contracts')
      .update({
        final_pdf_storage_path: path,
        status: 'signed',
        signed_at: new Date().toISOString(),
      })
      .eq('id', contractId)
      .select()
      .single();
  }

  pdfUrl(path: string) {
    return this.storage.signedUrl('contract-assets', path);
  }
}
