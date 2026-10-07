import { Routes } from '@angular/router';
import { authGuard, superAdminGuard, permissionGuard } from './core/auth.guard';
import { LoginComponent } from './features/login.component';
import { ShellComponent } from './layout/shell.component';
import { DashboardComponent } from './features/dashboard.component';
import { VehiclesComponent } from './features/vehicles.component';
import { UsersComponent } from './features/users.component';
import { ClientsComponent } from './features/clients.component';
import { RentalsComponent } from './features/rentals.component';
import { ReservationsComponent } from './features/reservations.component';
import { ReservationClientComponent } from './features/reservation-client.component';
import { ReservationRentalComponent } from './features/reservation-rental.component';
import { ContractsComponent } from './features/contracts.component';
import { PaymentsComponent } from './features/payments.component';
import { InspectionsComponent } from './features/inspections.component';
import { MaintenanceComponent } from './features/maintenance.component';
import { IncidentsComponent } from './features/incidents.component';
import { NotificationsComponent } from './features/notifications.component';
import { SettingsComponent } from './features/settings.component';
import { ActivityLogsComponent } from './features/activity-logs.component';
import { ReportsComponent } from './features/reports.component';
import { ContractTemplatesComponent } from './features/contract-templates.component';
import { MyProfileComponent } from './features/my-profile.component';
import { clientGuard } from './core/client.guard';
import { ClientShellComponent } from './layout/client-shell.component';
import { ClientAuthComponent } from './features/client-auth.component';
import { ClientPortalComponent } from './features/client-portal.component';
import { ClientReservationsComponent } from './features/client-reservations.component';
import { ClientAccountComponent } from './features/client-account.component';
import { ClientContractsComponent } from './features/client-contracts.component';
import { ClientInspectionsComponent } from './features/client-inspections.component';
import { HomeComponent } from './features/home.component';
import { PublicVehiclesComponent } from './features/public-vehicles.component';
import { InviteComponent } from './features/invite.component';

export const routes: Routes = [
 {path:'', component:HomeComponent},
 {path:'vehicules', component:PublicVehiclesComponent},
 {path:'invite', component:InviteComponent},
 {path:'login', component:LoginComponent},
 {path:'client/login', component:ClientAuthComponent},
 {path:'client/register', component:ClientAuthComponent},
 {path:'client',component:ClientShellComponent,canActivate:[clientGuard],children:[
  {path:'vehicles',component:ClientPortalComponent},
  {path:'reservations',component:ClientReservationsComponent},
  {path:'contracts',component:ClientContractsComponent},
  {path:'inspections',component:ClientInspectionsComponent},
  {path:'account',component:ClientAccountComponent},
  {path:'',pathMatch:'full',redirectTo:'vehicles'}
 ]},
 {path:'', component:ShellComponent, canActivate:[authGuard], children:[
  {path:'dashboard',component:DashboardComponent}, {path:'my-profile',component:MyProfileComponent}, {path:'vehicles',component:VehiclesComponent,canActivate:[permissionGuard],data:{module:'vehicles'}}, {path:'clients',component:ClientsComponent,canActivate:[permissionGuard],data:{module:'clients'}}, {path:'reservation-client',component:ReservationClientComponent,canActivate:[permissionGuard],data:{module:'clients'}}, {path:'reservation-rental',component:ReservationRentalComponent,canActivate:[permissionGuard],data:{module:'rentals'}}, {path:'reservations',component:ReservationsComponent,canActivate:[permissionGuard],data:{module:'reservations'}}, {path:'rentals',component:RentalsComponent,canActivate:[permissionGuard],data:{module:'rentals'}}, {path:'contracts',component:ContractsComponent,canActivate:[permissionGuard],data:{module:'contracts'}}, {path:'payments',component:PaymentsComponent,canActivate:[permissionGuard],data:{module:'payments'}}, {path:'inspections',component:InspectionsComponent,canActivate:[permissionGuard],data:{module:'inspections'}}, {path:'maintenance',component:MaintenanceComponent,canActivate:[permissionGuard],data:{module:'maintenance'}}, {path:'incidents',component:IncidentsComponent,canActivate:[permissionGuard],data:{module:'incidents'}}, {path:'notifications',component:NotificationsComponent,canActivate:[permissionGuard],data:{module:'notifications'}}, {path:'settings',component:SettingsComponent,canActivate:[superAdminGuard]}, {path:'activity-logs',component:ActivityLogsComponent,canActivate:[superAdminGuard]},
 {path:'users',component:UsersComponent,canActivate:[superAdminGuard]}, {path:'contract-templates',component:ContractTemplatesComponent,canActivate:[superAdminGuard]}, {path:'reports',component:ReportsComponent,canActivate:[permissionGuard],data:{module:'reports'}}, {path:'',pathMatch:'full',redirectTo:'dashboard'}]},
 {path:'**',redirectTo:''}
];

