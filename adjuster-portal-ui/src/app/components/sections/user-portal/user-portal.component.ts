import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LaunchControlService } from '../../../services/launch-control.service';
import { LaunchControlUserDetail } from '../../../models/launch-control.model';

@Component({
  selector: 'app-user-portal',
  templateUrl: './user-portal.component.html',
  styleUrls: ['./user-portal.component.scss'],
  standalone: false,
})
export class UserPortalComponent implements OnInit {
  user: LaunchControlUserDetail | null = null;
  loading = true;
  errorMessage: string | null = null;
  // Diagnostic state surfaced in the template footer so the page never
  // renders completely blank, even if every loading/error/user check
  // somehow resolves falsy.
  routeUserId: string | null = null;
  rawResponseJson: string | null = null;
  rawErrorJson: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private svc: LaunchControlService,
  ) {}

  ngOnInit(): void {
    console.log('[UserPortal] LOAD START');
    const userId = this.route.snapshot.paramMap.get('user_id');
    this.routeUserId = userId;
    console.log('[UserPortal] route user_id =', userId);
    if (!userId) {
      this.loading = false;
      this.errorMessage = 'No user_id in route.';
      console.error('[UserPortal] no user_id in route — aborting fetch');
      return;
    }
    try {
      this.svc.get(userId).subscribe({
        next: (detail) => {
          console.log('[UserPortal] response received', detail);
          try {
            this.rawResponseJson = JSON.stringify(detail, null, 2);
          } catch {
            this.rawResponseJson = '<unserializable response>';
          }
          this.user = detail;
          this.loading = false;
          if (!detail) {
            // 200 with empty body — surface so the page isn't blank.
            this.errorMessage = 'Backend returned an empty response.';
            console.warn('[UserPortal] empty response body');
          }
        },
        error: (err) => {
          this.loading = false;
          console.error('[UserPortal] request failed', err);
          try {
            this.rawErrorJson = JSON.stringify(
              {
                status: err?.status,
                statusText: err?.statusText,
                message: err?.message,
                error: err?.error,
                url: err?.url,
              },
              null,
              2,
            );
          } catch {
            this.rawErrorJson = String(err);
          }
          this.errorMessage =
            err?.error?.detail ||
            err?.message ||
            'Failed to load portal data.';
        },
      });
    } catch (sync) {
      console.error('[UserPortal] synchronous error during fetch wiring', sync);
      this.loading = false;
      this.errorMessage = 'Could not start portal fetch (see console).';
    }
  }

  back(): void {
    this.router.navigate(['/app/administration/launch-control']);
  }

  copyIntake(): void {
    if (!this.user?.client_intake_url) return;
    navigator.clipboard?.writeText(this.user.client_intake_url);
  }

  formatRoleHeader(): string {
    if (!this.user) return '';
    const role = (this.user.role || '').toLowerCase();
    if (role === 'cp') return 'Community Partner';
    if (role === 'rvp') return 'Regional VP';
    if (role === 'agent') return 'Agent';
    return this.user.role_display || this.user.role || '';
  }

  territorySummary(): string {
    if (!this.user) return '—';
    if (!this.user.territories.length) return '—';
    return this.user.territories
      .map((t) => {
        if (t.state && t.county) return `${t.state} · ${t.county}`;
        return t.state || t.name;
      })
      .join(', ');
  }
}
