import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ClaimIntakeBotService } from 'src/app/shared/services/claim-intake-bot.service';
import { ClaimService } from 'src/app/services/claim.service';
import { Claim } from 'src/app/models/claim.model';
import {
  IntakeSession, IntakeData, IntakeStepKey, INTAKE_STEPS,
  createEmptyIntakeData, intakeToClaimPayload, INTAKE_STATUS_META,
} from 'src/app/shared/models/intake-session.model';

@Component({
  selector: 'app-claim-intake',
  templateUrl: './claim-intake.component.html',
  styleUrls: ['./claim-intake.component.scss'],
  standalone: false,
})
export class ClaimIntakeComponent implements OnInit {

  started = false;
  session: IntakeSession | null = null;
  data: IntakeData = createEmptyIntakeData();
  steps = INTAKE_STEPS;
  currentStepIndex = 0;
  summary: string | null = null;
  summaryGenerating = false;

  // Generated outputs
  inspectionChecklist: string[] = [];
  damageScope: string | null = null;

  submitting = false;

  constructor(
    private intakeBot: ClaimIntakeBotService,
    private claimService: ClaimService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {}

  // ── Start ──

  startIntake(): void {
    this.started = true;
    this.data = createEmptyIntakeData();
    this.currentStepIndex = 0;
    this.summary = null;
    this.inspectionChecklist = [];
    this.damageScope = null;

    this.intakeBot.createSession('manual_adjuster').subscribe(s => {
      this.session = s;
    });
  }

  // ── Navigation ──

  get currentStep(): IntakeStepKey {
    return this.steps[this.currentStepIndex]?.key || 'contact_info';
  }

  get completionPercent(): number {
    return this.intakeBot.computeCompletionPercent(this.data);
  }

  get completedSteps(): Set<string> {
    return new Set(this.intakeBot.computeCompletedSteps(this.data));
  }

  goToStep(index: number): void {
    this.currentStepIndex = index;
  }

  nextStep(): void {
    if (this.currentStepIndex < this.steps.length - 1) {
      this.currentStepIndex++;
      if (this.currentStep === 'review_summary') {
        this.generateOutputs();
      }
    }
  }

  prevStep(): void {
    if (this.currentStepIndex > 0) this.currentStepIndex--;
  }

  get isLastStep(): boolean {
    return this.currentStepIndex === this.steps.length - 1;
  }

  // ── Generate Outputs ──

  generateOutputs(): void {
    this.summaryGenerating = true;
    this.summary = this.intakeBot.buildSummaryFromData(this.data, this.session || this.buildLocalSession());
    this.inspectionChecklist = this.buildChecklist();
    this.damageScope = this.buildDamageScope();
    this.summaryGenerating = false;
  }

  regenerateSummary(): void {
    this.generateOutputs();
    this.snackBar.open('Summary regenerated.', 'Close', { duration: 3000 });
  }

  private buildChecklist(): string[] {
    const items: string[] = [
      'Photograph all four sides of the property exterior',
      'Document roof damage from ground level and close-up',
    ];
    const dt = (this.data.damageType || '').toLowerCase();
    const et = (this.data.eventType || '').toLowerCase();

    if (dt.includes('roof') || et.includes('hail') || et.includes('wind')) {
      items.push('Inspect roof surface for hail impacts or lifted shingles');
      items.push('Check gutters, downspouts, and vents for dents');
      items.push('Document any satellite dish, skylight, or AC unit damage');
    }
    if (dt.includes('water') || et.includes('flood')) {
      items.push('Measure water line height on walls');
      items.push('Check for mold growth behind baseboards');
      items.push('Document flooring damage with moisture readings');
    }
    if (dt.includes('fire') || et.includes('fire')) {
      items.push('Document char patterns and smoke damage');
      items.push('Check electrical panel and HVAC system');
      items.push('Photograph contents damage in each room');
    }
    items.push('Collect policy declaration page');
    items.push('Record measurements of all affected areas');
    items.push('Note any temporary repairs already performed');
    if (this.data.inspectionStatus === 'scheduled') {
      items.push('Confirm inspection appointment with homeowner');
    } else if (this.data.inspectionStatus === 'pending') {
      items.push('Follow up with homeowner to schedule inspection');
    }
    return items;
  }

  private buildDamageScope(): string {
    const lines: string[] = [];
    lines.push('INITIAL DAMAGE SCOPE');
    lines.push('═'.repeat(40));
    if (this.data.damageType) lines.push(`Damage Type: ${this.data.damageType}`);
    if (this.data.eventType) lines.push(`Cause of Loss: ${this.data.eventType}`);
    if (this.data.lossDate) lines.push(`Date of Loss: ${this.data.lossDate}${this.data.lossDateApproximate ? ' (approximate)' : ''}`);
    if (this.data.propertyAddress) lines.push(`Property: ${this.data.propertyAddress}, ${this.data.propertyCity || ''}, ${this.data.propertyState || ''} ${this.data.propertyZip || ''}`);
    lines.push('');
    lines.push('Estimated Affected Areas:');
    const dt = (this.data.damageType || '').toLowerCase();
    if (dt.includes('roof')) lines.push('  - Roof system (shingles, underlayment, flashing)');
    if (dt.includes('water')) lines.push('  - Interior water damage (walls, floors, ceilings)');
    if (dt.includes('fire')) lines.push('  - Fire/smoke damage (structure and contents)');
    if (dt.includes('wind')) lines.push('  - Wind damage (roof, siding, fencing)');
    if (!dt) lines.push('  - To be determined during field inspection');
    lines.push('');
    lines.push('Note: Full scope to be confirmed during on-site inspection.');
    if (this.data.damageDescription) {
      lines.push('');
      lines.push('Homeowner Description:');
      lines.push(this.data.damageDescription);
    }
    return lines.join('\n');
  }

  // ── Inspection ──

  scheduleInspection(): void {
    this.data.inspectionRequested = true;
    this.data.inspectionStatus = 'scheduled';
    this.snackBar.open('Inspection will be scheduled. Your adjuster will confirm a time.', 'OK', { duration: 4000 });
  }

  scheduleLater(): void {
    this.data.inspectionRequested = true;
    this.data.inspectionStatus = 'pending';
    this.snackBar.open('Inspection marked as pending. Your adjuster will follow up.', 'OK', { duration: 4000 });
  }

  // ── Submit ──

  submitIntake(): void {
    this.submitting = true;
    const payload = intakeToClaimPayload(this.data) as Claim;

    this.claimService.addClaim(payload).subscribe({
      next: (created: any) => {
        this.submitting = false;
        const claimId = created?.id || created?.data?.id;
        this.snackBar.open('Claim created successfully!', 'Close', { duration: 3000 });
        if (claimId) {
          this.router.navigate(['/app/claim', claimId]);
        } else {
          this.started = false;
        }
      },
      error: () => {
        this.submitting = false;
        this.snackBar.open('Intake saved — claim will be created on review.', 'Close', { duration: 3000 });
        this.started = false;
      },
    });
  }

  copySummary(): void {
    const text = [this.summary, '', this.damageScope, '', 'INSPECTION CHECKLIST', ...this.inspectionChecklist.map(i => `☐ ${i}`)].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.snackBar.open('Copied to clipboard.', 'Close', { duration: 3000 });
    });
  }

  // ── Helpers ──

  private buildLocalSession(): IntakeSession {
    const now = new Date().toISOString();
    return {
      id: 'local', status: 'in_progress', entryPath: 'manual_adjuster', intakeData: this.data,
      leadId: null, claimId: null, clientId: null, voiceCallId: null,
      completedSteps: [], currentStep: this.currentStep, completionPercent: this.completionPercent,
      aiSummary: null, aiSummaryGeneratedAt: null,
      hasPolicy: false, hasPhotos: false, hasSupportingDocs: false, missingItems: [],
      createdAt: now, updatedAt: now, createdBy: null, convertedAt: null,
    };
  }
}
