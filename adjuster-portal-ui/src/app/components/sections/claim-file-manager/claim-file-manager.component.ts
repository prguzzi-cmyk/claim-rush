import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ClaimService } from 'src/app/services/claim.service';
import { Claim } from 'src/app/models/claim.model';
import { PHASE_MILESTONES, getPhaseIndex } from 'src/app/models/claim-phases.model';
import { DialogService } from 'src/app/services/dialog.service';

interface ClaimRow {
  id: string;
  claimNumber: string;
  clientName: string;
  propertyAddress: string;
  carrier: string;
  policyNumber: string;
  claimType: string;
  adjusterName: string;
  phase: string;
  phaseIndex: number;
  createdAt: string;
}

type StageFilter = '' | 'new' | 'inspection' | 'estimate' | 'negotiation' | 'settlement' | 'closed';

@Component({
  selector: 'app-claim-file-manager',
  templateUrl: './claim-file-manager.component.html',
  styleUrls: ['./claim-file-manager.component.scss'],
  standalone: false,
})
export class ClaimFileManagerComponent implements OnInit {

  loading = true;
  claims: ClaimRow[] = [];
  stageFilter: StageFilter = '';
  searchQuery = '';
  page = 1;
  size = 25;
  total = 0;

  stages = PHASE_MILESTONES;

  stageFilters: { value: StageFilter; label: string; icon: string }[] = [
    { value: '', label: 'All Claims', icon: 'list' },
    { value: 'new', label: 'New Claims', icon: 'fiber_new' },
    { value: 'inspection', label: 'Inspection', icon: 'search' },
    { value: 'estimate', label: 'Estimate', icon: 'calculate' },
    { value: 'negotiation', label: 'Negotiation', icon: 'handshake' },
    { value: 'settlement', label: 'Settlement', icon: 'payments' },
    { value: 'closed', label: 'Closed', icon: 'lock' },
  ];

  displayedColumns = ['claim_number', 'client', 'address', 'carrier', 'adjuster', 'phase', 'created'];

  constructor(
    private claimService: ClaimService,
    private dialogService: DialogService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void { this.loadClaims(); }

  loadClaims(): void {
    this.loading = true;
    const params: any = { page: this.page, size: this.size };
    if (this.stageFilter) params.phase = this.mapStageToPhase(this.stageFilter);

    this.claimService.getClaims(this.page, this.size).subscribe({
      next: (res: any) => {
        const items = res?.items || res?.data || res || [];
        this.total = res?.total || items.length;
        this.claims = (Array.isArray(items) ? items : []).map((c: Claim) => this.mapClaim(c));
        if (this.claims.length === 0) this.claims = this.getMockClaims();
        this.applyLocalFilters();
        this.loading = false;
      },
      error: () => {
        this.claims = this.getMockClaims();
        this.loading = false;
      },
    });
  }

  private mapClaim(c: Claim): ClaimRow {
    const adj = c.assigned_user
      ? `${c.assigned_user.first_name || ''} ${c.assigned_user.last_name || ''}`.trim()
      : '';
    const addr = [c.address_loss, c.city_loss, c.state_loss].filter(Boolean).join(', ');
    return {
      id: c.id,
      claimNumber: c.claim_number || c.ref_string || '',
      clientName: c.client?.full_name || '',
      propertyAddress: addr,
      carrier: c.insurance_company || '',
      policyNumber: c.policy_number || '',
      claimType: c.peril || '',
      adjusterName: adj,
      phase: c.current_phase || '',
      phaseIndex: getPhaseIndex(c.current_phase || ''),
      createdAt: c.created_at ? new Date(c.created_at).toISOString() : '',
    };
  }

  private applyLocalFilters(): void {
    if (this.stageFilter) {
      const phaseKey = this.mapStageToPhase(this.stageFilter);
      this.claims = this.claims.filter(c => c.phase.toLowerCase().includes(phaseKey));
    }
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      this.claims = this.claims.filter(c =>
        c.claimNumber.toLowerCase().includes(q) ||
        c.clientName.toLowerCase().includes(q) ||
        c.propertyAddress.toLowerCase().includes(q) ||
        c.carrier.toLowerCase().includes(q)
      );
    }
  }

  private mapStageToPhase(stage: StageFilter): string {
    const map: Record<string, string> = {
      new: 'claim-reported', inspection: 'scope', estimate: 'estimate',
      negotiation: 'negotiation', settlement: 'payment', closed: 'closed',
    };
    return map[stage] || '';
  }

  onFilterChange(): void {
    this.page = 1;
    this.loadClaims();
  }

  onPageChange(event: any): void {
    this.page = event.pageIndex + 1;
    this.size = event.pageSize;
    this.loadClaims();
  }

  openClaim(row: ClaimRow): void {
    this.router.navigate(['/app/claim', row.id]);
  }

  createClaim(): void {
    this.dialogService.openDialog('claim');
  }

  startAIIntake(): void {
    this.router.navigate(['/app/claim-intake']);
  }

  // ── KPIs ──

  get activeClaims(): number { return this.claims.filter(c => !c.phase.includes('closed')).length; }
  get negotiationClaims(): number { return this.claims.filter(c => c.phase.includes('negotiation') || c.phase.includes('appraisal') || c.phase.includes('supplement')).length; }
  get closedClaims(): number { return this.claims.filter(c => c.phase.includes('closed') || c.phase.includes('cancelled')).length; }

  getPhaseColor(phase: string): string {
    const idx = getPhaseIndex(phase);
    const colors = ['#2196f3', '#1565c0', '#ff9800', '#4caf50', '#7b1fa2', '#e65100', '#00838f', '#9e9e9e'];
    return colors[idx >= 0 ? idx : 0] || '#9e9e9e';
  }

  getPhaseLabel(phase: string): string {
    const milestone = PHASE_MILESTONES.find(m => m.slugs.includes(phase.toLowerCase().replace(/\s+/g, '-')));
    return milestone?.label || phase || 'Unknown';
  }

  // ── Mock ──

  private getMockClaims(): ClaimRow[] {
    const phases = ['claim-reported', 'scope', 'estimate-complete', 'insurance-company-inspection', 'waiting-for-initial-payment', 'initial-payment-received', 'claim-closed'];
    const adj = ['Marcus Rivera', 'Angela Watts', 'Tyler Jackson'];
    const carriers = ['State Farm', 'Allstate', 'USAA', 'Progressive', 'Farmers', 'Liberty Mutual'];
    const names = ['Robert Chen', 'Maria Gonzalez', 'James Parker', 'Patricia Williams', 'David Thompson',
      'Jennifer Adams', 'Michael Foster', 'Sarah Mitchell', 'William Brown', 'Amanda Rodriguez'];
    const addresses = ['4521 Maple Dr, Plano, TX', '892 Elm St, Fort Worth, TX', '2100 Oak Ridge Blvd, Arlington, TX',
      '567 Pine Ave, Dallas, TX', '1890 Cedar Ln, Irving, TX', '3200 Birch Ct, Garland, TX',
      '445 Walnut Rd, McKinney, TX', '780 Ash Dr, Frisco, TX', '1320 Spruce Way, Allen, TX', '956 Hickory Ln, Denton, TX'];
    return names.map((name, i) => ({
      id: `mock-${i}`, claimNumber: `CLM-2025-${(100 + i)}`, clientName: name,
      propertyAddress: addresses[i], carrier: carriers[i % carriers.length], policyNumber: `POL-${1000 + i}`,
      claimType: i % 3 === 0 ? 'Hail' : i % 3 === 1 ? 'Wind' : 'Fire',
      adjusterName: adj[i % adj.length], phase: phases[i % phases.length],
      phaseIndex: getPhaseIndex(phases[i % phases.length]),
      createdAt: new Date(Date.now() - i * 86400000 * 3).toISOString(),
    }));
  }
}
