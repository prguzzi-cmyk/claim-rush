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
  mode: LoginMode = 'main';
  credentials: any = {};
  magicLinkEmail: string = '';
  message: string = '';
  loginDisabled: boolean = false;
  magicLinkDisabled: boolean = false;
  passkeyDisabled: boolean = false;

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
    this.authService.logout();
    this.loadCapabilities();
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
              const redirectUrl = localStorage.getItem('redirectUrl');
              if (redirectUrl) {
                localStorage.removeItem('redirectUrl');
                this.router.navigateByUrl(redirectUrl);
              } else if (
                response?.role?.name == 'super-admin' ||
                response?.role?.name == 'admin'
              ) {
                this.router.navigate(['/app/agent-dashboard']);
              } else if (response?.role?.name == 'customer') {
                this.router.navigate(['/app/customer-dashboard']);
              } else if (response?.role?.name == 'sales-rep') {
                this.router.navigate(['/app/sales-dashboard']);
              } else {
                this.router.navigate(['/app/agent-dashboard']);
              }
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
            const redirectUrl = localStorage.getItem('redirectUrl');
            if (redirectUrl) {
              localStorage.removeItem('redirectUrl');
              this.router.navigateByUrl(redirectUrl);
            } else if (
              response?.role?.name == 'super-admin' ||
              response?.role?.name == 'admin'
            ) {
              this.router.navigate(['/app/agent-dashboard']);
            } else if (response?.role?.name == 'customer') {
              this.router.navigate(['/app/customer-dashboard']);
            } else if (response?.role?.name == 'sales-rep') {
              this.router.navigate(['/app/sales-dashboard']);
            } else {
              this.router.navigate(['/app/agent-dashboard']);
            }
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
          });
        }
      },
      error: () => {},
    });
  }
}
