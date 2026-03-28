import { Component, Input, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { PolicyDocument } from 'src/app/models/policy-document.model';
import { PolicyDocumentService } from 'src/app/services/policy-document.service';
import { PolicyVaultAttachDialogComponent } from 'src/app/components/dialogs/policy-vault-attach-dialog/policy-vault-attach-dialog.component';

@Component({
  standalone: false,
  selector: 'app-policy-section-inline',
  templateUrl: './policy-section-inline.component.html',
  styleUrls: ['./policy-section-inline.component.scss'],
})
export class PolicySectionInlineComponent implements OnInit {
  @Input() entityType: string = ''; // 'claim' | 'adjuster_case' | 'fire_claim' | 'client' | 'lead'
  @Input() entityId: string = '';

  policies: PolicyDocument[] = [];
  loading = false;

  constructor(
    private policyService: PolicyDocumentService,
    private snackBar: MatSnackBar,
    private router: Router,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    if (this.entityId) {
      this.loadPolicies();
    }
  }

  loadPolicies(): void {
    if (!this.entityId || !this.entityType) return;
    this.loading = true;
    const entityIds: any = {};
    entityIds[this.entityType + '_id'] = this.entityId;
    this.policyService.getByEntity(entityIds).subscribe({
      next: (policies) => {
        this.policies = policies;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  onUploadFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const metadata: any = {};
    metadata[this.entityType + '_id'] = this.entityId;

    this.policyService.upload(file, metadata).subscribe({
      next: () => {
        this.snackBar.open('Policy uploaded & linked', 'Close', { duration: 2000 });
        input.value = '';
        this.loadPolicies();
      },
      error: () => {
        this.snackBar.open('Upload failed', 'Close', { duration: 3000 });
      },
    });
  }

  openAttachDialog(): void {
    const dialogRef = this.dialog.open(PolicyVaultAttachDialogComponent, {
      width: '700px',
      data: { entityType: this.entityType, entityId: this.entityId },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadPolicies();
      }
    });
  }

  viewDocument(doc: PolicyDocument): void {
    this.router.navigate(['/app/policy-vault', doc.id]);
  }

  detachDocument(doc: PolicyDocument): void {
    this.policyService.detach(doc.id, this.entityType + '_id').subscribe({
      next: () => {
        this.snackBar.open('Policy detached', 'Close', { duration: 2000 });
        this.loadPolicies();
      },
      error: () => {
        this.snackBar.open('Detach failed', 'Close', { duration: 3000 });
      },
    });
  }
}
