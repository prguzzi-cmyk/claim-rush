import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ClaimService } from 'src/app/services/claim.service';
import { UserService } from 'src/app/services/user.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { Claim } from 'src/app/models/claim.model';
import { PHASE_MILESTONES, getPhaseIndex } from 'src/app/models/claim-phases.model';

@Component({
    selector: 'app-customer-dashboard',
    templateUrl: './customer-dashboard.component.html',
    styleUrls: ['./customer-dashboard.component.scss'],
    standalone: false
})
export class CustomerDashboardComponent implements OnInit {
    userName: string = '';
    claims: Claim[] = [];
    loading = true;
    totalPhases = PHASE_MILESTONES.length;

    constructor(
        private claimService: ClaimService,
        private userService: UserService,
        private router: Router,
        private spinner: NgxSpinnerService
    ) {}

    ngOnInit(): void {
        this.userName = localStorage.getItem('user-name') || '';
        this.loadClaims();
    }

    loadClaims(): void {
        this.spinner.show();
        const clientId = localStorage.getItem('client_id');

        if (clientId) {
            this.claimService.getClaimsByClientId(clientId, 1, 100).subscribe(
                (response) => {
                    this.spinner.hide();
                    this.loading = false;
                    if (response?.items) {
                        this.claims = response.items;
                        if (this.claims.length === 1) {
                            this.router.navigate(['/app/customer-claim', this.claims[0].id]);
                        }
                    }
                },
                (error) => {
                    this.spinner.hide();
                    this.loading = false;
                    console.error('Error loading claims:', error);
                }
            );
        } else {
            // Fallback: get user info first
            this.userService.getUser().subscribe(
                (user) => {
                    if (user?.id) {
                        this.claimService.getClaimsByClientId(user.id, 1, 100).subscribe(
                            (response) => {
                                this.spinner.hide();
                                this.loading = false;
                                if (response?.items) {
                                    this.claims = response.items;
                                    if (this.claims.length === 1) {
                                        this.router.navigate(['/app/customer-claim', this.claims[0].id]);
                                    }
                                }
                            },
                            (error) => {
                                this.spinner.hide();
                                this.loading = false;
                            }
                        );
                    } else {
                        this.spinner.hide();
                        this.loading = false;
                    }
                },
                (error) => {
                    this.spinner.hide();
                    this.loading = false;
                }
            );
        }
    }

    getPhaseProgress(claim: Claim): number {
        const idx = getPhaseIndex(claim.current_phase);
        if (idx < 0) return 0;
        return Math.round(((idx + 1) / this.totalPhases) * 100);
    }

    getPhaseLabel(claim: Claim): string {
        const idx = getPhaseIndex(claim.current_phase);
        if (idx < 0) return claim.current_phase || 'Unknown';
        return PHASE_MILESTONES[idx].clientLabel;
    }

    getPhaseColor(claim: Claim): string {
        const progress = this.getPhaseProgress(claim);
        if (progress >= 100) return '#4caf50';
        if (progress >= 60) return '#2196f3';
        if (progress >= 30) return '#ff9800';
        return '#9e9e9e';
    }

    viewClaim(claim: Claim): void {
        this.router.navigate(['/app/customer-claim', claim.id]);
    }

    formatAddress(claim: Claim): string {
        const c = claim.claim_contact;
        if (!c) return '-';
        const parts = [c.address_loss, c.city_loss, c.state_loss, c.zip_code_loss].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : '-';
    }
}
