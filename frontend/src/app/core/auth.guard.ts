import { inject } from '@angular/core'; import { CanActivateFn, Router } from '@angular/router'; import { AuthService } from './auth.service';
export const authGuard:CanActivateFn=async()=>{const a=inject(AuthService),r=inject(Router); await a.init(); const profile=a.profile(); if(!profile?.is_active)return r.createUrlTree(['/login']); return profile.role==='client'?r.createUrlTree(['/client/vehicles']):true;};
export const superAdminGuard:CanActivateFn=()=>{const a=inject(AuthService),r=inject(Router);return a.profile()?.role==='super_admin'||r.createUrlTree(['/dashboard']);};
export const permissionGuard:CanActivateFn=(route)=>{const a=inject(AuthService),r=inject(Router);return a.can(String(route.data?.['module']))||r.createUrlTree(['/dashboard']);};
