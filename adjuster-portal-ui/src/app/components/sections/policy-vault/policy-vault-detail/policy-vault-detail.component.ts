import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgxSpinnerService } from 'ngx-spinner';
import {
  AnalysisPipelineState,
  AnalysisStep,
  AssistantActionResponse,
  PolicyClause,
  PolicyDocument,
  PolicyIntelligence,
} from 'src/app/models/policy-document.model';
import { PolicyDocumentService } from 'src/app/services/policy-document.service';
import { GapAnalysisService } from 'src/app/services/gap-analysis.service';
import { GapAnalysisReadiness } from 'src/app/models/gap-analysis.model';

@Component({
  standalone: false,
  selector: 'app-policy-vault-detail',
  templateUrl: './policy-vault-detail.component.html',
  styleUrls: ['./policy-vault-detail.component.scss'],
})
export class PolicyVaultDetailComponent implements OnInit, OnDestroy {
  docId: string | null = null;
  doc: PolicyDocument | null = null;
  versions: PolicyDocument[] = [];
  clauses: PolicyClause[] = [];
  loading = false;
  saving = false;
  extracting = false;
  extractingClauses = false;
  summarizing = false;
  activeTab = 0;

  // Editable fields
  insuredName = '';
  carrier = '';
  policyNumber = '';
  claimNumber = '';
  policyType = '';
  effectiveDate = '';
  expirationDate = '';
  propertyAddress = '';
  propertyCity = '';
  propertyState = '';
  propertyZip = '';
  notes = '';

  policyTypes = ['homeowners', 'fire', 'commercial', 'auto', 'flood', 'umbrella'];

  // Clause type grouping
  clauseTypeLabels: Record<string, string> = {
    coverage: 'Coverages',
    deductible: 'Deductibles',
    limit: 'Limits',
    endorsement: 'Endorsements',
    exclusion: 'Exclusions',
    loss_settlement: 'Loss Settlement',
    replacement_cost_acv: 'Replacement Cost / ACV',
    duties_after_loss: 'Duties After Loss',
    appraisal: 'Appraisal',
    matching: 'Matching',
    ordinance_law: 'Ordinance & Law',
    ale_loss_of_use: 'ALE / Loss of Use',
    deadline_notice: 'Deadlines & Notices',
  };

  // Assistant actions
  assistantActions = [
    { type: 'coverage_issues', label: 'Coverage Issues', icon: 'warning' },
    { type: 'flag_exclusions', label: 'Flag Exclusions', icon: 'block' },
    { type: 'matching_language', label: 'Matching Language', icon: 'compare' },
    { type: 'deductible_analysis', label: 'Deductible Analysis', icon: 'calculate' },
    { type: 'replacement_cost', label: 'Replacement Cost', icon: 'home_repair_service' },
    { type: 'supplement_support', label: 'Supplement Support', icon: 'add_circle' },
    { type: 'estimate_defense', label: 'Estimate Defense Letter', icon: 'description' },
    { type: 'followup_letter', label: 'Follow-Up Letter', icon: 'mail' },
  ];
  actionLoading: Record<string, boolean> = {};
  actionResult: AssistantActionResponse | null = null;

  // Pipeline state
  showOverview = false;
  showAdvancedTools = false;
  helperInterval: ReturnType<typeof setInterval> | null = null;

  pipelineState: AnalysisPipelineState = {
    isRunning: false,
    currentStepIndex: -1,
    steps: this.buildPipelineSteps(),
    startedAt: null,
    completedAt: null,
    error: null,
    helperMessage: '',
  };

  // Gap analysis readiness
  gapReadiness: GapAnalysisReadiness = {
    hasPolicy: false,
    hasPaEstimate: false,
    hasCarrierEstimate: false,
    hasSupplementEstimate: false,
    canRunAnalysis: false,
    message: 'Estimate comparison available once claim estimates are uploaded.',
  };

  private helperMessages = [
    'Reading through the policy document...',
    'Identifying coverage sections...',
    'Analyzing deductible structures...',
    'Extracting endorsement details...',
    'Reviewing exclusion language...',
    'Building claim guidance notes...',
    'Cross-referencing coverage limits...',
    'Evaluating replacement cost provisions...',
    'Checking matching requirements...',
    'Almost there — finalizing intelligence...',
  ];
  private helperMessageIndex = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private policyService: PolicyDocumentService,
    private gapAnalysisService: GapAnalysisService,
    private snackBar: MatSnackBar,
    private spinner: NgxSpinnerService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.docId = id;
      this.loadDocument();
      this.loadVersions();
    }
  }

  loadDocument(): void {
    if (!this.docId) return;
    this.loading = true;
    this.spinner.show();
    this.policyService.get(this.docId).subscribe({
      next: (doc) => {
        this.doc = doc;
        this.clauses = doc.clauses || [];
        this.populateFields(doc);
        this.updateGapReadiness();
        this.loading = false;
        this.spinner.hide();
      },
      error: () => {
        this.loading = false;
        this.spinner.hide();
        this.snackBar.open('Failed to load document', 'Close', { duration: 3000 });
      },
    });
  }

  loadVersions(): void {
    if (!this.docId) return;
    this.policyService.getVersions(this.docId).subscribe({
      next: (versions) => {
        this.versions = versions;
      },
    });
  }

  private populateFields(doc: PolicyDocument): void {
    this.insuredName = doc.insured_name || '';
    this.carrier = doc.carrier || '';
    this.policyNumber = doc.policy_number || '';
    this.claimNumber = doc.claim_number || '';
    this.policyType = doc.policy_type || '';
    this.effectiveDate = doc.effective_date || '';
    this.expirationDate = doc.expiration_date || '';
    this.propertyAddress = doc.property_address || '';
    this.propertyCity = doc.property_city || '';
    this.propertyState = doc.property_state || '';
    this.propertyZip = doc.property_zip || '';
    this.notes = doc.notes || '';
  }

  saveMetadata(): void {
    if (!this.docId) return;
    this.saving = true;
    const data: Partial<PolicyDocument> = {
      insured_name: this.insuredName || undefined,
      carrier: this.carrier || undefined,
      policy_number: this.policyNumber || undefined,
      claim_number: this.claimNumber || undefined,
      policy_type: this.policyType || undefined,
      effective_date: this.effectiveDate || undefined,
      expiration_date: this.expirationDate || undefined,
      property_address: this.propertyAddress || undefined,
      property_city: this.propertyCity || undefined,
      property_state: this.propertyState || undefined,
      property_zip: this.propertyZip || undefined,
      notes: this.notes || undefined,
    };
    this.policyService.update(this.docId, data).subscribe({
      next: (doc) => {
        this.doc = doc;
        this.saving = false;
        this.snackBar.open('Metadata saved', 'Close', { duration: 2000 });
      },
      error: () => {
        this.saving = false;
        this.snackBar.open('Save failed', 'Close', { duration: 3000 });
      },
    });
  }

  extractMetadata(): void {
    if (!this.docId) return;
    this.extracting = true;
    this.policyService.extractMetadata(this.docId).subscribe({
      next: (doc) => {
        this.doc = doc;
        this.populateFields(doc);
        this.extracting = false;
        this.snackBar.open('Metadata extracted', 'Close', { duration: 2000 });
      },
      error: () => {
        this.extracting = false;
        this.snackBar.open('Extraction failed', 'Close', { duration: 3000 });
      },
    });
  }

  extractClauses(): void {
    if (!this.docId) return;
    this.extractingClauses = true;
    this.policyService.extractClauses(this.docId).subscribe({
      next: (clauses) => {
        this.clauses = clauses;
        this.extractingClauses = false;
        this.snackBar.open(`${clauses.length} clauses extracted`, 'Close', { duration: 2000 });
        this.loadDocument();
      },
      error: () => {
        this.extractingClauses = false;
        this.snackBar.open('Clause extraction failed', 'Close', { duration: 3000 });
      },
    });
  }

  summarize(): void {
    if (!this.docId) return;
    this.summarizing = true;
    this.policyService.summarize(this.docId).subscribe({
      next: (doc) => {
        this.doc = doc;
        this.summarizing = false;
        this.snackBar.open('Summary generated', 'Close', { duration: 2000 });
      },
      error: () => {
        this.summarizing = false;
        this.snackBar.open('Summarization failed', 'Close', { duration: 3000 });
      },
    });
  }

  runAction(actionType: string): void {
    if (!this.docId) return;
    this.actionLoading[actionType] = true;
    this.actionResult = null;
    this.policyService.assistantAction(this.docId, { action_type: actionType }).subscribe({
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

  getClausesByType(type: string): PolicyClause[] {
    return this.clauses.filter((c) => c.clause_type === type);
  }

  getClauseTypes(): string[] {
    const types = new Set(this.clauses.map((c) => c.clause_type));
    return Array.from(types);
  }

  getEndorsementsAndExclusions(): PolicyClause[] {
    return this.clauses.filter(
      (c) => c.clause_type === 'endorsement' || c.clause_type === 'exclusion'
    );
  }

  onNewVersionSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || !this.docId) return;
    const file = input.files[0];
    this.spinner.show();
    this.policyService.uploadNewVersion(this.docId, file).subscribe({
      next: () => {
        this.snackBar.open('New version uploaded', 'Close', { duration: 2000 });
        input.value = '';
        this.loadVersions();
        this.spinner.hide();
      },
      error: () => {
        this.spinner.hide();
        this.snackBar.open('Upload failed', 'Close', { duration: 3000 });
      },
    });
  }

  get intel(): PolicyIntelligence | null {
    return this.doc?.intelligence || null;
  }

  get hasCoverageLimits(): boolean {
    const i = this.intel;
    if (!i) return false;
    return !!(
      i.coverage_a_dwelling || i.coverage_b_other_structures ||
      i.coverage_c_personal_property || i.coverage_d_loss_of_use ||
      i.coverage_e_liability || i.coverage_f_medical
    );
  }

  get hasDeductibles(): boolean {
    const i = this.intel;
    if (!i) return false;
    return !!(i.deductible_amount || i.deductible_wind_hail || i.deductible_hurricane || i.deductible_percentage);
  }

  get hasClauseLanguage(): boolean {
    const i = this.intel;
    if (!i) return false;
    return !!(
      i.replacement_cost_language || i.matching_language || i.loss_settlement_clause ||
      i.appraisal_clause || i.ordinance_and_law || i.duties_after_loss ||
      i.ale_loss_of_use_details || i.deadline_notice_details
    );
  }

  parseEndorsements(): { title: string; summary: string }[] {
    try {
      return this.intel?.endorsements_json ? JSON.parse(this.intel.endorsements_json) : [];
    } catch { return []; }
  }

  parseExclusions(): { title: string; summary: string }[] {
    try {
      return this.intel?.exclusions_json ? JSON.parse(this.intel.exclusions_json) : [];
    } catch { return []; }
  }

  goBack(): void {
    this.router.navigate(['/app/policy-vault']);
  }

  private updateGapReadiness(): void {
    if (!this.doc) return;
    // Policy is "ready" when intelligence has been extracted
    const policyId = this.doc.intelligence ? this.doc.id : null;
    const claimId = this.doc.claim_id || '';
    // Estimates are not yet linked at the policy-document level;
    // future implementation will resolve these from the claim.
    this.gapReadiness = this.gapAnalysisService.checkReadiness(
      this.gapAnalysisService.buildBundle(claimId, policyId)
    );
  }

  ngOnDestroy(): void {
    this.stopHelperMessageRotation();
  }

  // --- Pipeline ---

  private buildPipelineSteps(): AnalysisStep[] {
    return [
      { id: 'upload', label: 'Upload Received', status: 'waiting', icon: 'cloud_upload' },
      { id: 'read', label: 'Reading PDF', status: 'waiting', icon: 'menu_book' },
      { id: 'metadata', label: 'Extracting Metadata', status: 'waiting', icon: 'data_object' },
      { id: 'coverages', label: 'Extracting Coverages', status: 'waiting', icon: 'shield' },
      { id: 'intel', label: 'Building Intelligence', status: 'waiting', icon: 'psychology' },
      { id: 'summary', label: 'AI Summary', status: 'waiting', icon: 'summarize' },
      { id: 'finalize', label: 'Finalizing', status: 'waiting', icon: 'check_circle' },
    ];
  }

  get pipelineProgress(): number {
    const completed = this.pipelineState.steps.filter(s => s.status === 'complete').length;
    return Math.round((completed / this.pipelineState.steps.length) * 100);
  }

  get canAnalyze(): boolean {
    return !!this.docId && !this.pipelineState.isRunning;
  }

  get isAnalyzed(): boolean {
    return !!(this.doc?.ai_summary && this.doc?.intelligence && this.clauses.length > 0);
  }

  analyzePolicy(): void {
    if (!this.docId || this.pipelineState.isRunning) return;

    // Reset pipeline
    this.pipelineState = {
      isRunning: true,
      currentStepIndex: 0,
      steps: this.buildPipelineSteps(),
      startedAt: new Date(),
      completedAt: null,
      error: null,
      helperMessage: this.helperMessages[0],
    };
    this.showOverview = false;
    this.helperMessageIndex = 0;
    this.startHelperMessageRotation();

    // Step 0: Upload Received — immediate
    this.completeStep(0);

    // Step 1-2: Extract Metadata
    this.advanceStep(1);
    this.policyService.extractMetadata(this.docId).subscribe({
      next: (doc) => {
        this.doc = doc;
        this.populateFields(doc);
        this.completeStep(1);
        this.completeStep(2);
        this.runClauseExtraction();
      },
      error: (err) => {
        this.handlePipelineError(1, 'Metadata extraction failed');
      },
    });
  }

  private runClauseExtraction(): void {
    if (!this.docId) return;
    // Step 3-4: Extract Clauses
    this.advanceStep(3);
    this.policyService.extractClauses(this.docId).subscribe({
      next: (clauses) => {
        this.clauses = clauses;
        this.completeStep(3);
        this.completeStep(4);
        this.runSummarize();
      },
      error: () => {
        this.handlePipelineError(3, 'Clause extraction failed');
      },
    });
  }

  private runSummarize(): void {
    if (!this.docId) return;
    // Step 5-6: Summarize
    this.advanceStep(5);
    this.policyService.summarize(this.docId).subscribe({
      next: (doc) => {
        this.doc = doc;
        this.completeStep(5);
        this.completeStep(6);
        this.finalizePipeline();
      },
      error: () => {
        this.handlePipelineError(5, 'Summarization failed');
      },
    });
  }

  private advanceStep(index: number): void {
    this.pipelineState.currentStepIndex = index;
    this.pipelineState.steps[index].status = 'active';
  }

  private completeStep(index: number): void {
    this.pipelineState.steps[index].status = 'complete';
  }

  private handlePipelineError(index: number, message: string): void {
    this.pipelineState.steps[index].status = 'error';
    this.pipelineState.isRunning = false;
    this.pipelineState.error = message;
    this.stopHelperMessageRotation();
    this.snackBar.open(message, 'Close', { duration: 5000 });
    // Reload doc to get any partial results
    this.loadDocument();
  }

  private finalizePipeline(): void {
    this.pipelineState.isRunning = false;
    this.pipelineState.completedAt = new Date();
    this.pipelineState.helperMessage = 'Analysis complete!';
    this.stopHelperMessageRotation();
    this.showOverview = true;
    // Switch to overview tab (index 0 once overview tab is added)
    this.activeTab = 0;
    this.snackBar.open('Policy analysis complete', 'Close', { duration: 3000 });
    // Reload to get all updated data
    this.loadDocument();
  }

  private startHelperMessageRotation(): void {
    this.helperInterval = setInterval(() => {
      this.helperMessageIndex = (this.helperMessageIndex + 1) % this.helperMessages.length;
      this.pipelineState.helperMessage = this.helperMessages[this.helperMessageIndex];
    }, 4000);
  }

  private stopHelperMessageRotation(): void {
    if (this.helperInterval) {
      clearInterval(this.helperInterval);
      this.helperInterval = null;
    }
  }
}
