import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { StorageService } from './storage.service';
import type { Database } from '../database.types';
import { edgeFunctionError } from './edge-function';

/**
 * Accès aux données depuis l'espace client. Le client ne lit que ses propres lignes
 * (RLS) ; les étapes sensibles passent par des RPC ou des Edge Functions dédiées.
 */
@Injectable({ providedIn: 'root' })
export class ClientPortalService {
  private auth = inject(AuthService);
  private storage = inject(StorageService);
  private get db() {
    return this.auth.supabase();
  }

  /** Coordonnées publiques de l'entreprise (les paramètres complets sont réservés au personnel). */
  companyContact() {
    return this.db.rpc('public_company_contact').maybeSingle();
  }

  // ── Dossier client ──
  myRecord(profileId: string) {
    return this.db.from('clients').select('*').eq('profile_id', profileId).maybeSingle();
  }

  /** Met à jour la fiche existante, ou la crée au premier enregistrement. */
  saveRecord(profileId: string, form: any) {
    if (form.id)
      return this.db
        .from('clients')
        .update({ ...form, profile_id: profileId })
        .eq('id', form.id)
        .select()
        .single();
    return this.db.rpc('ensure_client_profile', {
      target_first_name: form.first_name,
      target_last_name: form.last_name,
      target_phone: form.phone,
      target_email: form.email || null,
    });
  }

  documents(clientId: string, columns = '*') {
    return this.db
      .from('client_documents')
      .select(columns)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .returns<any[]>();
  }

  /** Envoie la pièce puis l'enregistre ; renvoie la ligne créée. */
  async addDocument(clientId: string, profileId: string, documentType: string, file: File) {
    const path = this.storage.uniquePath(`clients/${clientId}`, file);
    const upload = await this.storage.upload('rental-documents', path, file);
    if (upload.error) return { data: null, error: upload.error };
    return this.db
      .from('client_documents')
      .insert({
        client_id: clientId,
        document_type: documentType,
        document_name: file.name,
        storage_path: path,
        mime_type: file.type,
        file_size: file.size,
        uploaded_by: profileId,
      })
      .select()
      .single();
  }

  /** Retire le fichier puis sa ligne. */
  async removeDocument(document: { id: string; storage_path: string }) {
    const removed = await this.storage.remove('rental-documents', [document.storage_path]);
    if (removed.error) return removed.error;
    return (await this.db.from('client_documents').delete().eq('id', document.id)).error;
  }

  documentUrl(path: string) {
    return this.storage.signedUrl('rental-documents', path);
  }

  // ── Véhicules et réservations ──
  availableVehicles(departure?: string, returnDate?: string) {
    return this.db.rpc('client_available_vehicles', {
      target_departure: departure,
      target_return: returnDate,
    });
  }

  /** Lien de 10 minutes vers une photo, ou à défaut une URL locale du fichier téléchargé. */
  async vehiclePhotoUrl(path: string) {
    const signed = await this.storage.signedUrl('rental-documents', path, 600);
    if (signed.data?.signedUrl) return signed.data.signedUrl;
    const file = await this.storage.download('rental-documents', path);
    return file.data ? URL.createObjectURL(file.data) : null;
  }

  createReservation(
    vehicleId: string,
    departure: string,
    returnDate: string,
    observation?: string,
  ) {
    return this.db.rpc('client_create_reservation', {
      target_vehicle_id: vehicleId,
      target_departure: departure,
      target_return: returnDate,
      target_observation: observation,
    });
  }

  reservationHistory() {
    return this.db.rpc('client_reservation_history');
  }

  /** Annule sa propre réservation encore en attente (RPC : un UPDATE direct est filtré par la RLS). */
  cancelReservation(id: string) {
    return this.db.rpc('client_cancel_reservation', { target_reservation_id: id });
  }

  // ── Contrats ──
  contracts() {
    return this.db.from('contracts').select('*').order('created_at', { ascending: false });
  }

  contractHistory() {
    return this.db.rpc('client_contract_history');
  }

  /** Dossier envoyé par le Responsable et pas encore signé (réservation sans contrat). */
  pendingDossier() {
    return this.db.rpc('client_pending_contract_dossier');
  }

  hasSigned(contractId: string) {
    return this.db
      .from('contract_signatures')
      .select('id')
      .eq('contract_id', contractId)
      .eq('signer_type', 'client')
      .maybeSingle();
  }

  refreshContractContent(contractId: string) {
    return this.db.rpc('client_refresh_contract_content', { target_contract_id: contractId });
  }

  reportCorrection(contractId: string, message: string) {
    return this.db.rpc('report_contract_correction', {
      target_contract_id: contractId,
      correction_message: message,
    });
  }

  /**
   * Signature du client. Sur un dossier de réservation, la RPC crée ensuite la location
   * et le contrat ; sur un contrat existant, la signature est ajoutée au contrat.
   */
  async sign(
    target: { reservationId: string } | { contractId: string; signerName: string },
    profileId: string,
    image: Blob,
  ) {
    const path =
      'reservationId' in target
        ? `reservations/${target.reservationId}/signatures/client.png`
        : `contracts/${target.contractId}/signatures/client.png`;
    const upload = await this.db.storage
      .from('contract-assets')
      .upload(path, image, { upsert: false, contentType: 'image/png' });
    if (upload.error) return upload.error;
    if ('reservationId' in target) {
      const submitted = await this.db.rpc('client_submit_reservation_contract', {
        target_reservation_id: target.reservationId,
        client_signature_storage_path: path,
      });
      return submitted.error;
    }
    const saved = await this.db.from('contract_signatures').insert({
      contract_id: target.contractId,
      signer_type: 'client',
      signer_name: target.signerName,
      signature_storage_path: path,
      created_by: profileId,
      signer_user_agent: navigator.userAgent,
    });
    return saved.error;
  }

  /** Lien de téléchargement du PDF signé, délivré par l'Edge Function après contrôle d'appartenance. */
  async contractPdfUrl(contractId: string) {
    const result = await this.db.functions.invoke('client-contract-download', {
      body: { contract_id: contractId },
    });
    return {
      url: (result.data?.signedUrl as string) ?? null,
      error: await edgeFunctionError(result),
    };
  }

  // ── Inspections ──
  inspectionHistory() {
    return this.db.rpc('client_inspection_history');
  }

  inspectionEligibleRentals() {
    return this.db.rpc('client_inspection_eligible_rentals');
  }

  createInspection(args: Database['public']['Functions']['client_create_inspection']['Args']) {
    return this.db.rpc('client_create_inspection', args);
  }

  /** Envoi d'une photo via l'Edge Function (verrouillée 1 h après l'inspection) ; renvoie l'erreur. */
  async uploadInspectionPhoto(form: FormData) {
    return edgeFunctionError(
      await this.db.functions.invoke('client-inspection-photo', { body: form }),
    );
  }

  async inspectionPhotos(inspectionId: string) {
    const result = await this.db.functions.invoke('client-inspection-photo', {
      body: { inspection_id: inspectionId },
    });
    return { photos: (result.data?.photos as any[]) ?? [], error: await edgeFunctionError(result) };
  }

  inspectionPhotoUrl(path: string) {
    return this.storage.signedUrl('inspection-photos', path);
  }
}
