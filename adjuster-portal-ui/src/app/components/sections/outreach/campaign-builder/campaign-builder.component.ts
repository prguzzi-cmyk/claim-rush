import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, Subject } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import { OutreachService } from 'src/app/services/outreach.service';
import {
  OutreachTemplate,
  OutreachCampaign,
  CampaignPreviewResponse,
  CAMPAIGN_TYPE_OPTIONS,
  INCIDENT_TYPE_OPTIONS,
  TRIGGER_OPTIONS,
} from 'src/app/models/outreach.model';
import { NgxSpinnerService } from 'ngx-spinner';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-campaign-builder',
  templateUrl: './campaign-builder.component.html',
  styleUrls: ['./campaign-builder.component.scss'],
  standalone: false,
})
export class CampaignBuilderComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  campaignForm: FormGroup;
  templates: OutreachTemplate[] = [];
  previewResult: CampaignPreviewResponse | null = null;
  isEditMode = false;
  campaignId: string | null = null;

  // Polish properties
  formDirty = false;
  private navigatingAway = false;
  saving = false;
  launching = false;
  loadingCampaign = false;
  selectedTemplate: OutreachTemplate | null = null;

  campaignTypes = CAMPAIGN_TYPE_OPTIONS;
  incidentTypes = INCIDENT_TYPE_OPTIONS;
  triggerOptions = TRIGGER_OPTIONS;
  leadSourceOptions = ['fire', 'storm', 'hail', 'rotation'];
  channelOptions = ['sms', 'email', 'voice'];
  radiusOptions = [5, 10, 25, 50, 100];

  constructor(
    private fb: FormBuilder,
    private outreachService: OutreachService,
    private route: ActivatedRoute,
    private router: Router,
    private spinner: NgxSpinnerService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.formDirty && !this.navigatingAway) {
      event.preventDefault();
    }
  }

  canDeactivate(): Observable<boolean> | boolean {
    if (!this.formDirty || this.navigatingAway) return true;
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to leave?',
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
        color: 'warn',
      },
    });
    return dialogRef.afterClosed();
  }

  ngOnInit() {
    this.initForm();
    this.loadTemplates();

    this.campaignId = this.route.snapshot.paramMap.get('id');
    if (this.campaignId) {
      this.isEditMode = true;
      this.loadCampaign(this.campaignId);
    }

    // Track form dirty state
    this.campaignForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.formDirty = true;
    });
  }

  initForm() {
    this.campaignForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(200)]],
      description: ['', Validators.maxLength(500)],
      campaign_type: ['sms', Validators.required],
      contact_method: ['sms', Validators.required],
      template_id: ['', Validators.required],
      trigger_on: ['manual', Validators.required],
      delay_minutes: [0],
      max_attempts: [3],
      is_active: [true],
      // Targeting
      incident_type: [''],
      target_zip_code: [''],
      target_radius_miles: [25],
      lead_source: [''],
      territory_state: [''],
      // Steps
      steps: this.fb.array([]),
    });
  }

  get steps(): FormArray {
    return this.campaignForm.get('steps') as FormArray;
  }

  createStepGroup(step?: any): FormGroup {
    return this.fb.group({
      step_number: [step?.step_number || this.steps.length + 1],
      channel: [step?.channel || 'sms', Validators.required],
      template_id: [step?.template_id || '', Validators.required],
      delay_minutes: [step?.delay_minutes || 0],
      subject: [step?.subject || ''],
    });
  }

  addStep() {
    this.steps.push(this.createStepGroup());
  }

  removeStep(index: number) {
    this.steps.removeAt(index);
    // Re-number steps
    this.steps.controls.forEach((ctrl, i) => {
      ctrl.get('step_number')?.setValue(i + 1);
    });
  }

  getFilteredTemplates(channel?: string): OutreachTemplate[] {
    if (!channel) return this.templates;
    return this.templates.filter((t) => t.channel === channel);
  }

  loadTemplates() {
    this.outreachService.getTemplates().subscribe((data) => {
      this.templates = data;
    });
  }

  loadCampaign(id: string) {
    this.loadingCampaign = true;
    this.spinner.show();
    this.outreachService.getCampaigns().pipe(takeUntil(this.destroy$)).subscribe({
      next: (campaigns) => {
        const campaign = campaigns.find((c) => c.id === id);
        if (campaign) {
          this.campaignForm.patchValue({
            name: campaign.name,
            description: campaign.description,
            campaign_type: campaign.campaign_type,
            contact_method: campaign.contact_method,
            template_id: campaign.template_id,
            trigger_on: campaign.trigger_on,
            delay_minutes: campaign.delay_minutes,
            max_attempts: campaign.max_attempts,
            is_active: campaign.is_active,
            incident_type: campaign.incident_type || '',
            target_zip_code: campaign.target_zip_code || '',
            target_radius_miles: campaign.target_radius_miles || 25,
            lead_source: campaign.lead_source || '',
            territory_state: campaign.territory_state || '',
          });

          // Set selected template for preview
          if (campaign.template_id) {
            this.onTemplateSelect(campaign.template_id);
          }

          // Load steps
          if (campaign.steps && campaign.steps.length) {
            campaign.steps.forEach((s) => this.steps.push(this.createStepGroup(s)));
          }
        }
        this.loadingCampaign = false;
        this.spinner.hide();
        // Reset dirty flag after populating form from loaded data
        setTimeout(() => this.formDirty = false);
      },
      error: () => {
        this.loadingCampaign = false;
        this.spinner.hide();
        this.snackBar.open('Failed to load campaign', 'OK', { duration: 3000 });
      },
    });
  }

  onCampaignTypeChange(type: string) {
    // Sync contact_method for single-channel types
    if (type !== 'multi_step') {
      const methodMap: Record<string, string> = {
        ai_voice: 'voice',
        sms: 'sms',
        email: 'email',
      };
      this.campaignForm.get('contact_method')?.setValue(methodMap[type] || 'sms');
    }
  }

  onTemplateSelect(templateId: string) {
    this.selectedTemplate = this.templates.find((t) => t.id === templateId) || null;
  }

  previewLeads() {
    const form = this.campaignForm.value;
    this.spinner.show();
    this.outreachService.previewLeads({
      incident_type: form.incident_type || undefined,
      target_zip_code: form.target_zip_code || undefined,
      target_radius_miles: form.target_radius_miles || undefined,
      lead_source: form.lead_source || undefined,
      territory_state: form.territory_state || undefined,
    }).subscribe((result) => {
      this.previewResult = result;
      this.spinner.hide();
    }, () => this.spinner.hide());
  }

  getError(field: string): string {
    const control = this.campaignForm.get(field);
    if (!control || !control.touched || !control.errors) return '';
    if (control.errors['required']) return `${this.getFieldLabel(field)} is required`;
    if (control.errors['maxlength']) return `Maximum ${control.errors['maxlength'].requiredLength} characters`;
    return '';
  }

  private getFieldLabel(field: string): string {
    const labels: Record<string, string> = {
      name: 'Campaign name',
      template_id: 'Template',
      campaign_type: 'Campaign type',
      contact_method: 'Contact method',
      trigger_on: 'Trigger',
    };
    return labels[field] || field;
  }

  private buildPayload(): any {
    const formValue = { ...this.campaignForm.value };
    // Clean empty strings
    if (!formValue.incident_type) delete formValue.incident_type;
    if (!formValue.target_zip_code) delete formValue.target_zip_code;
    if (!formValue.lead_source) delete formValue.lead_source;
    if (!formValue.territory_state) delete formValue.territory_state;
    if (!formValue.description) delete formValue.description;
    return formValue;
  }

  private saveCampaign(): Observable<OutreachCampaign> {
    const payload = this.buildPayload();
    if (this.isEditMode && this.campaignId) {
      return this.outreachService.updateCampaign(this.campaignId, payload);
    }
    if (payload.steps && payload.steps.length > 0) {
      return this.outreachService.createCampaignWithSteps(payload);
    }
    return this.outreachService.createCampaign(payload);
  }

  saveDraft() {
    if (this.campaignForm.invalid) return;
    this.saving = true;
    this.navigatingAway = true;

    this.saveCampaign().pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.snackBar.open(
          this.isEditMode ? 'Campaign updated' : 'Campaign saved as draft',
          'OK', { duration: 3000 },
        );
        this.router.navigate(['/app/outreach/campaigns']);
      },
      error: () => {
        this.snackBar.open('Failed to save campaign', 'OK', { duration: 3000 });
        this.saving = false;
        this.navigatingAway = false;
      },
    });
  }

  saveAndLaunch() {
    if (this.campaignForm.invalid) return;
    this.launching = true;
    this.navigatingAway = true;

    this.saveCampaign().pipe(
      takeUntil(this.destroy$),
      switchMap((saved: OutreachCampaign) =>
        this.outreachService.launchCampaign(saved.id)
      ),
    ).subscribe({
      next: () => {
        this.snackBar.open('Campaign launched successfully!', 'OK', { duration: 4000 });
        this.router.navigate(['/app/outreach/campaigns']);
      },
      error: () => {
        this.snackBar.open('Failed to save and launch campaign', 'OK', { duration: 3000 });
        this.launching = false;
        this.navigatingAway = false;
      },
    });
  }

  cancel() {
    this.router.navigate(['/app/outreach/campaigns']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
