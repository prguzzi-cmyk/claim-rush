import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard {
  constructor(
    private router: Router,
    private authService: AuthService,
  ) {}

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): Observable<boolean> | Promise<boolean> | boolean {
    if ((environment as any).devAutoLogin) return true;

    // Cross-origin auth handoff: when ClaimRush iframes a RIN route, the
    // parent passes the JWT as ?access_token=... — pick it up before the
    // localStorage check so the iframe renders the requested route
    // instead of bouncing to /login.
    this.authService.hydrateFromUrl();

    if (this.authService.isAuthenticated()) {
      return true;
    }

    // Store the intended URL for post-login redirect
    localStorage.setItem('redirectUrl', state.url);
    console.log('[REDIRECT-TRACE] auth.guard.ts canActivate pathname=', (typeof window !== 'undefined' && window.location?.pathname), 'state.url=', state.url, 'destination= login');
    this.router.navigate(['login']);
    return false;
  }
}
