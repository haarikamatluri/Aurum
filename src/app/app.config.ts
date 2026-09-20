import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';
import { ThemeService } from './core/services/theme.service';
import { AuthService } from './core/services/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideAppInitializer(() => {
      // Instantiate eagerly so the theme attribute is applied before first paint.
      inject(ThemeService);
    }),
    provideAppInitializer(() => {
      // Restore any existing session before the router's first navigation
      // so auth/guest guards see a settled state, not a loading one.
      return inject(AuthService).bootstrap();
    }),
  ],
};
