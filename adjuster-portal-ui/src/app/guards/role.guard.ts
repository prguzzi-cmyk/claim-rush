import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';

/**
 * Blocks access to admin-only RIN routes for non-admin roles.
 *
 * Per route declaration:
 *   canActivate: [AuthGuard, RoleGuard]
 *   data: { allowedRoles: ['admin', 'super-admin'] }
 *
 * When the current user's role is not in `allowedRoles`:
 *   - cp / rvp / agent / manager  →  /app/portal/<user_id>
 *   - adjuster / client / customer / sales-rep / unknown
 *                                  →  ClaimRush portal (full origin redirect)
 *
 * Defense-in-depth only — the sidebar role-visibility config already hides
 * admin items, but URL-paste access bypassed sidebar visibility. This guard
 * closes that gap without changing the route surface.
 */
@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  constructor(
    private userService: UserService,
    private authService: AuthService,
    private router: Router,
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot,
  ): Observable<boolean> | Promise<boolean> | boolean {
    const allowedRoles: string[] = (route.data && route.data['allowedRoles']) || [];
    if (allowedRoles.length === 0) return true;

    return this.userService.currentUser.pipe(
      // BehaviorSubject seeds with the literal '' until getUser() resolves;
      // first switchMap branch loads the user if it's not yet populated.
      switchMap((user: any) => {
        if (user && user.id) return of(user);
        return this.userService.getUser();
      }),
      take(1),
      map((user: any) => {
        const roleName = (user?.role?.name || '').toLowerCase();
        if (allowedRoles.includes(roleName)) return true;
        this.redirectByRole(roleName, user?.id);
        return false;
      }),
      catchError(() => {
        // If the user lookup fails (token expired, network), defer to AuthGuard
        // by redirecting to login.
        this.router.navigate(['/login']);
        return of(false);
      }),
    );
  }

  private redirectByRole(roleName: string, userId: string | undefined): void {
    const portalRoles = new Set(['cp', 'rvp', 'agent', 'manager']);
    if (portalRoles.has(roleName) && userId) {
      this.router.navigate(['/app/portal', userId]);
      return;
    }
    // Adjuster, client, customer, sales-rep, unknown — bounce to ClaimRush.
    // Origin lookup priority:
    //   1. window-injected hint (CLAIMRUSH_URL global, future use)
    //   2. *.aciunited.com → https://aciunited.com
    //   3. localhost dev → http://localhost:5175
    const claimrushUrl = this.resolveClaimrushOrigin();
    window.location.href = `${claimrushUrl}/portal`;
  }

  private resolveClaimrushOrigin(): string {
    const w: any = window as any;
    if (w?.CLAIMRUSH_URL) return w.CLAIMRUSH_URL;
    const host = window.location.hostname || '';
    if (host.endsWith('aciunited.com')) return 'https://aciunited.com';
    return 'http://localhost:5175';
  }
}
