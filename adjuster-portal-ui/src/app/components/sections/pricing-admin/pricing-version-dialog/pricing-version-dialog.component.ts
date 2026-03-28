import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { EstimatingService } from "../../../../services/estimating.service";

@Component({
  selector: "app-pricing-version-dialog",
  templateUrl: "./pricing-version-dialog.component.html",
  styleUrls: ["./pricing-version-dialog.component.scss"],
  standalone: false,
})
export class PricingVersionDialogComponent {
  form = new FormGroup({
    source: new FormControl("craftsman", [Validators.required]),
    version_label: new FormControl("", [Validators.required]),
    effective_date: new FormControl("", [Validators.required]),
    region: new FormControl("national", [Validators.required]),
    notes: new FormControl(""),
  });

  saving = false;

  constructor(
    private dialogRef: MatDialogRef<PricingVersionDialogComponent>,
    private estimatingService: EstimatingService,
    private snackBar: MatSnackBar
  ) {}

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;

    const data = this.form.value as any;
    this.estimatingService.createPricingVersion(data).subscribe({
      next: () => {
        this.snackBar.open("Version created", "Close", { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: () => {
        this.saving = false;
        this.snackBar.open("Failed to create version", "Close", {
          duration: 3000,
        });
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
