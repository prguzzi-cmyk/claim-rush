import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatStepper } from '@angular/material/stepper';
import { StepperSelectionEvent } from '@angular/cdk/stepper';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgxSpinnerService } from 'ngx-spinner';
import {
  AdjusterCase,
  AdjusterCaseDocument,
  AdjusterCasePolicyAnalysis,
} from '../../../../models/adjuster-case.model';
import { AdjusterCaseService } from '../../../../services/adjuster-case.service';
import { PolicyDocumentService } from '../../../../services/policy-document.service';
import {
  AssistantActionResponse,
  PolicyClause,
  PolicyDocument,
  PolicyIntelligence,
} from '../../../../models/policy-document.model';
import { EstimatingService } from '../../../../services/estimating.service';
import { EstimateProject } from '../../../../models/estimating.model';
import { GapAnalysisService } from '../../../../services/gap-analysis.service';
import { NegotiationService } from '../../../../services/negotiation.service';
import {
  GapAnalysisReport, CarrierEstimateData, NormalizedLineItem, GapFinding,
  NegotiationStrategy, SettlementScenario, GeneratedDocument, NegotiationRound, DocumentType,
} from '../../../../models/gap-analysis.model';
import { DownloaderService } from '../../../../services/downloader.service';

@Component({
  standalone: false,
  selector: 'app-adjuster-case-detail',
  templateUrl: './adjuster-case-detail.component.html',
  styleUrls: ['./adjuster-case-detail.component.scss'],
})
export class AdjusterCaseDetailComponent implements OnInit {
  @ViewChild('stepper') stepper!: MatStepper;

  caseId: string | null = null;
  isNew = false;
  adjCase: AdjusterCase | null = null;
  loading = false;
  saving = false;

  // Intake form fields (ngModel bound)
  intakeLossDate: string = '';
  intakeLossType: string = '';
  intakeAddress: string = '';
  intakeInsuredName: string = '';
  intakeCarrier: string = '';
  intakePolicyNumber: string = '';
  intakeClaimNumber: string = '';
  intakeNotes: string = '';

  // Policy analysis (legacy)
  policyAnalyses: AdjusterCasePolicyAnalysis[] = [];
  analyzingPolicy = false;

  // Policy Vault integration
  vaultPolicy: PolicyDocument | null = null;
  vaultPolicies: PolicyDocument[] = [];
  uploadingToVault = false;
  vaultAnalyzing = false;
  vaultAnalysisStep = '';
  vaultAnalysisProgress = 0;

  // Quick AI tools
  assistantActions = [
    { type: 'coverage_issues', label: 'Coverage Issues', icon: 'warning' },
    { type: 'flag_exclusions', label: 'Flag Exclusions', icon: 'block' },
    { type: 'matching_language', label: 'Matching Language', icon: 'compare' },
    { type: 'deductible_analysis', label: 'Deductible Analysis', icon: 'calculate' },
    { type: 'replacement_cost', label: 'Replacement Cost', icon: 'home_repair_service' },
    { type: 'supplement_support', label: 'Supplement Support', icon: 'add_circle' },
  ];
  actionLoading: Record<string, boolean> = {};
  actionResult: AssistantActionResponse | null = null;

  // Damage
  damageNotes: string = '';
  analyzingDamage = false;

  // Scope
  scopeNotes: string = '';
  scopeAiSummary: string = '';
  generatingScope = false;
  scopeSections: { room: string; items: string[] }[] = [];
  showScopeEditor = false;

  // Estimate
  linkingEstimate = false;

  // PA Review
  paApproved = false;
  paNotes: string = '';
  approvingPa = false;

  // Report
  generatingReport = false;

  // Gap Analysis (Step 5)
  paEstimate: EstimateProject | null = null;
  carrierRawText: string = '';
  carrierData: CarrierEstimateData | null = null;
  gapReport: GapAnalysisReport | null = null;
  runningGapAnalysis = false;
  gapFilterCategory: string = 'all';
  supplementLetter: string = '';
  generatingSupplement = false;

  // Negotiation Command Center
  showCommandCenter = false;
  negotiationStrategy: NegotiationStrategy | null = null;
  generatingStrategy = false;
  settlementPercentage: number = 50;
  settlementScenario: SettlementScenario | null = null;
  generatedDocuments: GeneratedDocument[] = [];
  generatingDocType: string | null = null;
  negotiationRounds: NegotiationRound[] = [];
  newRoundDate: string = '';
  newRoundCarrierOffer: number = 0;
  newRoundPaCounter: number = 0;
  newRoundNotes: string = '';

  // Documents
  documents: AdjusterCaseDocument[] = [];

  // Step navigation guards
  readonly MAX_STEP = 7;
  advancing = false;
  stepGuardMessage: string = '';

  lossTypes = ['Fire', 'Water', 'Wind', 'Hail', 'Theft', 'Vandalism', 'Other'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private caseService: AdjusterCaseService,
    private policyService: PolicyDocumentService,
    private estimatingService: EstimatingService,
    private gapService: GapAnalysisService,
    private negotiationService: NegotiationService,
    private downloader: DownloaderService,
    private snackBar: MatSnackBar,
    private spinner: NgxSpinnerService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.caseId = id;
      this.isNew = false;
      this.loadCase();
    } else {
      this.isNew = true;
    }
  }

  loadCase(): void {
    if (!this.caseId) return;
    this.loading = true;
    this.spinner.show();
    this.caseService.get(this.caseId).subscribe({
      next: (c) => {
        this.adjCase = c;
        this.populateFromCase(c);
        this.loading = false;
        this.spinner.hide();
        // Load vault policies for this case
        this.loadVaultPolicies();
        // Load PA estimate if linked
        this.loadPaEstimate();
        // Navigate stepper to current step
        setTimeout(() => {
          if (this.stepper && c.current_step > 0) {
            this.stepper.selectedIndex = c.current_step;
          }
        });
      },
      error: () => {
        this.loading = false;
        this.spinner.hide();
        this.snackBar.open('Failed to load case', 'Close', { duration: 3000 });
      },
    });
  }

  private populateFromCase(c: AdjusterCase): void {
    if (!c) {
      console.warn('[StepGuard] populateFromCase called with null case');
      return;
    }
    this.intakeLossDate = c.intake_loss_date || '';
    this.intakeLossType = c.intake_loss_type || '';
    this.intakeAddress = c.intake_address || '';
    this.intakeInsuredName = c.intake_insured_name || '';
    this.intakeCarrier = c.intake_carrier || '';
    this.intakePolicyNumber = c.intake_policy_number || '';
    this.intakeClaimNumber = c.intake_claim_number || '';
    this.intakeNotes = c.intake_notes || '';
    this.policyAnalyses = c.policy_analyses || [];
    this.damageNotes = c.damage_ai_summary || '';
    this.scopeNotes = c.scope_notes || '';
    this.scopeAiSummary = c.scope_ai_summary || '';
    this.parseScopeByRoom();
    this.paApproved = !!c.pa_approved;
    this.paNotes = c.pa_notes || '';
    this.documents = c.documents || [];
  }

  // ── Policy Vault Integration ──

  loadVaultPolicies(): void {
    if (!this.caseId) {
      console.warn('[StepGuard] loadVaultPolicies skipped — caseId is null');
      return;
    }
    this.policyService.getByEntity({ adjuster_case_id: this.caseId }).subscribe({
      next: (policies) => {
        this.vaultPolicies = policies || [];
        // Pick the first analyzed policy as the primary one
        const analyzed = this.vaultPolicies.find(p => p.intelligence);
        if (analyzed) {
          this.vaultPolicy = analyzed;
        } else if (this.vaultPolicies.length > 0) {
          this.vaultPolicy = this.vaultPolicies[0];
        }
        // Auto-attach: if no policies linked but we have intake info, look for a match
        if (this.vaultPolicies.length === 0 && (this.intakePolicyNumber || this.intakeInsuredName)) {
          this.autoAttachExistingPolicy();
        }
      },
      error: (err) => {
        console.warn('[StepGuard] loadVaultPolicies failed:', err?.status, err?.message);
        // Non-blocking: vault policies are optional, step continues without them
      },
    });
  }

  private autoAttachExistingPolicy(): void {
    if (!this.caseId) return;
    const filters: any = {};
    if (this.intakePolicyNumber) filters.policy_number = this.intakePolicyNumber;
    if (this.intakeInsuredName) filters.insured_name = this.intakeInsuredName;
    this.policyService.list(1, 5, filters).subscribe({
      next: (res: any) => {
        const items = res?.items || res?.results || res || [];
        if (items.length > 0) {
          const match = items[0];
          this.policyService.attach(match.id, { adjuster_case_id: this.caseId! }).subscribe({
            next: (doc) => {
              this.vaultPolicy = doc;
              this.vaultPolicies = [doc];
              this.snackBar.open('Existing policy auto-attached from vault', 'Close', { duration: 3000 });
            },
            error: (err) => {
              console.warn('[StepGuard] autoAttach policy attach failed:', err?.status);
            },
          });
        }
      },
      error: (err) => {
        console.warn('[StepGuard] autoAttach policy list failed:', err?.status);
      },
    });
  }

  uploadPolicyToVault(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || !this.caseId) return;
    const file = input.files[0];

    this.uploadingToVault = true;
    this.vaultAnalysisStep = 'Uploading to Policy Vault...';
    this.vaultAnalysisProgress = 0;

    // Upload to Policy Vault with adjuster_case_id linkage
    this.policyService.upload(file, { adjuster_case_id: this.caseId } as any).subscribe({
      next: (doc) => {
        this.vaultPolicy = doc;
        this.vaultPolicies = [doc, ...this.vaultPolicies];
        this.uploadingToVault = false;
        input.value = '';
        this.snackBar.open('Policy stored in vault', 'Close', { duration: 2000 });
        // Auto-run full analysis pipeline
        this.runVaultAnalysisPipeline(doc.id);
      },
      error: () => {
        this.uploadingToVault = false;
        this.snackBar.open('Upload failed', 'Close', { duration: 3000 });
      },
    });
  }

  runVaultAnalysisPipeline(docId: string): void {
    this.vaultAnalyzing = true;
    this.vaultAnalysisProgress = 10;
    this.vaultAnalysisStep = 'Extracting metadata...';

    // Step 1: Extract Metadata
    this.policyService.extractMetadata(docId).subscribe({
      next: (doc) => {
        this.vaultPolicy = doc;
        this.vaultAnalysisProgress = 35;
        this.vaultAnalysisStep = 'Extracting clauses & coverages...';

        // Step 2: Extract Clauses
        this.policyService.extractClauses(docId).subscribe({
          next: (clauses) => {
            if (this.vaultPolicy) {
              this.vaultPolicy.clauses = clauses;
            }
            this.vaultAnalysisProgress = 70;
            this.vaultAnalysisStep = 'Generating AI summary...';

            // Step 3: Summarize
            this.policyService.summarize(docId).subscribe({
              next: (doc) => {
                this.vaultPolicy = doc;
                this.vaultAnalysisProgress = 100;
                this.vaultAnalysisStep = 'Analysis complete';
                this.vaultAnalyzing = false;
                this.snackBar.open('Policy analysis complete', 'Close', { duration: 3000 });
                // Reload to get full intelligence data
                this.reloadVaultPolicy(docId);
              },
              error: () => this.handleVaultError('Summarization failed'),
            });
          },
          error: () => this.handleVaultError('Clause extraction failed'),
        });
      },
      error: () => this.handleVaultError('Metadata extraction failed'),
    });
  }

  private handleVaultError(msg: string): void {
    this.vaultAnalyzing = false;
    this.vaultAnalysisStep = msg;
    this.snackBar.open(msg, 'Close', { duration: 4000 });
    // Reload to get any partial results
    if (this.vaultPolicy?.id) {
      this.reloadVaultPolicy(this.vaultPolicy.id);
    }
  }

  private reloadVaultPolicy(docId: string): void {
    this.policyService.get(docId).subscribe({
      next: (doc) => {
        this.vaultPolicy = doc;
        // Update in the list
        const idx = this.vaultPolicies.findIndex(p => p.id === doc.id);
        if (idx >= 0) this.vaultPolicies[idx] = doc;
      },
      error: (err) => {
        console.warn('[StepGuard] reloadVaultPolicy failed:', err?.status);
      },
    });
  }

  reAnalyzeVaultPolicy(): void {
    if (!this.vaultPolicy?.id) return;
    this.runVaultAnalysisPipeline(this.vaultPolicy.id);
  }

  get vaultIntel(): PolicyIntelligence | null {
    return this.vaultPolicy?.intelligence || null;
  }

  get hasVaultCoverage(): boolean {
    const i = this.vaultIntel;
    if (!i) return false;
    return !!(
      i.coverage_a_dwelling || i.coverage_b_other_structures ||
      i.coverage_c_personal_property || i.coverage_d_loss_of_use ||
      i.coverage_e_liability || i.coverage_f_medical
    );
  }

  get hasVaultDeductibles(): boolean {
    const i = this.vaultIntel;
    if (!i) return false;
    return !!(i.deductible_amount || i.deductible_wind_hail || i.deductible_hurricane || i.deductible_percentage);
  }

  get hasVaultLanguage(): boolean {
    const i = this.vaultIntel;
    if (!i) return false;
    return !!(
      i.replacement_cost_language || i.matching_language || i.loss_settlement_clause ||
      i.appraisal_clause || i.ordinance_and_law || i.duties_after_loss ||
      i.ale_loss_of_use_details || i.deadline_notice_details
    );
  }

  get isVaultAnalyzed(): boolean {
    return !!(this.vaultPolicy?.intelligence && this.vaultPolicy?.ai_summary);
  }

  parseVaultEndorsements(): { title: string; summary: string }[] {
    try {
      return this.vaultIntel?.endorsements_json ? JSON.parse(this.vaultIntel.endorsements_json) : [];
    } catch { return []; }
  }

  parseVaultExclusions(): { title: string; summary: string }[] {
    try {
      return this.vaultIntel?.exclusions_json ? JSON.parse(this.vaultIntel.exclusions_json) : [];
    } catch { return []; }
  }

  // Quick AI tools
  runAssistantAction(actionType: string): void {
    if (!this.vaultPolicy?.id) return;
    this.actionLoading[actionType] = true;
    this.actionResult = null;
    this.policyService.assistantAction(this.vaultPolicy.id, { action_type: actionType }).subscribe({
      next: (result) => {
        this.actionResult = result;
        this.actionLoading[actionType] = false;
      },
      error: () => {
        this.actionLoading[actionType] = false;
        this.snackBar.open('Action failed', 'Close', { duration: 3000 });
      },
    });
  }

  // ── Step 0: Intake ──

  createCase(): void {
    this.saving = true;
    const data: Partial<AdjusterCase> = {
      intake_loss_date: this.intakeLossDate || undefined,
      intake_loss_type: this.intakeLossType || undefined,
      intake_address: this.intakeAddress || undefined,
      intake_insured_name: this.intakeInsuredName || undefined,
      intake_carrier: this.intakeCarrier || undefined,
      intake_policy_number: this.intakePolicyNumber || undefined,
      intake_claim_number: this.intakeClaimNumber || undefined,
      intake_notes: this.intakeNotes || undefined,
    };
    this.caseService.create(data).subscribe({
      next: (c) => {
        this.adjCase = c;
        this.caseId = c.id;
        this.isNew = false;
        this.populateFromCase(c);
        this.saving = false;
        this.snackBar.open('Case created: ' + c.case_number, 'Close', { duration: 3000 });
        this.router.navigate(['/app/adjuster-assistant', c.id], { replaceUrl: true });
      },
      error: () => {
        this.saving = false;
        this.snackBar.open('Failed to create case', 'Close', { duration: 3000 });
      },
    });
  }

  saveIntake(): void {
    if (!this.caseId) return;
    this.saving = true;
    const data: Partial<AdjusterCase> = {
      intake_loss_date: this.intakeLossDate || undefined,
      intake_loss_type: this.intakeLossType || undefined,
      intake_address: this.intakeAddress || undefined,
      intake_insured_name: this.intakeInsuredName || undefined,
      intake_carrier: this.intakeCarrier || undefined,
      intake_policy_number: this.intakePolicyNumber || undefined,
      intake_claim_number: this.intakeClaimNumber || undefined,
      intake_notes: this.intakeNotes || undefined,
    };
    this.caseService.update(this.caseId, data).subscribe({
      next: (c) => {
        this.adjCase = c;
        this.populateFromCase(c);
        this.saving = false;
        this.snackBar.open('Intake saved', 'Close', { duration: 2000 });
      },
      error: () => {
        this.saving = false;
        this.snackBar.open('Failed to save', 'Close', { duration: 3000 });
      },
    });
  }

  // ── Step advancement ──

  advanceStep(): void {
    if (!this.caseId || this.advancing) return;
    if (this.adjCase && this.adjCase.current_step >= this.MAX_STEP) {
      console.warn('[StepGuard] advanceStep blocked — already at max step', this.adjCase.current_step);
      return;
    }
    this.advancing = true;
    this.caseService.advance(this.caseId).subscribe({
      next: (c) => {
        this.adjCase = c;
        this.populateFromCase(c);
        this.advancing = false;
        if (this.stepper) {
          this.stepper.next();
        }
      },
      error: (err) => {
        this.advancing = false;
        console.warn('[StepGuard] advanceStep failed:', err?.status, err?.message);
        this.snackBar.open('Failed to advance step', 'Close', { duration: 3000 });
      },
    });
  }

  // ── Document upload ──

  onFileSelected(event: Event, fileType: string, step: string): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || !this.caseId) return;
    const file = input.files[0];
    this.caseService.uploadDocument(this.caseId, file, fileType, step).subscribe({
      next: (doc) => {
        this.documents.push(doc);
        this.snackBar.open('File uploaded', 'Close', { duration: 2000 });
        input.value = '';
      },
      error: () => {
        this.snackBar.open('Upload failed', 'Close', { duration: 3000 });
      },
    });
  }

  deleteDocument(docId: string): void {
    if (!this.caseId) return;
    this.caseService.deleteDocument(this.caseId, docId).subscribe({
      next: () => {
        this.documents = this.documents.filter((d) => d.id !== docId);
        this.snackBar.open('Document deleted', 'Close', { duration: 2000 });
      },
      error: () => {
        this.snackBar.open('Delete failed', 'Close', { duration: 3000 });
      },
    });
  }

  getDocsByStep(step: string): AdjusterCaseDocument[] {
    return this.documents.filter((d) => d.step === step);
  }

  getDocsByType(type: string): AdjusterCaseDocument[] {
    return this.documents.filter((d) => d.file_type === type);
  }

  // ── Step 1: Policy Analysis (legacy backend route) ──

  analyzePolicy(): void {
    if (!this.caseId) return;
    this.analyzingPolicy = true;
    this.caseService.analyzePolicy(this.caseId).subscribe({
      next: (analyses) => {
        this.policyAnalyses = analyses;
        this.analyzingPolicy = false;
        this.snackBar.open('Policy analyzed', 'Close', { duration: 2000 });
      },
      error: (err) => {
        this.analyzingPolicy = false;
        const msg = err?.error?.detail || 'Policy analysis failed';
        this.snackBar.open(msg, 'Close', { duration: 4000 });
      },
    });
  }

  // ── Step 2: Damage Review ──

  analyzeDamage(): void {
    if (!this.caseId) return;
    this.analyzingDamage = true;
    this.caseService.analyzeDamage(this.caseId).subscribe({
      next: (res) => {
        this.damageNotes = res?.message || '';
        this.analyzingDamage = false;
        this.snackBar.open(res?.message || 'Done', 'Close', { duration: 3000 });
      },
      error: () => {
        this.analyzingDamage = false;
        this.snackBar.open('Damage analysis failed', 'Close', { duration: 3000 });
      },
    });
  }

  saveDamageNotes(): void {
    if (!this.caseId) return;
    this.caseService
      .update(this.caseId, { damage_ai_summary: this.damageNotes })
      .subscribe({
        next: () => this.snackBar.open('Damage notes saved', 'Close', { duration: 2000 }),
        error: () => this.snackBar.open('Save failed', 'Close', { duration: 3000 }),
      });
  }

  // ── Step 3: Draft Scope ──

  generateScope(): void {
    if (!this.caseId) return;
    this.generatingScope = true;
    this.caseService.generateScope(this.caseId).subscribe({
      next: (c) => {
        this.scopeAiSummary = c.scope_ai_summary || '';
        this.parseScopeByRoom();
        this.generatingScope = false;
        this.snackBar.open('Scope generated', 'Close', { duration: 2000 });
      },
      error: (err) => {
        this.generatingScope = false;
        const msg = err?.error?.detail || 'Scope generation failed';
        this.snackBar.open(msg, 'Close', { duration: 4000 });
      },
    });
  }

  parseScopeByRoom(): void {
    if (!this.scopeAiSummary) { this.scopeSections = []; return; }
    const text = this.stripMarkdown(this.scopeAiSummary);
    const lines = text.split('\n');
    const sections: { room: string; items: string[] }[] = [];
    let current: { room: string; items: string[] } | null = null;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (!trimmed.startsWith('-') && !trimmed.startsWith('•') && trimmed === trimmed.toUpperCase() && trimmed.length < 80) {
        current = { room: trimmed, items: [] };
        sections.push(current);
      } else if (!trimmed.startsWith('-') && !trimmed.startsWith('•') && /^[A-Z][a-z]/.test(trimmed) && !current) {
        current = { room: trimmed, items: [] };
        sections.push(current);
      } else if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
        const item = trimmed.replace(/^[-•]\s*/, '');
        if (current) { current.items.push(item); }
        else { current = { room: 'General', items: [item] }; sections.push(current); }
      } else if (current) {
        current.items.push(trimmed);
      }
    }
    this.scopeSections = sections;
  }

  stripMarkdown(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/#{1,6}\s*/g, '')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1');
  }

  saveScopeNotes(): void {
    if (!this.caseId) return;
    this.caseService
      .update(this.caseId, { scope_notes: this.scopeNotes, scope_ai_summary: this.scopeAiSummary })
      .subscribe({
        next: () => this.snackBar.open('Scope saved', 'Close', { duration: 2000 }),
        error: () => this.snackBar.open('Save failed', 'Close', { duration: 3000 }),
      });
  }

  // ── Step 4: Link Estimate ──

  linkEstimate(): void {
    if (!this.caseId) return;
    this.linkingEstimate = true;
    this.caseService.linkEstimate(this.caseId).subscribe({
      next: (project) => {
        this.linkingEstimate = false;
        this.snackBar.open('Estimate linked', 'Close', { duration: 2000 });
        // Navigate to estimating detail
        this.router.navigate(['/app/estimating', project.id]);
      },
      error: () => {
        this.linkingEstimate = false;
        this.snackBar.open('Failed to link estimate', 'Close', { duration: 3000 });
      },
    });
  }

  // ── Step 5: Gap Analysis ──

  loadPaEstimate(): void {
    if (!this.adjCase?.estimate_project_id) {
      console.warn('[StepGuard] loadPaEstimate skipped — no estimate_project_id on case');
      return;
    }
    this.estimatingService.getEstimate(this.adjCase.estimate_project_id).subscribe({
      next: (project) => {
        this.paEstimate = project;
      },
      error: (err) => {
        console.warn('[StepGuard] loadPaEstimate failed:', err?.status, '— Gap Analysis will show PA estimate as missing');
      },
    });
  }

  onCarrierEstimateUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      this.carrierRawText = text;
      this.carrierData = this.gapService.parseCarrierEstimateText(text);
      this.snackBar.open(`Parsed ${this.carrierData.lineItems.length} carrier line items`, 'Close', { duration: 3000 });
    };
    reader.readAsText(file);
    input.value = '';
  }

  onCarrierTextPaste(): void {
    if (!this.carrierRawText.trim()) return;
    this.carrierData = this.gapService.parseCarrierEstimateText(this.carrierRawText);
    this.snackBar.open(`Parsed ${this.carrierData.lineItems.length} carrier line items`, 'Close', { duration: 3000 });
  }

  runGapAnalysis(): void {
    if (!this.paEstimate || !this.carrierData || !this.caseId) return;
    this.runningGapAnalysis = true;
    const paItems = this.gapService.normalizeEstimateProject(this.paEstimate);
    this.gapReport = this.gapService.runFullAnalysis(
      paItems,
      this.carrierData.lineItems,
      this.caseId,
      this.vaultIntel,
    );
    this.runningGapAnalysis = false;
    this.snackBar.open(`Gap analysis complete: ${this.gapReport.findings.length} findings`, 'Close', { duration: 3000 });
  }

  get canRunGapAnalysis(): boolean {
    return !!this.paEstimate && !!this.carrierData;
  }

  get filteredFindings(): GapFinding[] {
    if (!this.gapReport) return [];
    if (this.gapFilterCategory === 'all') return this.gapReport.findings;
    if (this.gapFilterCategory === 'critical') return this.gapReport.findings.filter(f => f.severity === 'critical');
    return this.gapReport.findings.filter(f => f.category === this.gapFilterCategory);
  }

  exportGapCSV(): void {
    if (!this.gapReport) return;
    const rows = this.gapService.toCSVRows(this.gapReport);
    this.downloader.downloadCSVFromArray('gap-analysis.csv', rows);
  }

  generateSupplementLetter(): void {
    if (!this.vaultPolicy?.id || !this.gapReport) return;
    this.generatingSupplement = true;
    this.policyService.assistantAction(this.vaultPolicy.id, {
      action_type: 'supplement_support',
      claim_context: this.gapReport.summary,
    }).subscribe({
      next: (result) => {
        this.supplementLetter = result.result_text;
        this.generatingSupplement = false;
      },
      error: () => {
        this.generatingSupplement = false;
        this.snackBar.open('Failed to generate supplement letter', 'Close', { duration: 3000 });
      },
    });
  }

  // ── Step 6: PA Review (was Step 5) ──

  approveCase(): void {
    if (!this.caseId) return;
    this.approvingPa = true;
    this.caseService.paApprove(this.caseId, this.paNotes).subscribe({
      next: (c) => {
        this.adjCase = c;
        this.paApproved = c.pa_approved;
        this.approvingPa = false;
        this.snackBar.open('Case approved by PA', 'Close', { duration: 2000 });
      },
      error: () => {
        this.approvingPa = false;
        this.snackBar.open('Approval failed', 'Close', { duration: 3000 });
      },
    });
  }

  // ── Step 7: Final Report (was Step 6) ──

  generateReport(): void {
    if (!this.caseId) return;
    this.generatingReport = true;
    this.caseService.generateReport(this.caseId).subscribe({
      next: (res) => {
        this.generatingReport = false;
        this.snackBar.open(res?.message || 'Report feature coming soon', 'Close', { duration: 3000 });
      },
      error: () => {
        this.generatingReport = false;
        this.snackBar.open('Report generation failed', 'Close', { duration: 3000 });
      },
    });
  }

  // ── Step Navigation Guards ──

  onStepChange(event: StepperSelectionEvent): void {
    this.stepGuardMessage = '';
    const target = event.selectedIndex;
    const missing = this.getMissingPrereqs(target);
    if (missing.length > 0) {
      this.stepGuardMessage = missing[0];
      console.warn(`[StepGuard] Step ${target} missing prerequisites:`, missing);
    }
  }

  getMissingPrereqs(stepIndex: number): string[] {
    const missing: string[] = [];
    if (stepIndex >= 1 && !this.adjCase) {
      missing.push('Complete Intake and create the case before proceeding.');
    }
    if (stepIndex === 4 && !this.adjCase?.id) {
      missing.push('Save the case before creating an estimate.');
    }
    if (stepIndex === 5) {
      if (!this.paEstimate) {
        missing.push('Link a PA estimate in Draft Estimate (Step 4) before running Gap Analysis.');
      }
    }
    if (stepIndex === 6 && !this.adjCase?.id) {
      missing.push('Complete prior steps before PA Review.');
    }
    if (stepIndex === 7) {
      if (!this.paApproved) {
        missing.push('PA Review approval is required before generating the Final Report.');
      }
    }
    return missing;
  }

  isStepReady(stepIndex: number): boolean {
    return this.getMissingPrereqs(stepIndex).length === 0;
  }

  // ── Negotiation Command Center ──

  toggleCommandCenter(): void {
    this.showCommandCenter = !this.showCommandCenter;
    if (this.showCommandCenter && !this.negotiationStrategy) {
      this.generateStrategy();
    }
  }

  generateStrategy(): void {
    if (!this.gapReport) return;
    this.generatingStrategy = true;
    this.negotiationStrategy = this.negotiationService.assessPositionStrength(
      this.gapReport,
      this.vaultPolicy?.intelligence
    );
    this.generatingStrategy = false;
    this.onSettlementSliderChange();
  }

  onSettlementSliderChange(): void {
    if (!this.gapReport) return;
    this.settlementScenario = this.negotiationService.calculateSettlement(
      this.settlementPercentage,
      this.gapReport,
      this.vaultPolicy?.intelligence
    );
  }

  generateDocument(docType: DocumentType): void {
    if (!this.adjCase?.id || !this.gapReport || !this.negotiationStrategy) return;
    this.generatingDocType = docType;
    const docTypes = this.negotiationService.getDocumentTypes();
    const dt = docTypes.find(d => d.type === docType);
    if (!dt) return;

    const claimContext = this.negotiationService.buildClaimContextForAI(
      this.gapReport,
      this.negotiationStrategy,
      this.negotiationRounds
    );

    this.caseService.policyAction(this.adjCase.id, {
      action_type: dt.actionType,
      claim_context: claimContext,
    }).subscribe({
      next: (result) => {
        const existing = this.generatedDocuments.findIndex(d => d.type === docType);
        const doc: GeneratedDocument = {
          type: docType,
          title: dt.label,
          content: result.result_text,
          generatedAt: new Date(),
          clausesReferenced: result.clauses_referenced || [],
        };
        if (existing >= 0) {
          this.generatedDocuments[existing] = doc;
        } else {
          this.generatedDocuments.push(doc);
        }
        this.generatingDocType = null;
      },
      error: () => {
        this.generatingDocType = null;
        this.snackBar.open('Failed to generate document', 'Close', { duration: 3000 });
      },
    });
  }

  getGeneratedDoc(docType: DocumentType): GeneratedDocument | undefined {
    return this.generatedDocuments.find(d => d.type === docType);
  }

  copyDocToClipboard(doc: GeneratedDocument): void {
    navigator.clipboard.writeText(doc.content).then(() => {
      this.snackBar.open('Copied to clipboard', 'Close', { duration: 2000 });
    });
  }

  downloadDoc(doc: GeneratedDocument): void {
    const blob = new Blob([doc.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.type}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  addNegotiationRound(): void {
    if (!this.newRoundDate || !this.newRoundCarrierOffer) return;
    const round = this.negotiationService.createRound(
      this.negotiationRounds.length + 1,
      this.newRoundDate,
      this.newRoundCarrierOffer,
      this.newRoundPaCounter,
      this.newRoundNotes
    );
    this.negotiationRounds.push(round);
    this.newRoundDate = '';
    this.newRoundCarrierOffer = 0;
    this.newRoundPaCounter = 0;
    this.newRoundNotes = '';
  }

  removeRound(id: string): void {
    this.negotiationRounds = this.negotiationRounds.filter(r => r.id !== id);
  }

  get latestOffer(): number {
    if (this.negotiationRounds.length > 0) {
      return this.negotiationRounds[this.negotiationRounds.length - 1].carrierOfferAmount;
    }
    return this.gapReport?.carrierEstimateTotal ?? 0;
  }

  get strengthColorClass(): string {
    if (!this.negotiationStrategy) return '';
    const map: Record<string, string> = {
      strong: 'strength-strong',
      moderate: 'strength-moderate',
      weak: 'strength-weak',
    };
    return map[this.negotiationStrategy.positionStrength] || '';
  }

  get documentTypes() {
    return this.negotiationService.getDocumentTypes();
  }

  goBack(): void {
    this.router.navigate(['/app/adjuster-assistant']);
  }
}
