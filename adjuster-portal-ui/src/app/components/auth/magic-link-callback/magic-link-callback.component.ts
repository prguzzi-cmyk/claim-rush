import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { UserService } from 'src/app/services/user.service';
import { TabService } from 'src/app/services/tab.service';

@Component({
  selector: 'app-magic-link-callback',
  templateUrl: './magic-link-callback.component.html',
  styleUrls: ['./magic-link-callback.component.scss'],
  standalone: false,
})
export class MagicLinkCallbackComponent implements OnInit {
  state: 'verifying' | 'success' | 'error' = 'verifying';
  errorMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private userService: UserService,
    private tabService: TabService,
  ) {}

  ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state = 'error';
      this.errorMessage = 'No token provided.';
      return;
    }

    this.authService.verifyMagicLink(token).subscribe({
      next: () => {
        this.state = 'success';
        // Redirect after short delay
        setTimeout(() => {
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
              } else {
                this.router.navigate(['/app/agent-dashboard']);
              }
            }
          });
        }, 1500);
      },
      error: (err: any) => {
        this.state = 'error';
        this.errorMessage = err?.error?.detail || 'Invalid or expired sign-in link.';
      },
    });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
