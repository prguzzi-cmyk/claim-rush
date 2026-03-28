import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { HttpEventType } from "@angular/common/http";
import { EstimatingService } from "../../../../services/estimating.service";
import { PricingVersion } from "../../../../models/estimating.model";

@Component({
  selector: "app-pricing-import-dialog",
  templateUrl: "./pricing-import-dialog.component.html",
  styleUrls: ["./pricing-import-dialog.component.scss"],
  standalone: false,
})
export class PricingImportDialogComponent {
  version: PricingVersion;
  selectedFile: File | null = null;
  previewRows: any[] = [];
  importing = false;
  uploadProgress = 0;
  importResult: { imported: number; errors: string[]; total_rows: number } | null = null;

  constructor(
    private dialogRef: MatDialogRef<PricingImportDialogComponent>,
    private estimatingService: EstimatingService,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.version = data.version;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.selectedFile = input.files[0];
    this.importResult = null;
    this.previewFile();
  }

  previewFile(): void {
    if (!this.selectedFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) {
        this.previewRows = [];
        return;
      }

      const headers = lines[0].split(",").map((h) => h.trim());
      this.previewRows = [];
      for (let i = 1; i < Math.min(lines.length, 11); i++) {
        const values = lines[i].split(",").map((v) => v.trim());
        const row: any = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || "";
        });
        this.previewRows.push(row);
      }
    };
    reader.readAsText(this.selectedFile);
  }

  get previewColumns(): string[] {
    if (this.previewRows.length === 0) return [];
    return Object.keys(this.previewRows[0]);
  }

  doImport(): void {
    if (!this.selectedFile || !this.version.id) return;
    this.importing = true;
    this.uploadProgress = 0;

    this.estimatingService
      .importPricingItems(this.version.id, this.selectedFile)
      .subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            this.uploadProgress = Math.round(
              (100 * event.loaded) / event.total
            );
          } else if (event.type === HttpEventType.Response) {
            this.importResult = event.body;
            this.importing = false;
            if (this.importResult && this.importResult.imported > 0) {
              this.snackBar.open(
                `Imported ${this.importResult.imported} items`,
                "Close",
                { duration: 3000 }
              );
            }
          }
        },
        error: () => {
          this.importing = false;
          this.snackBar.open("Import failed", "Close", { duration: 3000 });
        },
      });
  }

  close(): void {
    this.dialogRef.close(!!this.importResult?.imported);
  }
}
