import { Injectable } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { environment } from 'src/environments/environment';

/**
 * When devAutoLogin is on, redirect public/landing and /login straight into the app shell.
 * Returning a UrlTree from canActivate prevents the target component from mounting at all,
 * which kills the "landing flash → portal" flicker we used to see.
 */
@Injectable({ providedIn: 'root' })
export class DevAutoLoginGuard {
  constructor(private router: Router) {}

  canActivate(): true | UrlTree {
    if ((environment as any).devAutoLogin) {
      return this.router.parseUrl('/app/agent-dashboard');
    }
    return true;
  }
}
