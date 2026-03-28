import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgxSpinnerService } from 'ngx-spinner';
import { forkJoin } from 'rxjs';
import {
  ORIGIN_AREAS,
  SMOKE_LEVELS,
} from '../../../../models/fire-claim.model';
import { FireClaimService } from '../../../../services/fire-claim.service';

interface PendingFile {
  file: File;
  mediaType: string;
  caption: string;
  preview?: string;
}

@Component({
  standalone: false,
  selector: 'app-fire-claim-form',
  templateUrl: './fire-claim-form.component.html',
  styleUrls: ['./fire-claim-form.component.scss'],
})
export class FireClaimFormComponent implements OnInit {
  form!: FormGroup;
  originAreas = ORIGIN_AREAS;
  smokeLevels = SMOKE_LEVELS;
  pendingFiles: PendingFile[] = [];
  submitting = false;

  constructor(
    private fb: FormBuilder,
    private fireClaimService: FireClaimService,
    private router: Router,
    private snackBar: MatSnackBar,
    private spinner: NgxSpinnerService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      claim_number: [''],
      loss_date: [null, Validators.required],
      address_line1: ['', Validators.required],
      address_line2: [''],
      city: ['', Validators.required],
      state: ['', [Validators.required, Validators.maxLength(2)]],
      zip: ['', Validators.required],
      insured_name: ['', Validators.required],
      insured_phone: ['', Validators.required],
      insured_email: ['', [Validators.required, Validators.email]],
      carrier_name: [''],
      policy_number: [''],
      origin_area: ['', Validators.required],
      origin_area_other: [''],
      rooms_affected: ['', Validators.required],
      smoke_level: ['', Validators.required],
      water_from_suppression: [false],
      roof_opened_by_firefighters: [false],
      power_shut_off: [false],
      notes: [''],
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      const isVideo = file.type.startsWith('video/');
      const pending: PendingFile = {
        file,
        mediaType: isVideo ? 'video' : 'photo',
        caption: '',
      };

      if (!isVideo) {
        const reader = new FileReader();
        reader.onload = (e) => {
          pending.preview = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      }

      this.pendingFiles.push(pending);
    }

    input.value = '';
  }

  removePendingFile(index: number): void {
    this.pendingFiles.splice(index, 1);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!event.dataTransfer?.files) return;

    for (let i = 0; i < event.dataTransfer.files.length; i++) {
      const file = event.dataTransfer.files[i];
      const isVideo = file.type.startsWith('video/');
      const pending: PendingFile = {
        file,
        mediaType: isVideo ? 'video' : 'photo',
        caption: '',
      };

      if (!isVideo) {
        const reader = new FileReader();
        reader.onload = (e) => {
          pending.preview = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      }

      this.pendingFiles.push(pending);
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.spinner.show();

    const formValue = { ...this.form.value };

    // Format date as YYYY-MM-DD string
    if (formValue.loss_date) {
      const d = new Date(formValue.loss_date);
      formValue.loss_date = d.toISOString().split('T')[0];
    }

    this.fireClaimService.create(formValue).subscribe({
      next: (claim) => {
        if (this.pendingFiles.length > 0) {
          const uploads = this.pendingFiles.map((pf) =>
            this.fireClaimService.uploadMedia(
              claim.id!,
              pf.file,
              pf.mediaType,
              pf.caption
            )
          );
          forkJoin(uploads).subscribe({
            next: () => {
              this.spinner.hide();
              this.submitting = false;
              this.snackBar.open('Fire claim created successfully', 'Close', {
                duration: 3000,
              });
              this.router.navigate(['/app/fire-claims', claim.id]);
            },
            error: () => {
              this.spinner.hide();
              this.submitting = false;
              this.snackBar.open(
                'Claim created but some files failed to upload',
                'Close',
                { duration: 5000 }
              );
              this.router.navigate(['/app/fire-claims', claim.id]);
            },
          });
        } else {
          this.spinner.hide();
          this.submitting = false;
          this.snackBar.open('Fire claim created successfully', 'Close', {
            duration: 3000,
          });
          this.router.navigate(['/app/fire-claims', claim.id]);
        }
      },
      error: () => {
        this.spinner.hide();
        this.submitting = false;
        this.snackBar.open('Failed to create fire claim', 'Close', {
          duration: 3000,
        });
      },
    });
  }
}
