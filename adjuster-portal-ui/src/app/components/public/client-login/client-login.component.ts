import { Component } from '@angular/core';

@Component({
  selector: 'app-client-login',
  templateUrl: './client-login.component.html',
  styleUrls: ['./client-login.component.scss'],
  standalone: false,
})
export class ClientLoginComponent {
  email = '';
  credential = '';
  notice = '';

  submit(): void {
    // Placeholder. Wired separately from RIN auth — the homeowner-facing
    // claim status portal is in development. Submitting only surfaces a
    // friendly notice so a homeowner who lands here knows what to expect.
    if (!this.email || !this.credential) {
      this.notice = 'Please enter your email and your claim ID or password.';
      return;
    }
    this.notice = 'Thanks — your local Community Partner will follow up by phone or email. A self-serve claim status portal is coming soon.';
  }
}
