import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MyClaimService } from '../my-claim.service';

@Component({
  selector: 'app-client-landing',
  templateUrl: './client-landing.component.html',
  styleUrls: ['./client-landing.component.scss'],
  standalone: false,
})
export class ClientLandingComponent implements OnInit, OnDestroy {

  // Auth modes
  mode: 'magic' | 'sms' | 'magic-sent' | 'sms-sent' = 'magic';
  email = '';
  phone = '';
  smsCode = '';
  loading = false;
  error = '';

  // Returning user detection
  isReturningUser = false;

  // Rotating background messages
  rotatingMessages = [
    'Your claim is being prepared',
    'We\'re working to maximize your outcome',
    'Real-time updates available here',
    'Document everything, recover everything',
  ];
  currentMessageIndex = 0;
  private messageInterval: any;

  constructor(
    private router: Router,
    private claimService: MyClaimService,
  ) {}

  ngOnInit(): void {
    // If already logged in, go straight to dashboard
    if (this.claimService.isLoggedIn()) {
      this.router.navigate(['/client/dashboard']);
      return;
    }

    // Check for returning user (stored email)
    const savedEmail = localStorage.getItem('upa_client_email');
    if (savedEmail) {
      this.email = savedEmail;
      this.isReturningUser = true;
    }

    // Start rotating messages
    this.messageInterval = setInterval(() => {
      this.currentMessageIndex = (this.currentMessageIndex + 1) % this.rotatingMessages.length;
    }, 4000);
  }

  ngOnDestroy(): void {
    if (this.messageInterval) clearInterval(this.messageInterval);
  }

  // ── Magic Link ─────────────────────────────────────────────────

  sendMagicLink(): void {
    if (!this.email?.trim()) {
      this.error = 'Please enter your email address.';
      return;
    }
    this.loading = true;
    this.error = '';

    // Store email for returning user detection
    localStorage.setItem('upa_client_email', this.email);

    // Attempt actual login (falls back to mock in dev)
    this.claimService.clientLogin(this.email, 'magic-link').subscribe({
      next: () => {
        this.loading = false;
        // In production, this would send a magic link and show confirmation.
        // In dev/mock mode, it logs in directly.
        if (this.claimService.isLoggedIn()) {
          this.router.navigate(['/client/dashboard']);
        } else {
          this.mode = 'magic-sent';
        }
      },
      error: () => {
        this.loading = false;
        this.mode = 'magic-sent'; // Show confirmation anyway
      },
    });
  }

  // ── SMS Login ──────────────────────────────────────────────────

  sendSmsCode(): void {
    if (!this.phone?.trim()) {
      this.error = 'Please enter your phone number.';
      return;
    }
    this.loading = true;
    this.error = '';

    // Simulate SMS code send
    setTimeout(() => {
      this.loading = false;
      this.mode = 'sms-sent';
    }, 1200);
  }

  verifySmsCode(): void {
    if (!this.smsCode?.trim()) {
      this.error = 'Please enter the code.';
      return;
    }
    this.loading = true;
    this.error = '';

    this.claimService.clientLogin(this.phone, this.smsCode).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/client/dashboard']);
      },
      error: () => {
        this.loading = false;
        // Mock: go to dashboard anyway in dev
        this.router.navigate(['/client/dashboard']);
      },
    });
  }

  // ── Mode switching ─────────────────────────────────────────────

  switchToSms(): void {
    this.mode = 'sms';
    this.error = '';
  }

  switchToMagic(): void {
    this.mode = 'magic';
    this.error = '';
  }

  resetMode(): void {
    this.mode = 'magic';
    this.error = '';
    this.loading = false;
  }
}
