import { Component, Inject } from "@angular/core";
import { FormGroup, FormControl, Validators } from "@angular/forms";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";

export interface LineItemDialogData {
  type: "add" | "edit";
  category: string;
  categoryLabel: string;
  item?: {
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  };
}

@Component({
  selector: "app-line-item-dialog",
  templateUrl: "./line-item-dialog.component.html",
  styleUrls: ["./line-item-dialog.component.scss"],
  standalone: false,
})
export class LineItemDialogComponent {
  title: string;
  unitOptions = ["SF", "LF", "SY", "EA", "HR", "CF", "GAL"];

  lineItemForm = new FormGroup({
    description: new FormControl("", [Validators.required]),
    quantity: new FormControl(1, [Validators.required, Validators.min(0.01)]),
    unit: new FormControl("SF", [Validators.required]),
    unitPrice: new FormControl(0, [Validators.required, Validators.min(0)]),
  });

  constructor(
    private dialogRef: MatDialogRef<LineItemDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: LineItemDialogData
  ) {
    this.title =
      data.type === "edit"
        ? `Edit Line Item \u2014 ${data.categoryLabel}`
        : `Add Line Item \u2014 ${data.categoryLabel}`;

    if (data.item) {
      this.lineItemForm.patchValue({
        description: data.item.description,
        quantity: data.item.quantity,
        unit: data.item.unit,
        unitPrice: data.item.unitPrice,
      });
    }
  }

  getTotal(): number {
    const qty = this.lineItemForm.get("quantity")?.value || 0;
    const price = this.lineItemForm.get("unitPrice")?.value || 0;
    return qty * price;
  }

  submit() {
    if (this.lineItemForm.invalid) return;
    this.dialogRef.close(this.lineItemForm.value);
  }

  cancel() {
    this.dialogRef.close(null);
  }
}
