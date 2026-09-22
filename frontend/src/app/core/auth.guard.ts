import { inject } from '@angular/core'; import { CanActivateFn, Router } from '@angular/router'; import { AuthService } from './auth.service';
export const authGuard:CanActivateFn=async()=>{const a=inject(AuthService),r=inject(Router); await a.init(); return a.profile()?.is_active ? true : r.createUrlTree(['/login']);};
export const superAdminGuard:CanActivateFn=()=>{const a=inject(AuthService),r=inject(Router);return a.profile()?.role==='super_admin'||r.createUrlTree(['/dashboard']);};
export const permissionGuard:CanActivateFn=(route)=>{const a=inject(AuthService),r=inject(Router);return a.can(String(route.data?.['module']))||r.createUrlTree(['/dashboard']);};
