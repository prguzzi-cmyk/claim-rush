import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { PolicyDocument } from 'src/app/models/policy-document.model';
import { PolicyDocumentService } from 'src/app/services/policy-document.service';

@Component({
  standalone: false,
  selector: 'app-policy-vault-attach-dialog',
  templateUrl: './policy-vault-attach-dialog.component.html',
  styleUrls: ['./policy-vault-attach-dialog.component.scss'],
})
export class PolicyVaultAttachDialogComponent implements OnInit {
  searchCarrier = '';
  searchPolicyNumber = '';
  searchInsuredName = '';
  displayedColumns = ['file_name', 'carrier', 'policy_number', 'insured_name', 'actions'];
  dataSource = new MatTableDataSource<PolicyDocument>([]);
  loading = false;

  constructor(
    private policyService: PolicyDocumentService,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<PolicyVaultAttachDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { entityType: string; entityId: string },
  ) {}

  ngOnInit(): void {
    this.search();
  }

  search(): void {
    this.loading = true;
    const filters: any = {};
    if (this.searchCarrier) filters.carrier = this.searchCarrier;
    if (this.searchPolicyNumber) filters.policy_number = this.searchPolicyNumber;
    if (this.searchInsuredName) filters.insured_name = this.searchInsuredName;

    this.policyService.list(1, 25, filters).subscribe({
      next: (res: any) => {
        this.dataSource.data = res?.items || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  selectPolicy(doc: PolicyDocument): void {
    const entityIds: any = {};
    entityIds[this.data.entityType + '_id'] = this.data.entityId;
    this.policyService.attach(doc.id, entityIds).subscribe({
      next: () => {
        this.snackBar.open('Policy attached', 'Close', { duration: 2000 });
        this.dialogRef.close(true);
      },
      error: () => {
        this.snackBar.open('Attach failed', 'Close', { duration: 3000 });
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
