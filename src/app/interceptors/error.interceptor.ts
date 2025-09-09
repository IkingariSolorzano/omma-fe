import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError(error => {
      // Only handle errors for authenticated requests (skip public endpoints)
      if (req.url.includes('/auth/login') ||
          req.url.includes('/professionals') ||
          req.url.includes('/closed-dates') ||
          req.method === 'OPTIONS') {
        return throwError(() => error);
      }

      // Check if the error is related to token expiration
      // Handle 401 Unauthorized errors (invalid/expired token)
      if (error.status === 401) {
        console.error('Error 401: Unauthorized. Token might be invalid or expired.', error);
        authService.clearExpiredSession();
        return throwError(() => new Error('Su sesión ha expirado. Por favor, inicie sesión de nuevo.'));
      }

      // Handle 403 Forbidden errors (user authenticated but lacks permissions)
      if (error.status === 403) {
        console.warn('Error 403: Forbidden. El usuario no tiene permisos para este recurso.', error);
        // DO NOT log out. Just inform the user they don't have access.
        // The component that made the call can handle this error further if needed.
        return throwError(() => new Error('No tiene permiso para acceder a este recurso.'));
      }

      // If it's not a token error, rethrow the original error
      return throwError(() => error);
    })
  );
};
