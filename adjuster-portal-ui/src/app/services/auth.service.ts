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

  isAuthenticated(): boolean {
    if ((environment as any).devAutoLogin) return true;
    const token = this.getToken();
    return !this.jwtHelper.isTokenExpired(token);
  }

  getToken(): string {
    return JSON.parse(localStorage.getItem('access_token'));
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
    localStorage.removeItem('access_token');
    localStorage.removeItem('original_access_token');
    this.router.navigate(['/login']);
  }
}
