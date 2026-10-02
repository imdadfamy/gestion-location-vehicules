import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const clientGuard: CanActivateFn = async () => {
  const auth = inject(AuthService); const router = inject(Router);
  await auth.init();
  const profile = auth.profile();
  if (!profile?.is_active) return router.createUrlTree(['/client/login']);
  return profile.role === 'client' ? true : router.createUrlTree(['/dashboard']);
};
