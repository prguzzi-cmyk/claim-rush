import { Component, OnDestroy } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { Router, NavigationStart } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-passkey-register-dialog',
  templateUrl: './passkey-register-dialog.component.html',
  styleUrls: ['./passkey-register-dialog.component.scss'],
  standalone: false,
})
export class PasskeyRegisterDialogComponent implements OnDestroy {
  registering: boolean = false;
  success: boolean = false;
  error: string = '';
  private routeSub: Subscription;

  constructor(
    private dialogRef: MatDialogRef<PasskeyRegisterDialogComponent>,
    private authService: AuthService,
    private router: Router,
  ) {
    // Auto-close when the user navigates away
    this.routeSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationStart))
      .subscribe(() => this.dialogRef.close());
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
  }

  register() {
    this.registering = true;
    this.error = '';
    this.authService.registerPasskey('My Device').subscribe({
      next: () => {
        this.registering = false;
        this.success = true;
      },
      error: (err: any) => {
        this.registering = false;
        this.error = 'Failed to set up passkey. You can try again later from your profile.';
      },
    });
  }

  dismiss() {
    localStorage.setItem('passkey_setup_dismissed', 'true');
    this.dialogRef.close();
  }

  close() {
    this.dialogRef.close();
  }
}
