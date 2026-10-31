import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { authGuard, permissionGuard, superAdminGuard } from './auth.guard';
import { clientGuard } from './client.guard';
import { partnerGuard } from './partner.guard';

class FakeAuth {
  current: any = null;
  profile = () => this.current;
  init = async () => undefined;
  can(module: string, action = 'view') {
    return (
      this.current?.role === 'super_admin' || this.current?.permissions?.[module]?.[action] === true
    );
  }
}

describe('guards', () => {
  let auth: FakeAuth;
  let router: Router;
  const route = (module?: string) => ({ data: { module } }) as unknown as ActivatedRouteSnapshot;
  const run = (guard: any, snapshot = route()) =>
    TestBed.runInInjectionContext(() => guard(snapshot, {} as any));
  const target = (result: unknown) => router.serializeUrl(result as UrlTree);

  beforeEach(() => {
    auth = new FakeAuth();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    router = TestBed.inject(Router);
  });

  it('authGuard renvoie vers /login sans session', async () => {
    expect(target(await run(authGuard))).toBe('/login');
  });

  it('authGuard refuse un compte désactivé', async () => {
    auth.current = { role: 'responsable', is_active: false };
    expect(target(await run(authGuard))).toBe('/login');
  });

  it('authGuard renvoie un client vers son portail', async () => {
    auth.current = { role: 'client', is_active: true };
    expect(target(await run(authGuard))).toBe('/client/vehicles');
  });

  it('authGuard laisse passer le personnel actif', async () => {
    auth.current = { role: 'responsable', is_active: true };
    expect(await run(authGuard)).toBe(true);
  });

  it('permissionGuard applique la permission du module', () => {
    auth.current = { role: 'responsable', permissions: { vehicles: { view: true } } };
    expect(run(permissionGuard, route('vehicles'))).toBe(true);
    expect(target(run(permissionGuard, route('payments')))).toBe('/dashboard');
  });

  it('superAdminGuard réserve l’administration au Super Admin', () => {
    auth.current = { role: 'responsable', permissions: {} };
    expect(target(run(superAdminGuard))).toBe('/dashboard');
    auth.current = { role: 'super_admin' };
    expect(run(superAdminGuard)).toBe(true);
  });

  it('clientGuard et partnerGuard cloisonnent les espaces', async () => {
    auth.current = { role: 'partner', is_active: true };
    expect(target(await run(clientGuard))).toBe('/dashboard');
    expect(await run(partnerGuard)).toBe(true);
    auth.current = { role: 'client', is_active: true };
    expect(await run(clientGuard)).toBe(true);
    expect(target(await run(partnerGuard))).toBe('/dashboard');
  });
});
