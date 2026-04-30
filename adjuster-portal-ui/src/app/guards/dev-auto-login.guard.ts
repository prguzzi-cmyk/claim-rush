import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { environment } from 'src/environments/environment';

/**
 * When devAutoLogin is on, redirect public/landing and /login straight into the app shell.
 * Returning a UrlTree from canActivate prevents the target component from mounting at all,
 * which kills the "landing flash → portal" flicker we used to see.
 *
 * Pass-through prefixes:
 *   /claim/   — consumer-facing intake landing, must never be hijacked
 *   /app/     — any in-app URL is already a valid destination; the guard's
 *               job is to escort *public* URLs into the app, not to overwrite
 *               an explicit deep link (e.g. /app/launch-control would
 *               otherwise be silently rewritten to /app/agent-dashboard
 *               whenever this guard runs as part of the boot/login chain).
 */
const _PUBLIC_PASSTHROUGH_PREFIXES = ['/claim/', '/app/'];

@Injectable({ providedIn: 'root' })
export class DevAutoLoginGuard {
  constructor(private router: Router) {}

  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): true | UrlTree {
    const url = state?.url || '';
    if (_PUBLIC_PASSTHROUGH_PREFIXES.some((p) => url.startsWith(p))) {
      return true;
    }
    if ((environment as any).devAutoLogin) {
      // Preserve deep-link intent on hard refresh. With HashLocationStrategy,
      // refreshing http://localhost:4200/app/<route> arrives at the empty
      // hash, which resolves to the empty-path landing route — `state.url`
      // is '/' even though the user clearly wanted /app/<route>. Read
      // window.location.pathname; if it already targets an /app/* URL,
      // route the user there instead of clobbering the destination with
      // the default agent-dashboard landing.
      let destination = '/app/agent-dashboard';
      try {
        const pathname = (typeof window !== 'undefined' && window.location?.pathname) || '';
        if (pathname.startsWith('/app/') && pathname.length > '/app/'.length) {
          destination = pathname;
        }
      } catch { /* SSR or no window — fall through to default */ }
      console.log('[REDIRECT-TRACE] dev-auto-login.guard.ts canActivate pathname=', (typeof window !== 'undefined' && window.location?.pathname), 'state.url=', url, 'destination=', destination);
      return this.router.parseUrl(destination);
    }
    return true;
  }
}
