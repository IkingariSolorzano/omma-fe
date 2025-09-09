import { ApplicationConfig, provideZoneChangeDetection, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { errorInterceptor } from './interceptors/error.interceptor';
import { importProvidersFrom } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faUsers,
  faCreditCard,
  faClock,
  faExclamationTriangle,
  faExclamationCircle,
  faBan,
  faBuilding,
  faCalendarWeek,
  faCheckCircle,
  faChartLine,
  faMoneyBillWave,
  faHistory,
  faTimes,
  faBars,
  faCog,
  faSignOutAlt,
  faUserFriends,
  faHospital,
  faCalendarAlt,
  faClipboardList
} from '@fortawesome/free-solid-svg-icons';

library.add(
  faUsers,
  faCreditCard,
  faClock,
  faExclamationTriangle,
  faExclamationCircle,
  faBan,
  faBuilding,
  faCalendarWeek,
  faCheckCircle,
  faChartLine,
  faMoneyBillWave,
  faHistory,
  faTimes,
  faBars,
  faCog,
  faSignOutAlt,
  faUserFriends,
  faHospital,
  faCalendarAlt,
  faClipboardList
);

registerLocaleData(localeEs);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    importProvidersFrom(FontAwesomeModule),
    { provide: LOCALE_ID, useValue: 'es' }
  ]
};


