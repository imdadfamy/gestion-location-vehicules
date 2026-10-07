import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const partnerGuard: CanActivateFn = async () => {
  const auth = inject(AuthService); const router = inject(Router);
  await auth.init();
  const profile = auth.profile();
  if (!profile?.is_active) return router.createUrlTree(['/partner/login']);
  return profile.role === 'partner' ? true : router.createUrlTree(['/dashboard']);
};
