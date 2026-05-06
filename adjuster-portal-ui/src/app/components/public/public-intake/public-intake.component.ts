import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface IntakePublicResponse {
  slug: string;
  intake_name: string;
  is_active: boolean;
  owner_user_id: string | null;
  owner_name: string | null;
  owner_role: string | null;
  territory_state: string | null;
  territory_county: string | null;
  territory_label: string | null;
  form_url: string;
}

const DAMAGE_TYPES = ['Fire', 'Water', 'Storm', 'Other'] as const;

@Component({
  selector: 'app-public-intake',
  templateUrl: './public-intake.component.html',
  styleUrls: ['./public-intake.component.scss'],
  standalone: false,
})
export class PublicIntakeComponent implements OnInit {
  readonly damageTypes = DAMAGE_TYPES;

  slug = '';
  loading = true;
  notFound = false;
  submitted = false;
  submitting = false;
  submitError: string | null = null;
  submissionRefNumber: number | null = null;

  intake: IntakePublicResponse | null = null;
  form: FormGroup;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private fb: FormBuilder,
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9 ()+\-]{10,}$/)]],
      address: ['', [Validators.required, Validators.minLength(4)]],
      damage_type: ['', Validators.required],
      notes: [''],
    });
  }

  ngOnInit(): void {
    this.slug = this.route.snapshot.paramMap.get('slug') || '';
    if (!this.slug) {
      this.loading = false;
      this.notFound = true;
      return;
    }
    this.http.get<IntakePublicResponse>(`intake/${this.slug}`).subscribe({
      next: (resp) => {
        this.intake = resp;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.notFound = true;
      },
    });
  }

  // Friendly subtext: "Serving {state} homeowners" when we have a state on
  // the intake; otherwise hide so the layout doesn't show "Serving null
  // homeowners".
  get subtext(): string | null {
    const state = this.intake?.territory_state;
    if (state) return `Serving ${state} homeowners.`;
    return null;
  }

  get ownerHeader(): string {
    if (!this.intake) return '';
    const name = this.intake.owner_name || 'your local representative';
    const role = (this.intake.owner_role || '').toLowerCase();
    if (role === 'cp') return `Community Partner: ${name}`;
    if (role === 'rvp') return `Regional VP: ${name}`;
    if (role === 'agent' || role === 'adjuster') return `Adjuster: ${name}`;
    return name;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitError = null;
    this.submitting = true;
    const payload = {
      intake_slug: this.slug,
      name: this.form.value.name,
      phone: this.form.value.phone,
      address: this.form.value.address,
      damage_type: this.form.value.damage_type,
      notes: this.form.value.notes || null,
    };
    this.http.post<{ ref_number: number; status: string }>('leads/intake', payload).subscribe({
      next: (resp) => {
        this.submitting = false;
        this.submissionRefNumber = resp?.ref_number ?? null;
        this.submitted = true;
      },
      error: (err) => {
        this.submitting = false;
        const detail = err?.error?.detail;
        if (typeof detail === 'string') {
          this.submitError = detail;
        } else {
          this.submitError = 'Could not submit your request. Please try again.';
        }
      },
    });
  }

  resetForm(): void {
    this.submitted = false;
    this.submissionRefNumber = null;
    this.submitError = null;
    this.form.reset({ name: '', phone: '', address: '', damage_type: '', notes: '' });
  }
}
