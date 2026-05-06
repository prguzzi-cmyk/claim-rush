import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { JwtHelperService } from '@auth0/angular-jwt';
import { Router } from '@angular/router';
import { map, catchError, switchMap } from 'rxjs/operators';
import { throwError, from, Observable, of } from 'rxjs';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(
    private http: HttpClient,
    private jwtHelper: JwtHelperService,
    private router: Router,
  ) {}

  // Sticky flag set on logout. Survives the localStorage wipe (it's the
  // last thing logout() writes) and is cleared by any successful login. Lets
  // the AuthGuard, devAutoLoginInitializer, and login page agree that "the
  // user explicitly logged out" — so dev-auto-login can't silently
  // resurrect a session.
  private static readonly LOGGED_OUT_KEY = 'logged_out';

  isAuthenticated(): boolean {
    if (this.isLoggedOut()) return false;
    const token = this.getToken();
    if (!token) return false;
    try {
      return !this.jwtHelper.isTokenExpired(token);
    } catch {
      return false;
    }
  }

  isLoggedOut(): boolean {
    try {
      return localStorage.getItem(AuthService.LOGGED_OUT_KEY) === '1';
    } catch {
      return false;
    }
  }

  private clearLoggedOutFlag(): void {
    try { localStorage.removeItem(AuthService.LOGGED_OUT_KEY); } catch {}
  }

  getToken(): string {
    const raw = localStorage.getItem('access_token');
    return raw ? JSON.parse(raw) : null;
  }

  // ─── Password login ───
  login(email: string, password: string) {
    return this.http
      .post<any>('auth/login', {
        username: email,
        password: password,
      })
      .pipe(
        map((authentication) => {
          if (authentication && authentication.access_token) {
            localStorage.setItem(
              'access_token',
              JSON.stringify(authentication.access_token),
            );
            this.clearLoggedOutFlag();
          }
          return authentication;
        }),
      );
  }

  // ─── Auth capabilities ───
  getAuthCapabilities(): Observable<any> {
    // Dev bypass: skip the backend hop; surface disabled capabilities so nothing renders.
    if ((environment as any).devAutoLogin) {
      return of({ passkeys: false, google: false, magic_link: false });
    }
    return this.http.get<any>('auth/capabilities');
  }

  // ─── Google ───
  getGoogleAuthStatus(): Observable<any> {
    // Dev bypass: never hit Railway for OAuth status while the flag is on.
    if ((environment as any).devAutoLogin) {
      return of({ enabled: false, client_id: '' });
    }
    return this.http.get<any>('auth/google/status');
  }

  loginWithGoogle(idToken: string): Observable<any> {
    return this.http.post<any>('auth/google/verify', { id_token: idToken }).pipe(
      map((auth) => {
        if (auth && auth.access_token) {
          localStorage.setItem('access_token', JSON.stringify(auth.access_token));
          this.clearLoggedOutFlag();
        }
        return auth;
      }),
    );
  }

  // ─── Magic Link ───
  requestMagicLink(email: string): Observable<any> {
    return this.http.post<any>('auth/magic-link/request', { email });
  }

  verifyMagicLink(token: string): Observable<any> {
    return this.http.post<any>('auth/magic-link/verify', { token }).pipe(
      map((auth) => {
        if (auth && auth.access_token) {
          localStorage.setItem('access_token', JSON.stringify(auth.access_token));
          this.clearLoggedOutFlag();
        }
        return auth;
      }),
    );
  }

  // ─── Passkeys ───
  loginWithPasskey(email?: string): Observable<any> {
    return this.http
      .post<any>('auth/webauthn/authenticate/options', { email: email || null })
      .pipe(
        switchMap((options: any) => {
          const challengeKey = options._challenge_key;
          delete options._challenge_key;
          return from(startAuthentication(options)).pipe(
            map((cred) => ({ cred, challengeKey })),
          );
        }),
        switchMap(({ cred, challengeKey }) => {
          const payload: any = { credential: cred };
          if (challengeKey) {
            payload.credential._challenge_key = challengeKey;
          }
          return this.http.post<any>('auth/webauthn/authenticate/verify', payload, {
            headers: { 'x-challenge-key': challengeKey || '' },
          });
        }),
        map((auth) => {
          if (auth && auth.access_token) {
            localStorage.setItem('access_token', JSON.stringify(auth.access_token));
            this.clearLoggedOutFlag();
          }
          return auth;
        }),
      );
  }

  registerPasskey(deviceName?: string): Observable<any> {
    return this.http
      .post<any>('auth/webauthn/register/options', { device_name: deviceName || null })
      .pipe(
        switchMap((options) => from(startRegistration(options))),
        switchMap((cred) =>
          this.http.post<any>('auth/webauthn/register/verify', {
            credential: cred,
            device_name: deviceName,
          }),
        ),
      );
  }

  getPasskeyCount(): Observable<any[]> {
    return this.http.get<any[]>('auth/webauthn/credentials');
  }

  // ─── Existing methods ───
  refreshToken() {
    return this.http.post<any>('auth/refresh', {}).pipe(
      map((authentication) => {
        if (authentication && authentication.access_token) {
          localStorage.setItem(
            'access_token',
            JSON.stringify(authentication.access_token),
          );
        }
        return authentication;
      }),
    );
  }

  checkRegistrationHash(hash: string) {
    return this.http.post<any>('auth/check-registration-hash', { hash: hash });
  }

  register(hash: string, password: string) {
    return this.http.post<any>('auth/register', {
      hash: hash,
      password: password,
    });
  }

  requestPasswordReset(email: string) {
    return this.http
      .post('auth/password-recovery/' + email, { email: email })
      .pipe(
        map((response) => response),
        catchError((error) => throwError(error)),
      );
  }

  checkPasswordResetToken(token: string) {
    return this.http.post<any>('auth/check-password-reset-token', { token: token });
  }

  resetPassword(token: string, password: string) {
    return this.http.post<any>('auth/reset-password', {
      token: token,
      password: password,
    });
  }

  logout() {
    // Wipe all client-side auth state. localStorage.clear() is intentional —
    // we'd rather the user lose ephemeral UI prefs than have stale tokens
    // survive logout (the bug we fixed earlier: stale staging tokens kept the
    // app in a half-authenticated 401 loop).
    try { localStorage.clear(); } catch { /* private mode */ }
    try { sessionStorage.clear(); } catch { /* private mode */ }

    // Sticky flag — written AFTER the wipe so it survives. Read by
    // AuthGuard / isAuthenticated() / devAutoLoginInitializer / the login
    // page so an explicit logout sticks even when devAutoLogin is on.
    try { localStorage.setItem(AuthService.LOGGED_OUT_KEY, '1'); } catch {}

    // Best-effort cookie wipe for the current origin + parent domain.
    if (typeof document !== 'undefined') {
      const host = location.hostname;
      const baseDomain = host.includes('.') ? host.split('.').slice(-2).join('.') : host;
      const expire = 'expires=Thu, 01 Jan 1970 00:00:00 GMT';
      for (const c of document.cookie.split(';')) {
        const name = c.split('=')[0].trim();
        if (!name) continue;
        document.cookie = `${name}=; path=/; ${expire}`;
        document.cookie = `${name}=; path=/; domain=${host}; ${expire}`;
        document.cookie = `${name}=; path=/; domain=.${baseDomain}; ${expire}`;
      }
    }

    console.log('[REDIRECT-TRACE] auth.service.ts logout() pathname=', (typeof window !== 'undefined' && window.location?.pathname), 'destination= /login', new Error().stack);
    this.router.navigate(['/login']);
  }
}
