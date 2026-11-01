export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string;
          created_at: string;
          description: string | null;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          new_values: Json | null;
          old_values: Json | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          description?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          new_values?: Json | null;
          old_values?: Json | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          description?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          new_values?: Json | null;
          old_values?: Json | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'activity_logs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      client_documents: {
        Row: {
          client_id: string;
          created_at: string;
          document_name: string;
          document_type: string;
          file_size: number | null;
          id: string;
          mime_type: string | null;
          storage_path: string;
          uploaded_by: string | null;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          document_name: string;
          document_type: string;
          file_size?: number | null;
          id?: string;
          mime_type?: string | null;
          storage_path: string;
          uploaded_by?: string | null;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          document_name?: string;
          document_type?: string;
          file_size?: number | null;
          id?: string;
          mime_type?: string | null;
          storage_path?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'client_documents_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_documents_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      clients: {
        Row: {
          address: string | null;
          created_at: string;
          created_by: string | null;
          driving_license_expiry_date: string | null;
          driving_license_issue_date: string | null;
          driving_license_number: string | null;
          email: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          first_name: string;
          id: string;
          id_document_number: string | null;
          id_document_type: string | null;
          last_name: string;
          notes: string | null;
          phone: string | null;
          profile_id: string | null;
          residence: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          created_by?: string | null;
          driving_license_expiry_date?: string | null;
          driving_license_issue_date?: string | null;
          driving_license_number?: string | null;
          email?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          first_name: string;
          id?: string;
          id_document_number?: string | null;
          id_document_type?: string | null;
          last_name: string;
          notes?: string | null;
          phone?: string | null;
          profile_id?: string | null;
          residence?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          created_by?: string | null;
          driving_license_expiry_date?: string | null;
          driving_license_issue_date?: string | null;
          driving_license_number?: string | null;
          email?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          first_name?: string;
          id?: string;
          id_document_number?: string | null;
          id_document_type?: string | null;
          last_name?: string;
          notes?: string | null;
          phone?: string | null;
          profile_id?: string | null;
          residence?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'clients_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'clients_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'clients_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      company_settings: {
        Row: {
          address: string | null;
          business_hours: string | null;
          company_name: string;
          created_at: string;
          created_by: string | null;
          default_deposit_amount: number | null;
          default_rental_price: number | null;
          email: string | null;
          id: string;
          ifu: string | null;
          logo_storage_path: string | null;
          partner_minimum_margin: number;
          phone: string | null;
          rccm: string | null;
          secondary_phone: string | null;
          settings: Json;
          updated_at: string;
          updated_by: string | null;
          whatsapp_phone: string | null;
        };
        Insert: {
          address?: string | null;
          business_hours?: string | null;
          company_name: string;
          created_at?: string;
          created_by?: string | null;
          default_deposit_amount?: number | null;
          default_rental_price?: number | null;
          email?: string | null;
          id?: string;
          ifu?: string | null;
          logo_storage_path?: string | null;
          partner_minimum_margin?: number;
          phone?: string | null;
          rccm?: string | null;
          secondary_phone?: string | null;
          settings?: Json;
          updated_at?: string;
          updated_by?: string | null;
          whatsapp_phone?: string | null;
        };
        Update: {
          address?: string | null;
          business_hours?: string | null;
          company_name?: string;
          created_at?: string;
          created_by?: string | null;
          default_deposit_amount?: number | null;
          default_rental_price?: number | null;
          email?: string | null;
          id?: string;
          ifu?: string | null;
          logo_storage_path?: string | null;
          partner_minimum_margin?: number;
          phone?: string | null;
          rccm?: string | null;
          secondary_phone?: string | null;
          settings?: Json;
          updated_at?: string;
          updated_by?: string | null;
          whatsapp_phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'company_settings_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'company_settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      contract_number_counters: {
        Row: {
          contract_year: number;
          next_number: number;
          updated_at: string;
        };
        Insert: {
          contract_year: number;
          next_number: number;
          updated_at?: string;
        };
        Update: {
          contract_year?: number;
          next_number?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      contract_signatures: {
        Row: {
          contract_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          signature_hash: string | null;
          signature_storage_path: string;
          signed_at: string;
          signer_ip: string | null;
          signer_name: string;
          signer_type: string;
          signer_user_agent: string | null;
        };
        Insert: {
          contract_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          signature_hash?: string | null;
          signature_storage_path: string;
          signed_at?: string;
          signer_ip?: string | null;
          signer_name: string;
          signer_type: string;
          signer_user_agent?: string | null;
        };
        Update: {
          contract_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          signature_hash?: string | null;
          signature_storage_path?: string;
          signed_at?: string;
          signer_ip?: string | null;
          signer_name?: string;
          signer_type?: string;
          signer_user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'contract_signatures_contract_id_fkey';
            columns: ['contract_id'];
            isOneToOne: false;
            referencedRelation: 'contracts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contract_signatures_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      contract_template_versions: {
        Row: {
          content: Json;
          created_at: string;
          created_by: string | null;
          id: string;
          template_id: string;
          variables: Json;
          version_number: number;
        };
        Insert: {
          content?: Json;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          template_id: string;
          variables?: Json;
          version_number: number;
        };
        Update: {
          content?: Json;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          template_id?: string;
          variables?: Json;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'contract_template_versions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contract_template_versions_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'contract_templates';
            referencedColumns: ['id'];
          },
        ];
      };
      contract_templates: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          template_type: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          template_type?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          template_type?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'contract_templates_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contract_templates_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      contracts: {
        Row: {
          contract_number: string | null;
          created_at: string;
          created_by: string | null;
          final_pdf_storage_path: string | null;
          generated_content: Json;
          generated_html: string | null;
          id: string;
          rental_id: string;
          signed_at: string | null;
          status: string;
          template_id: string | null;
          template_version_id: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          contract_number?: string | null;
          created_at?: string;
          created_by?: string | null;
          final_pdf_storage_path?: string | null;
          generated_content?: Json;
          generated_html?: string | null;
          id?: string;
          rental_id: string;
          signed_at?: string | null;
          status?: string;
          template_id?: string | null;
          template_version_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          contract_number?: string | null;
          created_at?: string;
          created_by?: string | null;
          final_pdf_storage_path?: string | null;
          generated_content?: Json;
          generated_html?: string | null;
          id?: string;
          rental_id?: string;
          signed_at?: string | null;
          status?: string;
          template_id?: string | null;
          template_version_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'contracts_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contracts_rental_id_fkey';
            columns: ['rental_id'];
            isOneToOne: false;
            referencedRelation: 'rentals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contracts_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'contract_templates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contracts_template_version_id_fkey';
            columns: ['template_version_id'];
            isOneToOne: false;
            referencedRelation: 'contract_template_versions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contracts_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      deposits: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          observation: string | null;
          received_at: string | null;
          recorded_by: string | null;
          rental_id: string;
          retained_amount: number;
          retained_at: string | null;
          returned_amount: number;
          returned_at: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          id?: string;
          observation?: string | null;
          received_at?: string | null;
          recorded_by?: string | null;
          rental_id: string;
          retained_amount?: number;
          retained_at?: string | null;
          returned_amount?: number;
          returned_at?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          observation?: string | null;
          received_at?: string | null;
          recorded_by?: string | null;
          rental_id?: string;
          retained_amount?: number;
          retained_at?: string | null;
          returned_amount?: number;
          returned_at?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'deposits_recorded_by_fkey';
            columns: ['recorded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'deposits_rental_id_fkey';
            columns: ['rental_id'];
            isOneToOne: true;
            referencedRelation: 'rentals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'deposits_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      incident_documents: {
        Row: {
          created_at: string;
          document_name: string;
          id: string;
          incident_id: string;
          mime_type: string | null;
          storage_path: string;
          uploaded_by: string | null;
        };
        Insert: {
          created_at?: string;
          document_name: string;
          id?: string;
          incident_id: string;
          mime_type?: string | null;
          storage_path: string;
          uploaded_by?: string | null;
        };
        Update: {
          created_at?: string;
          document_name?: string;
          id?: string;
          incident_id?: string;
          mime_type?: string | null;
          storage_path?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'incident_documents_incident_id_fkey';
            columns: ['incident_id'];
            isOneToOne: false;
            referencedRelation: 'incidents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'incident_documents_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      incidents: {
        Row: {
          client_id: string | null;
          cost: number;
          created_at: string;
          created_by: string | null;
          description: string;
          id: string;
          incident_date: string;
          incident_type: string;
          rental_id: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
          vehicle_id: string | null;
        };
        Insert: {
          client_id?: string | null;
          cost?: number;
          created_at?: string;
          created_by?: string | null;
          description: string;
          id?: string;
          incident_date?: string;
          incident_type: string;
          rental_id?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          vehicle_id?: string | null;
        };
        Update: {
          client_id?: string | null;
          cost?: number;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          id?: string;
          incident_date?: string;
          incident_type?: string;
          rental_id?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'incidents_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'incidents_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'incidents_rental_id_fkey';
            columns: ['rental_id'];
            isOneToOne: false;
            referencedRelation: 'rentals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'incidents_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'incidents_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      inspection_photos: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          inspection_id: string;
          photo_type: string | null;
          storage_path: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          inspection_id: string;
          photo_type?: string | null;
          storage_path: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          inspection_id?: string;
          photo_type?: string | null;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inspection_photos_inspection_id_fkey';
            columns: ['inspection_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_inspections';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          is_read: boolean;
          message: string;
          notification_type: string;
          read_at: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          is_read?: boolean;
          message: string;
          notification_type: string;
          read_at?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          is_read?: boolean;
          message?: string;
          notification_type?: string;
          read_at?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      partners: {
        Row: {
          company_name: string | null;
          contact_name: string;
          created_at: string;
          created_by: string | null;
          email: string | null;
          id: string;
          notes: string | null;
          payout_details: string | null;
          phone: string;
          profile_id: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          company_name?: string | null;
          contact_name: string;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          notes?: string | null;
          payout_details?: string | null;
          phone: string;
          profile_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          company_name?: string | null;
          contact_name?: string;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          notes?: string | null;
          payout_details?: string | null;
          phone?: string;
          profile_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'partners_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'partners_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'partners_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          observation: string | null;
          payment_date: string;
          payment_method: string | null;
          receipt_storage_path: string | null;
          recorded_by: string | null;
          reference: string | null;
          rental_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          observation?: string | null;
          payment_date?: string;
          payment_method?: string | null;
          receipt_storage_path?: string | null;
          recorded_by?: string | null;
          reference?: string | null;
          rental_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          observation?: string | null;
          payment_date?: string;
          payment_method?: string | null;
          receipt_storage_path?: string | null;
          recorded_by?: string | null;
          reference?: string | null;
          rental_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_recorded_by_fkey';
            columns: ['recorded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_rental_id_fkey';
            columns: ['rental_id'];
            isOneToOne: false;
            referencedRelation: 'rentals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          first_name: string | null;
          full_name: string | null;
          id: string;
          is_active: boolean;
          last_name: string | null;
          permissions: Json;
          role: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          first_name?: string | null;
          full_name?: string | null;
          id: string;
          is_active?: boolean;
          last_name?: string | null;
          permissions?: Json;
          role?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          first_name?: string | null;
          full_name?: string | null;
          id?: string;
          is_active?: boolean;
          last_name?: string | null;
          permissions?: Json;
          role?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rental_status_history: {
        Row: {
          changed_by: string | null;
          created_at: string;
          id: string;
          new_status: string;
          old_status: string | null;
          rental_id: string;
        };
        Insert: {
          changed_by?: string | null;
          created_at?: string;
          id?: string;
          new_status: string;
          old_status?: string | null;
          rental_id: string;
        };
        Update: {
          changed_by?: string | null;
          created_at?: string;
          id?: string;
          new_status?: string;
          old_status?: string | null;
          rental_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'rental_status_history_changed_by_fkey';
            columns: ['changed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rental_status_history_rental_id_fkey';
            columns: ['rental_id'];
            isOneToOne: false;
            referencedRelation: 'rentals';
            referencedColumns: ['id'];
          },
        ];
      };
      rentals: {
        Row: {
          client_id: string;
          created_at: string;
          created_by: string | null;
          departure_date: string;
          departure_location: string | null;
          deposit_amount: number;
          driving_zone: string | null;
          duration_days: number | null;
          id: string;
          notes: string | null;
          rental_price: number;
          return_date: string;
          return_location: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
          vehicle_id: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          departure_date: string;
          departure_location?: string | null;
          deposit_amount?: number;
          driving_zone?: string | null;
          duration_days?: number | null;
          id?: string;
          notes?: string | null;
          rental_price?: number;
          return_date: string;
          return_location?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          vehicle_id: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          departure_date?: string;
          departure_location?: string | null;
          deposit_amount?: number;
          driving_zone?: string | null;
          duration_days?: number | null;
          id?: string;
          notes?: string | null;
          rental_price?: number;
          return_date?: string;
          return_location?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'rentals_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rentals_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rentals_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rentals_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      reservations: {
        Row: {
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          client_contract_sent_at: string | null;
          client_contract_sent_by: string | null;
          client_id: string | null;
          client_profile_id: string | null;
          created_at: string;
          created_by: string | null;
          finalized_at: string | null;
          finalized_by: string | null;
          first_name: string;
          id: string;
          last_name: string;
          observation: string | null;
          phone: string;
          planned_departure_date: string;
          planned_return_date: string;
          quoted_deposit_amount: number | null;
          quoted_rental_price: number | null;
          rental_id: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
          validated_at: string | null;
          validated_by: string | null;
          vehicle_id: string;
        };
        Insert: {
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          client_contract_sent_at?: string | null;
          client_contract_sent_by?: string | null;
          client_id?: string | null;
          client_profile_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          finalized_at?: string | null;
          finalized_by?: string | null;
          first_name: string;
          id?: string;
          last_name: string;
          observation?: string | null;
          phone: string;
          planned_departure_date: string;
          planned_return_date: string;
          quoted_deposit_amount?: number | null;
          quoted_rental_price?: number | null;
          rental_id?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          validated_at?: string | null;
          validated_by?: string | null;
          vehicle_id: string;
        };
        Update: {
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          client_contract_sent_at?: string | null;
          client_contract_sent_by?: string | null;
          client_id?: string | null;
          client_profile_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          finalized_at?: string | null;
          finalized_by?: string | null;
          first_name?: string;
          id?: string;
          last_name?: string;
          observation?: string | null;
          phone?: string;
          planned_departure_date?: string;
          planned_return_date?: string;
          quoted_deposit_amount?: number | null;
          quoted_rental_price?: number | null;
          rental_id?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          validated_at?: string | null;
          validated_by?: string | null;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reservations_cancelled_by_fkey';
            columns: ['cancelled_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reservations_client_contract_sent_by_fkey';
            columns: ['client_contract_sent_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reservations_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reservations_client_profile_id_fkey';
            columns: ['client_profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reservations_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reservations_finalized_by_fkey';
            columns: ['finalized_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reservations_rental_id_fkey';
            columns: ['rental_id'];
            isOneToOne: true;
            referencedRelation: 'rentals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reservations_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reservations_validated_by_fkey';
            columns: ['validated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reservations_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      vehicle_documents: {
        Row: {
          created_at: string;
          document_name: string;
          document_type: string;
          expiry_date: string | null;
          file_size: number | null;
          id: string;
          issue_date: string | null;
          mime_type: string | null;
          storage_path: string;
          uploaded_by: string | null;
          vehicle_id: string;
        };
        Insert: {
          created_at?: string;
          document_name: string;
          document_type: string;
          expiry_date?: string | null;
          file_size?: number | null;
          id?: string;
          issue_date?: string | null;
          mime_type?: string | null;
          storage_path: string;
          uploaded_by?: string | null;
          vehicle_id: string;
        };
        Update: {
          created_at?: string;
          document_name?: string;
          document_type?: string;
          expiry_date?: string | null;
          file_size?: number | null;
          id?: string;
          issue_date?: string | null;
          mime_type?: string | null;
          storage_path?: string;
          uploaded_by?: string | null;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vehicle_documents_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicle_documents_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      vehicle_inspections: {
        Row: {
          created_at: string;
          created_by: string | null;
          damages: Json;
          fuel_level: string | null;
          id: string;
          inspection_date: string;
          inspection_type: string;
          mileage: number;
          observations: string | null;
          rental_id: string;
          vehicle_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          damages?: Json;
          fuel_level?: string | null;
          id?: string;
          inspection_date?: string;
          inspection_type: string;
          mileage?: number;
          observations?: string | null;
          rental_id: string;
          vehicle_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          damages?: Json;
          fuel_level?: string | null;
          id?: string;
          inspection_date?: string;
          inspection_type?: string;
          mileage?: number;
          observations?: string | null;
          rental_id?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vehicle_inspections_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicle_inspections_rental_id_fkey';
            columns: ['rental_id'];
            isOneToOne: false;
            referencedRelation: 'rentals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicle_inspections_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      vehicle_maintenance: {
        Row: {
          cost: number;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          invoice_storage_path: string | null;
          maintenance_date: string;
          maintenance_type: string;
          mileage: number | null;
          next_maintenance_date: string | null;
          provider_name: string | null;
          status: string;
          vehicle_id: string;
        };
        Insert: {
          cost?: number;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          invoice_storage_path?: string | null;
          maintenance_date: string;
          maintenance_type: string;
          mileage?: number | null;
          next_maintenance_date?: string | null;
          provider_name?: string | null;
          status?: string;
          vehicle_id: string;
        };
        Update: {
          cost?: number;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          invoice_storage_path?: string | null;
          maintenance_date?: string;
          maintenance_type?: string;
          mileage?: number | null;
          next_maintenance_date?: string | null;
          provider_name?: string | null;
          status?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vehicle_maintenance_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicle_maintenance_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      site_content: {
        Row: {
          content: Json;
          created_at: string;
          id: string;
          key: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          content?: Json;
          created_at?: string;
          id?: string;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          content?: Json;
          created_at?: string;
          id?: string;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'site_content_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      site_content_drafts: {
        Row: { content: Json; key: string; updated_at: string; updated_by: string | null };
        Insert: { content: Json; key: string; updated_at?: string; updated_by?: string | null };
        Update: { content?: Json; key?: string; updated_at?: string; updated_by?: string | null };
        Relationships: [];
      };
      site_content_versions: {
        Row: { content: Json; created_at: string; created_by: string | null; id: string; key: string };
        Insert: { content: Json; created_at?: string; created_by?: string | null; id?: string; key: string };
        Update: { content?: Json; created_at?: string; created_by?: string | null; id?: string; key?: string };
        Relationships: [
          {
            foreignKeyName: 'site_content_versions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      vehicles: {
        Row: {
          air_conditioning: boolean | null;
          approval_status: string;
          category: string | null;
          color: string | null;
          commission_amount: number | null;
          created_at: string;
          created_by: string | null;
          deposit_amount: number;
          doors: number | null;
          features: string[];
          fuel_type: string | null;
          id: string;
          insurance_expiry_date: string | null;
          make: string;
          mileage: number;
          model: string;
          notes: string | null;
          owner_type: string;
          partner_id: string | null;
          partner_requested_price: number | null;
          registration_number: string;
          rejection_reason: string | null;
          rental_price: number;
          reviewed_at: string | null;
          reviewed_by: string | null;
          seats: number | null;
          status: string;
          submitted_at: string | null;
          technical_inspection_expiry_date: string | null;
          transmission: string | null;
          updated_at: string;
          updated_by: string | null;
          year: number | null;
        };
        Insert: {
          air_conditioning?: boolean | null;
          approval_status?: string;
          category?: string | null;
          color?: string | null;
          commission_amount?: number | null;
          created_at?: string;
          created_by?: string | null;
          deposit_amount?: number;
          doors?: number | null;
          features?: string[];
          fuel_type?: string | null;
          id?: string;
          insurance_expiry_date?: string | null;
          make: string;
          mileage?: number;
          model: string;
          notes?: string | null;
          owner_type?: string;
          partner_id?: string | null;
          partner_requested_price?: number | null;
          registration_number: string;
          rejection_reason?: string | null;
          rental_price?: number;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          seats?: number | null;
          status?: string;
          submitted_at?: string | null;
          technical_inspection_expiry_date?: string | null;
          transmission?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          year?: number | null;
        };
        Update: {
          air_conditioning?: boolean | null;
          approval_status?: string;
          category?: string | null;
          color?: string | null;
          commission_amount?: number | null;
          created_at?: string;
          created_by?: string | null;
          deposit_amount?: number;
          doors?: number | null;
          features?: string[];
          fuel_type?: string | null;
          id?: string;
          insurance_expiry_date?: string | null;
          make?: string;
          mileage?: number;
          model?: string;
          notes?: string | null;
          owner_type?: string;
          partner_id?: string | null;
          partner_requested_price?: number | null;
          registration_number?: string;
          rejection_reason?: string | null;
          rental_price?: number;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          seats?: number | null;
          status?: string;
          submitted_at?: string | null;
          technical_inspection_expiry_date?: string | null;
          transmission?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          year?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'vehicles_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicles_partner_id_fkey';
            columns: ['partner_id'];
            isOneToOne: false;
            referencedRelation: 'partners';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicles_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicles_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      bootstrap_first_super_admin: {
        Args: { target_email: string };
        Returns: string;
      };
      cancel_reservation: {
        Args: { reason?: string; target_reservation_id: string };
        Returns: undefined;
      };
      client_available_vehicles: {
        Args: { target_departure?: string; target_return?: string };
        Returns: {
          category: string;
          color: string;
          deposit_amount: number;
          fuel_type: string;
          id: string;
          make: string;
          model: string;
          photo_storage_paths: string[];
          registration_number: string;
          rental_price: number;
          transmission: string;
          year: number;
        }[];
      };
      client_can_add_inspection_photo: {
        Args: { target_inspection_id: string };
        Returns: boolean;
      };
      client_cancel_reservation: {
        Args: { target_reservation_id: string };
        Returns: undefined;
      };
      client_contract_history: { Args: never; Returns: Json };
      client_create_inspection: {
        Args: {
          target_damages?: Json;
          target_fuel_level?: string;
          target_inspection_type: string;
          target_mileage: number;
          target_observations?: string;
          target_rental_id: string;
        };
        Returns: Json;
      };
      client_create_reservation: {
        Args: {
          target_departure: string;
          target_observation?: string;
          target_return: string;
          target_vehicle_id: string;
        };
        Returns: {
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          client_contract_sent_at: string | null;
          client_contract_sent_by: string | null;
          client_id: string | null;
          client_profile_id: string | null;
          created_at: string;
          created_by: string | null;
          finalized_at: string | null;
          finalized_by: string | null;
          first_name: string;
          id: string;
          last_name: string;
          observation: string | null;
          phone: string;
          planned_departure_date: string;
          planned_return_date: string;
          quoted_deposit_amount: number | null;
          quoted_rental_price: number | null;
          rental_id: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
          validated_at: string | null;
          validated_by: string | null;
          vehicle_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'reservations';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      client_inspection_eligible_rentals: { Args: never; Returns: Json };
      client_inspection_history: { Args: never; Returns: Json };
      client_owns_contract: {
        Args: { pending_only?: boolean; target_contract_id: string };
        Returns: boolean;
      };
      client_owns_inspection: {
        Args: { target_inspection_id: string };
        Returns: boolean;
      };
      client_owns_rental: {
        Args: { target_rental_id: string };
        Returns: boolean;
      };
      client_pending_contract_dossier: { Args: never; Returns: Json };
      client_refresh_contract_content: {
        Args: { target_contract_id: string };
        Returns: {
          contract_number: string | null;
          created_at: string;
          created_by: string | null;
          final_pdf_storage_path: string | null;
          generated_content: Json;
          generated_html: string | null;
          id: string;
          rental_id: string;
          signed_at: string | null;
          status: string;
          template_id: string | null;
          template_version_id: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'contracts';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      client_reservation_history: { Args: never; Returns: Json };
      client_submit_reservation_contract: {
        Args: {
          client_signature_storage_path: string;
          target_reservation_id: string;
        };
        Returns: Json;
      };
      confirm_rental_payment: {
        Args: { target_rental_id: string };
        Returns: Json;
      };
      create_rental_from_reservation: {
        Args: {
          target_client_id: string;
          target_departure_location: string;
          target_deposit_amount: number;
          target_driving_zone?: string;
          target_notes?: string;
          target_rental_price: number;
          target_reservation_id: string;
          target_return_location: string;
        };
        Returns: Json;
      };
      create_rental_from_wizard: {
        Args: {
          target_address: string;
          target_departure_date: string;
          target_departure_location: string;
          target_deposit_amount: number;
          target_driving_license_expiry_date: string;
          target_driving_license_number: string;
          target_driving_zone: string;
          target_email: string;
          target_emergency_contact_name: string;
          target_emergency_contact_phone: string;
          target_existing_client_id: string;
          target_first_name: string;
          target_id_document_number: string;
          target_last_name: string;
          target_payment_received: boolean;
          target_phone: string;
          target_rental_price: number;
          target_residence: string;
          target_return_date: string;
          target_return_location: string;
          target_vehicle_id: string;
        };
        Returns: Json;
      };
      dispatch_validated_reservation_to_client: {
        Args: {
          target_client_profile_id: string;
          target_reservation_id: string;
        };
        Returns: Json;
      };
      ensure_client_profile: {
        Args: {
          target_email?: string;
          target_first_name: string;
          target_last_name: string;
          target_phone: string;
        };
        Returns: {
          address: string | null;
          created_at: string;
          created_by: string | null;
          driving_license_expiry_date: string | null;
          driving_license_issue_date: string | null;
          driving_license_number: string | null;
          email: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          first_name: string;
          id: string;
          id_document_number: string | null;
          id_document_type: string | null;
          last_name: string;
          notes: string | null;
          phone: string | null;
          profile_id: string | null;
          residence: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'clients';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      ensure_partner_profile: {
        Args: {
          target_company_name: string;
          target_contact_name: string;
          target_email?: string;
          target_phone: string;
        };
        Returns: {
          company_name: string | null;
          contact_name: string;
          created_at: string;
          created_by: string | null;
          email: string | null;
          id: string;
          notes: string | null;
          payout_details: string | null;
          phone: string;
          profile_id: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'partners';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      evaluate_rental_status: {
        Args: { target_rental_id: string };
        Returns: undefined;
      };
      get_staff_display_names: {
        Args: { target_ids: string[] };
        Returns: {
          display_name: string;
          id: string;
        }[];
      };
      has_permission: {
        Args: { requested_action: string; requested_module: string };
        Returns: boolean;
      };
      is_client_account: { Args: never; Returns: boolean };
      is_partner_account: { Args: never; Returns: boolean };
      is_public_available_vehicle: {
        Args: { target_vehicle_id: string };
        Returns: boolean;
      };
      is_public_vehicle_photo: {
        Args: { target_path: string };
        Returns: boolean;
      };
      is_super_admin: { Args: never; Returns: boolean };
      partner_rental_earnings: {
        Args: never;
        Returns: {
          departure_date: string;
          id: string;
          make: string;
          model: string;
          payout: number;
          registration_number: string;
          return_date: string;
          status: string;
        }[];
      };
      public_available_vehicles: {
        Args: { target_departure?: string; target_return?: string };
        Returns: {
          category: string;
          color: string;
          deposit_amount: number;
          fuel_type: string;
          id: string;
          make: string;
          model: string;
          photo_storage_paths: string[];
          rental_price: number;
          transmission: string;
          year: number;
        }[];
      };
      public_catalog_vehicles: {
        Args: { target_departure?: string; target_return?: string };
        Returns: {
          air_conditioning: boolean | null;
          category: string;
          color: string;
          deposit_amount: number;
          doors: number | null;
          features: string[];
          fuel_type: string;
          id: string;
          is_available: boolean;
          make: string;
          mileage: number;
          model: string;
          photo_storage_paths: string[];
          rental_price: number;
          seats: number | null;
          transmission: string;
          year: number;
        }[];
      };
      public_company_contact: {
        Args: never;
        Returns: {
          address: string;
          business_hours: string;
          company_name: string;
          phone: string;
          secondary_phone: string;
          whatsapp_phone: string;
        }[];
      };
      refresh_overdue_rentals: { Args: never; Returns: number };
      rental_closure_blockers: {
        Args: { target_rental_id: string };
        Returns: string[];
      };
      rental_closure_blockers_internal: {
        Args: { target_rental_id: string };
        Returns: string[];
      };
      report_contract_correction: {
        Args: { correction_message: string; target_contract_id: string };
        Returns: undefined;
      };
      send_reservation_to_client: {
        Args: { target_reservation_id: string };
        Returns: Json;
      };
      send_reservation_to_selected_client: {
        Args: {
          target_client_profile_id: string;
          target_reservation_id: string;
        };
        Returns: Json;
      };
      set_automatic_rental_status: {
        Args: { target_rental_id: string; target_status: string };
        Returns: undefined;
      };
      validate_reservation: {
        Args: { target_reservation_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
