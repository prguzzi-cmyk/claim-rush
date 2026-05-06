import { Component, OnInit } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { AuthService } from 'src/app/services/auth.service';
import { Router } from '@angular/router';
import { DialogService } from 'src/app/services/dialog.service';
import { ForgottenPasswordDialogComponent } from './../dialogs/forgotten-password-dialog/forgotten-password-dialog.component';
import { UserService } from 'src/app/services/user.service';
import { TabService } from 'src/app/services/tab.service';
import { MatDialog } from '@angular/material/dialog';
import { PasskeyRegisterDialogComponent } from '../dialogs/passkey-register-dialog/passkey-register-dialog.component';
import { environment } from 'src/environments/environment';
import { ROLE_LANDING, DEFAULT_LANDING, AppRole } from 'src/app/config/role-visibility';

export type LoginMode = 'main' | 'password' | 'magic-link' | 'magic-link-sent';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: false,
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-12px)' })),
      ]),
    ]),
  ],
})
export class LoginComponent implements OnInit {
  // Exposed to the template so we can suppress the login UI entirely when the
  // dev-auto-login bypass is on — prevents a login-screen flash even if the
  // route guard somehow lets the component mount.
  readonly devAutoLogin: boolean = !!(environment as any).devAutoLogin;

  mode: LoginMode = 'main';
  credentials: any = {};
  magicLinkEmail: string = '';
  message: string = '';
  loginDisabled: boolean = false;
  magicLinkDisabled: boolean = false;
  passkeyDisabled: boolean = false;
  hidePassword: boolean = true;

  passkeysAvailable: boolean = false;
  googleEnabled: boolean = false;
  googleClientId: string = '';
  magicLinkEnabled: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private userService: UserService,
    private dialogService: DialogService,
    private tabService: TabService,
    private dialog: MatDialog,
  ) {}

  ngOnInit() {
    // HARD GUARD: never redirect a user who is on /claim/<slug>. Even if
    // some upstream code path activated LoginComponent on a public intake
    // URL, return immediately so this ngOnInit cannot navigate the browser
    // away from the consumer-facing form. This is belt-and-braces — the
    // route + DevAutoLoginGuard already protect /claim/*, but we want a
    // last-mile guarantee.
    try {
      const path = (typeof window !== 'undefined' && window.location?.pathname) || '';
      if (path.startsWith('/claim/')) return;
    } catch {}

    // After an explicit logout the sticky flag is set; show the login form
    // even when devAutoLogin is on so the user can sign in as someone else.
    const loggedOut = this.authService.isLoggedOut();

    if ((environment as any).devAutoLogin && !loggedOut) {
      // Fresh dev boot — auto-login already ran in APP_INITIALIZER, so
      // skip the login UI and land on the dashboard.
      console.log('[REDIRECT-TRACE] login.component.ts ngOnInit(devAutoLogin) pathname=', (typeof window !== 'undefined' && window.location?.pathname), 'destination= /app/agent-dashboard');
      this.router.navigateByUrl('/app/agent-dashboard');
      return;
    }

    // Wipe any leftover token before showing the form (defensive — covers
    // the path where the user lands on /login without going through the
    // sidebar's logout button).
    this.authService.logout();
    this.loadCapabilities();
  }

  togglePasswordVisibility() {
    this.hidePassword = !this.hidePassword;
  }

  loadCapabilities() {
    this.authService.getAuthCapabilities().subscribe({
      next: (caps: any) => {
        this.passkeysAvailable = caps.passkeys;
        this.googleEnabled = caps.google;
        this.magicLinkEnabled = caps.magic_link;
      },
      error: () => {
        this.passkeysAvailable = false;
        this.googleEnabled = false;
        this.magicLinkEnabled = false;
      },
    });

    this.authService.getGoogleAuthStatus().subscribe({
      next: (status: any) => {
        this.googleEnabled = status.enabled;
        this.googleClientId = status.client_id;
      },
      error: () => {},
    });
  }

  setMode(mode: LoginMode) {
    this.message = '';
    this.mode = mode;
  }

  login() {
    this.loginDisabled = true;
    this.message = '';
    this.authService
      .login(this.credentials.email, this.credentials.password)
      .subscribe({
        next: () => {
          this.userService.getUser().subscribe((response) => {
            if (response) {
              this.tabService.setSideTitle('Dashboard');
              this.redirectAfterLogin(response);
              this.maybeOfferPasskeySetup();
            }
          });
        },
        error: (err: any) => {
          if (err?.status === 429) {
            this.message = 'Too many failed attempts. Please try again later.';
          } else {
            this.message = 'Unable to log in. Please check your email address and password.';
          }
          this.loginDisabled = false;
        },
        complete: () => {
          this.loginDisabled = false;
        },
      });
  }

  loginWithPasskey() {
    this.passkeyDisabled = true;
    this.message = '';
    this.authService.loginWithPasskey().subscribe({
      next: () => {
        this.userService.getUser().subscribe((response) => {
          if (response) {
            this.tabService.setSideTitle('Dashboard');
            this.redirectAfterLogin(response);
          }
        });
      },
      error: () => {
        this.message = 'Passkey authentication failed. Please try another method.';
        this.passkeyDisabled = false;
      },
      complete: () => {
        this.passkeyDisabled = false;
      },
    });
  }

  /**
   * Post-login redirect logic shared across password + passkey flows.
   *
   * Architecture: RIN is internal command-and-control for HOME_OFFICE/admin
   * roles only. CP / RVP / Agent / Adjuster all belong in ClaimRush — RIN
   * should never be the post-login destination for an external role.
   *
   *   - explicit redirectUrl in localStorage  → honor it (deep-link case)
   *   - cp / rvp / agent                      → /app/portal/<id>
   *   - adjuster                              → ClaimRush /portal
   *   - admin / super-admin / sales-rep / client → ROLE_LANDING fallback
   */
  private redirectAfterLogin(response: any): void {
    const redirectUrl = localStorage.getItem('redirectUrl');
    if (redirectUrl) {
      localStorage.removeItem('redirectUrl');
      this.router.navigateByUrl(redirectUrl);
      return;
    }

    const roleSlug = (response?.role?.name || '').toLowerCase() as AppRole;
    const isPortalRole = roleSlug === 'cp' || roleSlug === 'rvp' || roleSlug === 'agent';

    if (isPortalRole && response?.id) {
      this.router.navigate(['/app/portal', response.id]);
      return;
    }

    if (roleSlug === 'adjuster') {
      window.location.href = `${this.resolveClaimrushOrigin()}/portal`;
      return;
    }

    const target = ROLE_LANDING[roleSlug] ?? DEFAULT_LANDING;
    if (/^https?:\/\//.test(target)) {
      window.location.href = target;
    } else {
      this.router.navigate([target]);
    }
  }

  private resolveClaimrushOrigin(): string {
    const w: any = window as any;
    if (w?.CLAIMRUSH_URL) return w.CLAIMRUSH_URL;
    const host = window.location.hostname || '';
    if (host.endsWith('aciunited.com')) return 'https://aciunited.com';
    return 'http://localhost:5175';
  }

  requestMagicLink() {
    this.magicLinkDisabled = true;
    this.message = '';
    this.authService.requestMagicLink(this.magicLinkEmail).subscribe({
      next: () => {
        this.mode = 'magic-link-sent';
        this.magicLinkDisabled = false;
      },
      error: () => {
        this.message = 'Failed to send sign-in link. Please try again.';
        this.magicLinkDisabled = false;
      },
    });
  }

  openForgottenPasswordDialog() {
    this.dialogService.openDialog(ForgottenPasswordDialogComponent);
  }

  private maybeOfferPasskeySetup() {
    if (!this.passkeysAvailable) return;
    if (localStorage.getItem('passkey_setup_dismissed')) return;

    this.authService.getPasskeyCount().subscribe({
      next: (creds: any[]) => {
        if (creds.length === 0) {
          this.dialog.open(PasskeyRegisterDialogComponent, {
            width: '420px',
            disableClose: false,
            panelClass: 'dark-dialog-panel',
          });
        }
      },
      error: () => {},
    });
  }
}
