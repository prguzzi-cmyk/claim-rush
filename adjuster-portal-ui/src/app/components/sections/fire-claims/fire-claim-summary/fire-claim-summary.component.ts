import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgxSpinnerService } from 'ngx-spinner';
import { switchMap } from 'rxjs/operators';
import {
  FireClaim,
  FireClaimMedia,
  CLAIM_INTELLIGENCE_NAME,
  ORIGIN_AREAS,
  SMOKE_LEVELS,
} from '../../../../models/fire-claim.model';
import { FireClaimService } from '../../../../services/fire-claim.service';
import { PolicyDocumentService } from '../../../../services/policy-document.service';
import { PolicyDocument, PolicyClause, PolicyIntelligence } from '../../../../models/policy-document.model';

@Component({
  standalone: false,
  selector: 'app-fire-claim-summary',
  templateUrl: './fire-claim-summary.component.html',
  styleUrls: ['./fire-claim-summary.component.scss'],
})
export class FireClaimSummaryComponent implements OnInit {
  claim: FireClaim | null = null;
  claimId!: string;
  analyzing = false;
  generatingCarrier = false;
  openingEstimate = false;
  brandName = CLAIM_INTELLIGENCE_NAME;

  policyDoc: PolicyDocument | null = null;
  policyLoading = false;
  policyAnalyzing = false;
  policyError: string | null = null;
  policyNotesExpanded = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fireClaimService: FireClaimService,
    private policyDocService: PolicyDocumentService,
    private snackBar: MatSnackBar,
    private spinner: NgxSpinnerService
  ) {}

  ngOnInit(): void {
    this.claimId = this.route.snapshot.paramMap.get('id')!;
    this.loadClaim();
  }

  loadClaim(): void {
    this.spinner.show();
    this.fireClaimService.get(this.claimId).subscribe({
      next: (claim) => {
        this.claim = claim;
        this.spinner.hide();
        this.loadPolicy();
      },
      error: () => {
        this.spinner.hide();
        this.snackBar.open('Failed to load fire claim', 'Close', {
          duration: 3000,
        });
        this.router.navigate(['/app/fire-claims']);
      },
    });
  }

  loadPolicy(): void {
    this.policyLoading = true;
    this.policyError = null;
    this.policyDocService.getByEntity({ fire_claim_id: this.claimId }).subscribe({
      next: (docs) => {
        this.policyDoc = docs.length > 0 ? docs[0] : null;
        this.policyLoading = false;
      },
      error: () => {
        this.policyLoading = false;
        this.policyDoc = null;
      },
    });
  }

  analyzePolicy(): void {
    if (!this.policyDoc) return;
    const docId = this.policyDoc.id;
    this.policyAnalyzing = true;
    this.policyError = null;

    this.policyDocService.extractClauses(docId).pipe(
      switchMap(() => this.policyDocService.summarize(docId)),
      switchMap(() => this.policyDocService.get(docId))
    ).subscribe({
      next: (doc) => {
        this.policyDoc = doc;
        this.policyAnalyzing = false;
        this.snackBar.open('Policy analysis complete', 'Close', { duration: 3000 });
      },
      error: (err) => {
        console.error('Policy analysis failed:', err);
        this.policyAnalyzing = false;
        this.policyError = 'Policy analysis failed. Please try again.';
        this.snackBar.open('Policy analysis failed', 'Close', { duration: 5000 });
      },
    });
  }

  get intel(): PolicyIntelligence | null {
    return this.policyDoc?.intelligence ?? null;
  }

  get policyClauses(): PolicyClause[] {
    return this.policyDoc?.clauses ?? [];
  }

  get analysisStatus(): 'not_analyzed' | 'analyzing' | 'complete' | 'failed' {
    if (this.policyAnalyzing) return 'analyzing';
    if (!this.policyDoc) return 'not_analyzed';
    const status = this.policyDoc.extraction_status;
    if ((status === 'complete' || status === 'completed' || status === 'clauses_extracted') && (this.policyClauses.length > 0 || this.intel)) return 'complete';
    if (this.policyDoc.extraction_status === 'failed') return 'failed';
    return 'not_analyzed';
  }

  getClausesByType(type: string): PolicyClause[] {
    return this.policyClauses.filter((c) => c.clause_type === type);
  }

  togglePolicyNotes(): void {
    this.policyNotesExpanded = !this.policyNotesExpanded;
  }

  formatCurrency(val?: number): string {
    if (val === undefined || val === null) return '—';
    return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  markComplete(): void {
    this.spinner.show();
    this.fireClaimService.markComplete(this.claimId).subscribe({
      next: (claim) => {
        this.claim = claim;
        this.spinner.hide();
        this.snackBar.open('Intake marked complete', 'Close', {
          duration: 3000,
        });
      },
      error: () => {
        this.spinner.hide();
        this.snackBar.open('Failed to mark complete', 'Close', {
          duration: 3000,
        });
      },
    });
  }

  deleteMedia(media: FireClaimMedia): void {
    if (!confirm('Delete this media file?')) return;

    this.fireClaimService.deleteMedia(this.claimId, media.id!).subscribe({
      next: () => {
        this.loadClaim();
        this.snackBar.open('Media deleted', 'Close', { duration: 2000 });
      },
      error: () => {
        this.snackBar.open('Failed to delete media', 'Close', {
          duration: 3000,
        });
      },
    });
  }

  getOriginAreaLabel(value: string): string {
    return ORIGIN_AREAS.find((a) => a.value === value)?.label || value;
  }

  getSmokeLevelLabel(value: string): string {
    return SMOKE_LEVELS.find((l) => l.value === value)?.label || value;
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'new':
        return 'New';
      case 'intake_complete':
        return 'Intake Complete';
      default:
        return status;
    }
  }

  getPhotos(): FireClaimMedia[] {
    return this.claim?.media?.filter((m) => m.media_type === 'photo') || [];
  }

  getVideos(): FireClaimMedia[] {
    return this.claim?.media?.filter((m) => m.media_type === 'video') || [];
  }

  boolLabel(val: boolean | undefined): string {
    return val ? 'Yes' : 'No';
  }

  analyzeDamage(): void {
    this.analyzing = true;
    this.fireClaimService.analyzeDamage(this.claimId).subscribe({
      next: (claim) => {
        this.claim = claim;
        this.analyzing = false;
        this.snackBar.open('AI analysis complete', 'Close', { duration: 3000 });
      },
      error: (err) => {
        console.error('AI analysis failed:', err);
        this.analyzing = false;
        this.snackBar.open(
          'AI analysis is unavailable right now. Please try again later.',
          'Close',
          { duration: 5000 }
        );
      },
    });
  }

  generateCarrierReport(): void {
    this.generatingCarrier = true;
    this.fireClaimService.generateCarrierReport(this.claimId).subscribe({
      next: (claim) => {
        this.claim = claim;
        this.generatingCarrier = false;
        this.snackBar.open('Carrier report generated', 'Close', { duration: 3000 });
      },
      error: (err) => {
        console.error('Carrier report generation failed:', err);
        this.generatingCarrier = false;
        this.snackBar.open(
          'Failed to generate carrier report. Please try again.',
          'Close',
          { duration: 5000 }
        );
      },
    });
  }

  openEstimate(): void {
    this.openingEstimate = true;
    this.fireClaimService.getOrCreateEstimate(this.claimId).subscribe({
      next: (project) => {
        this.openingEstimate = false;
        this.router.navigate(['/app/estimating', project.id]);
      },
      error: () => {
        this.openingEstimate = false;
        this.snackBar.open('Failed to open estimate', 'Close', {
          duration: 3000,
        });
      },
    });
  }

  printCarrierReport(): void {
    const content = this.claim?.carrier_report;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>Property Damage Assessment</title>
<style>
  body { font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.6;
         margin: 40px; color: #000; }
  pre  { white-space: pre-wrap; word-wrap: break-word; margin: 0; }
  @media print { body { margin: 20px; } }
</style></head><body><pre>${content}</pre></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }
}
