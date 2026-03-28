import { Component, OnInit } from '@angular/core';
import { ClaimService } from 'src/app/services/claim.service';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
    selector: 'app-sales-dashboard',
    templateUrl: './sales-dashboard.component.html',
    styleUrls: ['./sales-dashboard.component.scss'],
    standalone: false
})
export class SalesDashboardComponent implements OnInit {
  userName: string = '';
  totalClaims: number = 0;
  activeClaims: number = 0;
  claimsByPhase: any[] = [];
  recentClaims: any[] = [];

  constructor(
    private claimService: ClaimService,
    private spinner: NgxSpinnerService,
  ) {}

  ngOnInit(): void {
    this.userName = localStorage.getItem('user-name');
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.spinner.show();
    this.claimService.getClaims(1, 100).subscribe(
      (claims) => {
        this.spinner.hide();
        if (claims?.items) {
          this.totalClaims = claims.total;
          this.recentClaims = claims.items.slice(0, 5);

          // Count active claims (not closed or cancelled)
          this.activeClaims = claims.items.filter(
            (c: any) => c.current_phase !== 'claim-closed' && c.current_phase !== 'client-cancelled'
          ).length;

          // Group by phase
          const phaseMap = new Map<string, number>();
          claims.items.forEach((c: any) => {
            const phase = c.current_phase || 'unknown';
            phaseMap.set(phase, (phaseMap.get(phase) || 0) + 1);
          });
          this.claimsByPhase = Array.from(phaseMap, ([phase, count]) => ({ phase, count }));
        }
      },
      () => {
        this.spinner.hide();
      }
    );
  }
}
