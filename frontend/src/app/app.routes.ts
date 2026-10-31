import { Routes } from '@angular/router';
import { authGuard, superAdminGuard, permissionGuard } from './core/auth.guard';
import { clientGuard } from './core/client.guard';
import { partnerGuard } from './core/partner.guard';
import { HomeComponent } from './features/public/home.component';

// Seule la page d'accueil est chargée au démarrage ; chaque écran est téléchargé
// à la première visite (un espace client ne charge jamais le back-office).
const staff = (module: string) => ({ canActivate: [permissionGuard], data: { module } });

export const routes: Routes = [
  { path: '', component: HomeComponent },
  {
    path: 'vehicules',
    loadComponent: () =>
      import('./features/public/public-vehicles.component').then((m) => m.PublicVehiclesComponent),
  },
  {
    path: 'invite',
    loadComponent: () => import('./features/auth/invite.component').then((m) => m.InviteComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  ...['client/login', 'client/register'].map((path) => ({
    path,
    loadComponent: () =>
      import('./features/auth/client-auth.component').then((m) => m.ClientAuthComponent),
  })),
  ...['partner/login', 'partner/register'].map((path) => ({
    path,
    loadComponent: () =>
      import('./features/auth/partner-auth.component').then((m) => m.PartnerAuthComponent),
  })),
  {
    path: 'client',
    loadComponent: () =>
      import('./layout/client-shell.component').then((m) => m.ClientShellComponent),
    canActivate: [clientGuard],
    children: [
      {
        path: 'vehicles',
        loadComponent: () =>
          import('./features/client-portal/client-portal.component').then(
            (m) => m.ClientPortalComponent,
          ),
      },
      {
        path: 'reservations',
        loadComponent: () =>
          import('./features/client-portal/client-reservations.component').then(
            (m) => m.ClientReservationsComponent,
          ),
      },
      {
        path: 'contracts',
        loadComponent: () =>
          import('./features/client-portal/client-contracts.component').then(
            (m) => m.ClientContractsComponent,
          ),
      },
      {
        path: 'inspections',
        loadComponent: () =>
          import('./features/client-portal/client-inspections.component').then(
            (m) => m.ClientInspectionsComponent,
          ),
      },
      {
        path: 'account',
        loadComponent: () =>
          import('./features/client-portal/client-account.component').then(
            (m) => m.ClientAccountComponent,
          ),
      },
      { path: '', pathMatch: 'full', redirectTo: 'vehicles' },
    ],
  },
  {
    path: 'partner',
    loadComponent: () =>
      import('./layout/partner-shell.component').then((m) => m.PartnerShellComponent),
    canActivate: [partnerGuard],
    children: [
      {
        path: 'vehicles',
        loadComponent: () =>
          import('./features/partner-portal/partner-vehicles.component').then(
            (m) => m.PartnerVehiclesComponent,
          ),
      },
      {
        path: 'maintenance',
        loadComponent: () =>
          import('./features/partner-portal/partner-maintenance.component').then(
            (m) => m.PartnerMaintenanceComponent,
          ),
      },
      {
        path: 'inspections',
        loadComponent: () =>
          import('./features/partner-portal/partner-inspections.component').then(
            (m) => m.PartnerInspectionsComponent,
          ),
      },
      {
        path: 'earnings',
        loadComponent: () =>
          import('./features/partner-portal/partner-earnings.component').then(
            (m) => m.PartnerEarningsComponent,
          ),
      },
      {
        path: 'account',
        loadComponent: () =>
          import('./features/partner-portal/partner-account.component').then(
            (m) => m.PartnerAccountComponent,
          ),
      },
      { path: '', pathMatch: 'full', redirectTo: 'vehicles' },
    ],
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'my-profile',
        loadComponent: () =>
          import('./features/administration/my-profile.component').then(
            (m) => m.MyProfileComponent,
          ),
      },
      {
        path: 'vehicles',
        ...staff('vehicles'),
        loadComponent: () =>
          import('./features/vehicles/vehicles.component').then((m) => m.VehiclesComponent),
      },
      {
        path: 'clients',
        ...staff('clients'),
        loadComponent: () =>
          import('./features/clients/clients.component').then((m) => m.ClientsComponent),
      },
      {
        path: 'reservation-client',
        ...staff('clients'),
        loadComponent: () =>
          import('./features/clients/reservation-client.component').then(
            (m) => m.ReservationClientComponent,
          ),
      },
      {
        path: 'reservation-rental',
        ...staff('rentals'),
        loadComponent: () =>
          import('./features/rentals/reservation-rental.component').then(
            (m) => m.ReservationRentalComponent,
          ),
      },
      {
        path: 'reservations',
        ...staff('reservations'),
        loadComponent: () =>
          import('./features/reservations/reservations.component').then(
            (m) => m.ReservationsComponent,
          ),
      },
      {
        path: 'rentals',
        ...staff('rentals'),
        loadComponent: () =>
          import('./features/rentals/rentals.component').then((m) => m.RentalsComponent),
      },
      {
        path: 'contracts',
        ...staff('contracts'),
        loadComponent: () =>
          import('./features/contracts/contracts.component').then((m) => m.ContractsComponent),
      },
      {
        path: 'payments',
        ...staff('payments'),
        loadComponent: () =>
          import('./features/payments/payments.component').then((m) => m.PaymentsComponent),
      },
      {
        path: 'inspections',
        ...staff('inspections'),
        loadComponent: () =>
          import('./features/inspections/inspections.component').then(
            (m) => m.InspectionsComponent,
          ),
      },
      {
        path: 'maintenance',
        ...staff('maintenance'),
        loadComponent: () =>
          import('./features/maintenance/maintenance.component').then(
            (m) => m.MaintenanceComponent,
          ),
      },
      {
        path: 'incidents',
        ...staff('incidents'),
        loadComponent: () =>
          import('./features/incidents/incidents.component').then((m) => m.IncidentsComponent),
      },
      {
        path: 'notifications',
        ...staff('notifications'),
        loadComponent: () =>
          import('./features/notifications/notifications.component').then(
            (m) => m.NotificationsComponent,
          ),
      },
      {
        path: 'partners',
        ...staff('partners'),
        loadComponent: () =>
          import('./features/partners/partners.component').then((m) => m.PartnersComponent),
      },
      {
        path: 'settings',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/administration/settings.component').then((m) => m.SettingsComponent),
      },
      {
        path: 'activity-logs',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/administration/activity-logs.component').then(
            (m) => m.ActivityLogsComponent,
          ),
      },
      {
        path: 'users',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/administration/users.component').then((m) => m.UsersComponent),
      },
      {
        path: 'contract-templates',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/administration/contract-templates.component').then(
            (m) => m.ContractTemplatesComponent,
          ),
      },
      {
        path: 'reports',
        ...staff('reports'),
        loadComponent: () =>
          import('./features/reports/reports.component').then((m) => m.ReportsComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: '' },
];
