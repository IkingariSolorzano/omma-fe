import { Routes } from '@angular/router';
import { InicioComponent } from './components/inicio/inicio.component';
import { HeroComponent } from './components/hero/hero.component';
import { ContactComponent } from './components/contact/contact.component';
import { AboutComponent } from './components/about/about.component';
import { PricingComponent } from './components/pricing/pricing.component';
import { SpacesComponent } from './components/spaces/spaces.component';
import { ServicesComponent } from './components/services/services.component';
import { LoginComponent } from './components/login/login.component';
import { AdminDashboardComponent } from './components/admin/admin-dashboard.component';
import { UserManagementComponent } from './components/admin/user-management/user-management.component';
// Removed CreditsManagementComponent route and import
import { SpaceManagementComponent } from './components/admin/space-management/space-management.component';
import { ReservationManagementComponent } from './components/admin/reservation-management/reservation-management.component';
import { ProfessionalDashboardComponent } from './components/professional/professional-dashboard.component';
import { SpaceBookingComponent } from './components/professional/space-booking/space-booking.component';
import { ProfessionalDirectoryComponent } from './components/professional-directory/professional-directory.component';
import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { AdminLayoutComponent } from './components/admin/admin-layout.component';
import { ProfessionalLayoutComponent } from './components/professional/professional-layout.component';
// Removed PaymentManagementComponent route and import
import { CalendarViewComponent } from './components/admin/calendar-view/calendar-view.component';
import { BusinessHoursComponent } from './components/admin/business-hours/business-hours.component';

export const routes: Routes = [
    // Public routes
    {
        path: '',
        component: InicioComponent,
        children: [
            {
                path: '',
                component: HeroComponent
            },
            {
                path: 'contact',
                component: ContactComponent
            },
            {
                path: 'nosotros',
                component: AboutComponent
            },
            {
                path: 'pricing',
                component: PricingComponent
            },
            {
                path: 'spaces',
                component: SpacesComponent
            },
            {
                path: 'services',
                component: ServicesComponent
            }
        ]
    },
    
    // Authentication
    {
        path: 'login',
        component: LoginComponent
    },
    
    // Professional Directory (Public)
    {
        path: 'professionals',
        component: ProfessionalDirectoryComponent
    },
    
    // Admin routes
    {
        path: 'admin',
        component: AdminLayoutComponent,
        canActivate: [AdminGuard],
        children: [
            { path: '', component: AdminDashboardComponent },
            { path: 'users', component: UserManagementComponent },
            { path: 'spaces', component: SpaceManagementComponent },
            { path: 'reservations', component: ReservationManagementComponent },
            { path: 'calendar', component: CalendarViewComponent },
            { path: 'business-hours', component: BusinessHoursComponent }
        ]
    },
    
    // Professional routes
    {
        path: 'dashboard',
        component: ProfessionalLayoutComponent,
        canActivate: [AuthGuard],
        children: [
            { path: '', component: ProfessionalDashboardComponent },
            { path: 'spaces', component: SpaceBookingComponent }
        ]
    },
    
    // Redirects para unificar rutas
    {
        path: 'home',
        redirectTo: '',
        pathMatch: 'full'
    },
    {
        path: 'inicio',
        redirectTo: '',
        pathMatch: 'full'
    },
    
    // Wildcard route
    {
        path: '**',
        redirectTo: ''
    }
];
