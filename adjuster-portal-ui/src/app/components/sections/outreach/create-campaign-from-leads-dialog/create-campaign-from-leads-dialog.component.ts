import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { SelectionModel } from '@angular/cdk/collections';

import { LeadService } from 'src/app/services/leads.service';
import { OutreachService } from 'src/app/services/outreach.service';

interface LeadRow {
  id: string;
  name: string;
  phone: string;
  status: string;
  peril: string;
  created_at: string;
}

@Component({
  selector: 'app-create-campaign-from-leads-dialog',
  templateUrl: './create-campaign-from-leads-dialog.component.html',
  styleUrls: ['./create-campaign-from-leads-dialog.component.scss'],
  standalone: false,
})
export class CreateCampaignFromLeadsDialogComponent implements OnInit {
  form!: FormGroup;
  isLoading = false;
  isSubmitting = false;
  totalLeads = 0;

  pageIndex = 1;
  pageSize = 25;

  displayedColumns = ['select', 'name', 'phone', 'status', 'peril', 'created_at'];
  dataSource = new MatTableDataSource<LeadRow>([]);
  selection = new SelectionModel<string>(true, []);

  constructor(
    private dialogRef: MatDialogRef<CreateCampaignFromLeadsDialogComponent>,
    private fb: FormBuilder,
    private leadService: LeadService,
    private outreachService: OutreachService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      contact_method: ['sms', Validators.required],
      description: [''],
    });
    this.loadLeads();
  }

  loadLeads(): void {
    this.isLoading = true;
    this.leadService.getLeads(this.pageIndex, this.pageSize, {}).subscribe({
      next: (res: any) => {
        const items: any[] = res?.items || res?.data || res || [];
        this.totalLeads = res?.total ?? items.length;
        this.dataSource.data = items.map((lead) => ({
          id: lead.id,
          name: lead.contact?.full_name || '—',
          phone: lead.contact?.phone_number || '',
          status: lead.status || '',
          peril: lead.peril || '',
          created_at: lead.created_at || '',
        }));
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load leads.', 'Close', { duration: 4000 });
      },
    });
  }

  isAllSelectedOnPage(): boolean {
    return this.dataSource.data.length > 0 &&
           this.dataSource.data.every((r) => this.selection.isSelected(r.id));
  }

  toggleAllOnPage(): void {
    if (this.isAllSelectedOnPage()) {
      this.dataSource.data.forEach((r) => this.selection.deselect(r.id));
    } else {
      this.dataSource.data.forEach((r) => this.selection.select(r.id));
    }
  }

  onPageChange(event: any): void {
    this.pageIndex = (event.pageIndex || 0) + 1;
    this.pageSize = event.pageSize || 25;
    this.loadLeads();
  }

  onSubmit(): void {
    if (this.form.invalid || this.selection.isEmpty()) return;
    this.isSubmitting = true;

    const v = this.form.value;
    const payload = {
      name: v.name,
      contact_method: v.contact_method,
      description: v.description || undefined,
      campaign_type: v.contact_method,
      lead_ids: this.selection.selected,
    };

    this.outreachService.createCampaignFromLeads(payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        const skipped = res.skipped_lead_ids?.length || 0;
        const msg = skipped > 0
          ? `Campaign created with ${res.lead_count} leads (${skipped} skipped).`
          : `Campaign created with ${res.lead_count} leads.`;
        this.snackBar.open(msg, 'Close', { duration: 4000 });
        this.dialogRef.close({ created: true, campaign: res.campaign, lead_count: res.lead_count });
      },
      error: (err) => {
        this.isSubmitting = false;
        const detail = err?.error?.detail || 'Failed to create campaign.';
        this.snackBar.open(detail, 'Close', { duration: 5000 });
      },
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
