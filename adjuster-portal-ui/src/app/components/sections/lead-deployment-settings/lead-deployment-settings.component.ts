import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LeadRoutingSettingsService } from '../../../services/lead-routing-settings.service';
import {
  LEAD_SOURCES,
  LeadRoutingSettings,
  ROUTING_MODES,
  RoutingMode,
} from '../../../models/lead-routing-settings.model';

@Component({
  selector: 'app-lead-deployment-settings',
  templateUrl: './lead-deployment-settings.component.html',
  styleUrls: ['./lead-deployment-settings.component.scss'],
  standalone: false,
})
export class LeadDeploymentSettingsComponent implements OnInit {
  rows: LeadRoutingSettings[] = [];
  loading = false;
  saving = false;

  readonly leadSources = LEAD_SOURCES;
  readonly routingModes: RoutingMode[] = ROUTING_MODES;

  form: FormGroup;

  constructor(
    private svc: LeadRoutingSettingsService,
    private fb: FormBuilder,
    private snack: MatSnackBar,
  ) {
    this.form = this.fb.group({
      lead_source: ['all', Validators.required],
      routing_mode: ['hybrid' as RoutingMode, Validators.required],
      fallback_owner_id: [''],
      fallback_queue: ['house', Validators.required],
      is_active: [true],
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.svc.list().subscribe({
      next: (rows) => {
        this.rows = rows.sort((a, b) => a.lead_source.localeCompare(b.lead_source));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.snack.open('Failed to load routing settings', 'Dismiss', { duration: 3000 });
      },
    });
  }

  edit(row: LeadRoutingSettings): void {
    this.form.patchValue({
      lead_source: row.lead_source,
      routing_mode: row.routing_mode,
      fallback_owner_id: row.fallback_owner_id ?? '',
      fallback_queue: row.fallback_queue,
      is_active: row.is_active,
    });
  }

  reset(): void {
    this.form.reset({
      lead_source: 'all',
      routing_mode: 'hybrid',
      fallback_owner_id: '',
      fallback_queue: 'house',
      is_active: true,
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    const leadSource: string = v.lead_source.trim();
    const body = {
      lead_source: leadSource,
      routing_mode: v.routing_mode as RoutingMode,
      fallback_owner_id: v.fallback_owner_id ? v.fallback_owner_id.trim() : null,
      fallback_queue: v.fallback_queue || 'house',
      is_active: !!v.is_active,
    };

    this.saving = true;
    this.svc.upsert(leadSource, body).subscribe({
      next: () => {
        this.saving = false;
        this.snack.open(`Saved routing settings for '${leadSource}'`, 'OK', { duration: 2500 });
        this.load();
      },
      error: (err) => {
        this.saving = false;
        const msg = err?.error?.detail || 'Failed to save routing settings';
        this.snack.open(msg, 'Dismiss', { duration: 4000 });
      },
    });
  }

  deactivate(row: LeadRoutingSettings): void {
    if (row.lead_source === 'all') {
      this.snack.open("Cannot deactivate the global 'all' row.", 'OK', { duration: 3000 });
      return;
    }
    if (!confirm(`Deactivate routing for '${row.lead_source}'?`)) return;
    this.svc.deactivate(row.lead_source).subscribe({
      next: () => {
        this.snack.open('Deactivated.', 'OK', { duration: 2000 });
        this.load();
      },
      error: () => this.snack.open('Failed to deactivate', 'Dismiss', { duration: 3000 }),
    });
  }
}
