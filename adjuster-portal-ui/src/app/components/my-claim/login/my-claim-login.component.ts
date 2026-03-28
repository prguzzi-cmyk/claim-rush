import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MyClaimService } from '../my-claim.service';

@Component({
  selector: 'app-my-claim-login',
  templateUrl: './my-claim-login.component.html',
  styleUrls: ['./my-claim-login.component.scss'],
  standalone: false,
})
export class MyClaimLoginComponent implements OnInit {
  email = '';
  password = '';
  claimNumber = '';
  lastName = '';
  loading = false;
  error = '';
  mode: 'main' | 'password' | 'magic' | 'magic-sent' | 'lookup' = 'main';

  constructor(
    private claimService: MyClaimService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const qMode = this.route.snapshot.queryParamMap.get('mode');
    if (qMode === 'lookup') this.mode = 'lookup';
  }

  loginWithPassword(): void {
    if (!this.email || !this.password) { this.error = 'Please enter your email and password.'; return; }
    this.loading = true;
    this.error = '';
    this.claimService.clientLogin(this.email, this.password).subscribe({
      next: () => this.router.navigate(['/client/dashboard']),
      error: () => { this.error = 'Invalid email or password.'; this.loading = false; },
    });
  }

  lookupClaim(): void {
    if (!this.claimNumber || !this.lastName) { this.error = 'Please enter your claim number and last name.'; return; }
    this.loading = true;
    this.error = '';
    this.claimService.clientLogin(this.claimNumber + '@lookup', this.lastName).subscribe({
      next: () => this.router.navigate(['/client/dashboard']),
      error: () => { this.error = 'No claim found. Please check your details.'; this.loading = false; },
    });
  }

  requestMagicLink(): void {
    if (!this.email) { this.error = 'Please enter your email.'; return; }
    this.mode = 'magic-sent';
  }

  switchMode(mode: 'main' | 'password' | 'magic' | 'lookup'): void {
    this.mode = mode;
    this.error = '';
  }

  goToLanding(): void {
    this.router.navigate(['/client']);
  }
}
