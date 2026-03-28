import { Component } from "@angular/core";
import { FormGroup, FormControl, Validators } from "@angular/forms";
import { MatDialogRef } from "@angular/material/dialog";

@Component({
  selector: "app-carrier-paste-dialog",
  templateUrl: "./carrier-paste-dialog.component.html",
  styleUrls: ["./carrier-paste-dialog.component.scss"],
  standalone: false,
})
export class CarrierPasteDialogComponent {
  pasteForm = new FormGroup({
    carrier_name: new FormControl("", [Validators.required]),
    pasted_text: new FormControl("", [Validators.required, Validators.minLength(20)]),
  });

  constructor(private dialogRef: MatDialogRef<CarrierPasteDialogComponent>) {}

  submit() {
    if (this.pasteForm.invalid) return;
    this.dialogRef.close(this.pasteForm.value);
  }

  cancel() {
    this.dialogRef.close(null);
  }
}
