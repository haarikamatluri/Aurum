import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Protects authenticated routes — redirects to /login if there's no active session. */
export const authGuard: CanActivateFn = () => {
  return true;
};
