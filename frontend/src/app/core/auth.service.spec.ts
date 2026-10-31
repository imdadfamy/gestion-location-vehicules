import { TestBed } from '@angular/core/testing';
import { AuthService, frenchError, resolveSupabaseConfig } from './auth.service';

describe('resolveSupabaseConfig', () => {
  const local = {
    production: false,
    supabaseUrl: 'http://127.0.0.1:54321',
    supabaseAnonKey: 'local',
  };
  const online = {
    production: false,
    supabaseUrl: 'https://abc.supabase.co',
    supabaseAnonKey: 'remote',
  };

  it('utilise la stack locale en développement', () => {
    expect(resolveSupabaseConfig(local, undefined).supabaseUrl).toBe('http://127.0.0.1:54321');
  });

  it('ignore config.js en développement', () => {
    expect(resolveSupabaseConfig(local, { ...online, production: true }).supabaseAnonKey).toBe(
      'local',
    );
  });

  it('refuse une URL en ligne en développement', () => {
    expect(() => resolveSupabaseConfig(online, undefined)).toThrow(/refusée/);
  });

  it('lit config.js en production', () => {
    const prod = { ...online, production: true, supabaseUrl: 'SUPABASE_URL' };
    expect(resolveSupabaseConfig(prod, online).supabaseUrl).toBe('https://abc.supabase.co');
  });
});

describe('frenchError', () => {
  it('traduit les refus RLS', () => {
    expect(frenchError({ message: 'new row violates row-level security policy' })).toContain(
      'permission',
    );
  });

  it('traduit un chevauchement de location', () => {
    expect(frenchError('conflicting key value violates exclusion constraint')).toBe(
      'Ce véhicule est déjà réservé sur cette période.',
    );
  });

  it('traduit le refus de statut côté partenaire', () => {
    expect(frenchError('Partner cannot change an operational vehicle status')).toContain(
      'personnel FIMA AUTO',
    );
  });

  it('nomme le champ obligatoire manquant', () => {
    expect(
      frenchError(
        'null value in column "registration_number" of relation "vehicles" violates not-null constraint',
      ),
    ).toBe('Le champ « Immatriculation » est obligatoire.');
  });

  it('conserve un message déjà en français', () => {
    expect(frenchError('Veuillez choisir un véhicule.')).toBe('Veuillez choisir un véhicule.');
  });

  it('masque un message technique inconnu', () => {
    expect(frenchError('relation "foo" does not exist')).toMatch(/^L’opération n’a pas pu/);
  });
});

describe('AuthService.can', () => {
  let auth: AuthService;
  beforeEach(() => (auth = TestBed.inject(AuthService)));

  it('refuse tout sans profil', () => {
    expect(auth.can('vehicles')).toBe(false);
  });

  it('autorise tout au Super Admin', () => {
    auth.profile.set({ role: 'super_admin', permissions: {} });
    expect(auth.can('users', 'delete')).toBe(true);
  });

  it('applique les permissions du Responsable par module et action', () => {
    auth.profile.set({ role: 'responsable', permissions: { vehicles: { view: true } } });
    expect(auth.can('vehicles')).toBe(true);
    expect(auth.can('vehicles', 'delete')).toBe(false);
    expect(auth.can('payments')).toBe(false);
  });
});
