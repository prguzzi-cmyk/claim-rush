import { AuthService } from "src/app/services/auth.service";
import { Component, OnInit } from "@angular/core";
import { FormGroup, FormControl, Validators } from "@angular/forms";
import { MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";

@Component({
    selector: "app-forgotten-password-dialog",
    templateUrl: "./forgotten-password-dialog.component.html",
    styleUrls: ["./forgotten-password-dialog.component.scss"],
    standalone: false
})
export class ForgottenPasswordDialogComponent implements OnInit {
  resetPasswordDisabled: boolean = false;

  passwordResetForm = new FormGroup({
    email: new FormControl("", [Validators.required]),
  });

  constructor(
    private authService: AuthService,
    private dialogRef: MatDialogRef<ForgottenPasswordDialogComponent>,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {}

  requestPasswordReset() {
    this.resetPasswordDisabled = true;

    this.authService
      .requestPasswordReset(this.passwordResetForm.controls["email"].value)
      .subscribe(
        () => {
          this.resetPasswordDisabled = false;
          this.dialogRef.close();

          this.snackBar.open(
            "Password reset email sent. Check your inbox.",
            "Close",
            {
              duration: 10000,
              horizontalPosition: "end",
              verticalPosition: "bottom",
            }
          );
        },
        (error) => {
          this.resetPasswordDisabled = false;
        }
      );
  }
}
