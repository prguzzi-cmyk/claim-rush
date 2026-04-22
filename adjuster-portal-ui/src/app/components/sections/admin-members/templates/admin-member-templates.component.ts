import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, Observable, switchMap } from 'rxjs';

import {
  AdminMembersDataService,
  TemplateRowDTO,
} from 'src/app/services/admin-members-data.service';

/**
 * Admin > Members > Templates
 *
 * Three role-specific charter templates seeded by R2's migration.
 * Each row shows the current state (DRAFT body or uploaded PDF) and
 * accepts a PDF upload that becomes the new active template for the
 * role — future invites pick it up automatically.
 */
@Component({
  selector: 'app-admin-member-templates',
  templateUrl: './admin-member-templates.component.html',
  styleUrls: ['./admin-member-templates.component.scss'],
  standalone: false,
})
export class AdminMemberTemplatesComponent implements OnInit {
  templates$!: Observable<TemplateRowDTO[]>;
  private refresh$ = new BehaviorSubject<void>(undefined);
  uploading = new Set<string>();

  constructor(
    private readonly data: AdminMembersDataService,
    private readonly snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.templates$ = this.refresh$.pipe(
      switchMap(() => this.data.listTemplates$()),
    );
  }

  onFileSelected(template: TemplateRowDTO, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      this.snack.open('Please select a PDF file.', 'OK', { duration: 4000 });
      input.value = '';
      return;
    }
    this.uploading.add(template.id);
    this.data.uploadTemplatePdf$(template.id, file).subscribe({
      next: updated => {
        this.uploading.delete(template.id);
        this.snack.open(
          `Uploaded ${file.name} as the active ${updated.role.toUpperCase()} template.`,
          'Dismiss',
          { duration: 4000 },
        );
        this.refresh$.next();
        input.value = '';
      },
      error: err => {
        this.uploading.delete(template.id);
        this.snack.open(
          `Upload failed: ${err?.error?.detail || err?.message}`,
          'OK',
          { duration: 5000 },
        );
        input.value = '';
      },
    });
  }

  isUploading(template: TemplateRowDTO): boolean {
    return this.uploading.has(template.id);
  }

  isDraftBody(t: TemplateRowDTO): boolean {
    return !t.pdf_url && t.body.startsWith('DRAFT TEMPLATE');
  }
}
