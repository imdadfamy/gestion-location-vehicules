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

export const routes: Routes = [
 {path:'login', component:LoginComponent},
 {path:'', component:ShellComponent, canActivate:[authGuard], children:[
  {path:'dashboard',component:DashboardComponent}, {path:'my-profile',component:MyProfileComponent}, {path:'vehicles',component:VehiclesComponent,canActivate:[permissionGuard],data:{module:'vehicles'}}, {path:'clients',component:ClientsComponent,canActivate:[permissionGuard],data:{module:'clients'}}, {path:'reservation-client',component:ReservationClientComponent,canActivate:[permissionGuard],data:{module:'clients'}}, {path:'reservation-rental',component:ReservationRentalComponent,canActivate:[permissionGuard],data:{module:'rentals'}}, {path:'reservations',component:ReservationsComponent,canActivate:[permissionGuard],data:{module:'reservations'}}, {path:'rentals',component:RentalsComponent,canActivate:[permissionGuard],data:{module:'rentals'}}, {path:'contracts',component:ContractsComponent,canActivate:[permissionGuard],data:{module:'contracts'}}, {path:'payments',component:PaymentsComponent,canActivate:[permissionGuard],data:{module:'payments'}}, {path:'inspections',component:InspectionsComponent,canActivate:[permissionGuard],data:{module:'inspections'}}, {path:'maintenance',component:MaintenanceComponent,canActivate:[permissionGuard],data:{module:'maintenance'}}, {path:'incidents',component:IncidentsComponent,canActivate:[permissionGuard],data:{module:'incidents'}}, {path:'notifications',component:NotificationsComponent,canActivate:[permissionGuard],data:{module:'notifications'}}, {path:'settings',component:SettingsComponent,canActivate:[superAdminGuard]}, {path:'activity-logs',component:ActivityLogsComponent,canActivate:[superAdminGuard]},
 {path:'users',component:UsersComponent,canActivate:[superAdminGuard]}, {path:'contract-templates',component:ContractTemplatesComponent,canActivate:[superAdminGuard]}, {path:'reports',component:ReportsComponent,canActivate:[permissionGuard],data:{module:'reports'}}, {path:'',pathMatch:'full',redirectTo:'dashboard'}]},
 {path:'**',redirectTo:''}
];

