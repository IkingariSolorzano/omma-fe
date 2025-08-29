import { Routes } from '@angular/router';
import { InicioComponent } from './components/inicio/inicio.component';
import { HeroComponent } from './components/hero/hero.component';
import { ContactComponent } from './components/contact/contact.component';
import { AboutComponent } from './components/about/about.component';
import { PricingComponent } from './components/pricing/pricing.component';
import { SpacesComponent } from './components/spaces/spaces.component';
import { ServicesComponent } from './components/services/services.component';

export const routes: Routes = [
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
    }
];
