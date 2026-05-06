import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators, ValidatorFn, ValidationErrors } from '@angular/forms';
import { UserService } from 'src/app/services/user.service';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
    selector: 'app-password-change-dialog',
    templateUrl: './password-change-dialog.component.html',
    styleUrls: ['./password-change-dialog.component.scss'],
    standalone: false
})
export class PasswordChangeDialogComponent implements OnInit {

  changePasswordDisabled: boolean = false;

  matchingPasswordValidation: ValidatorFn = (control: FormControl): ValidationErrors | null => {
    let newPassword = control.get('newPassword').value;
    let repeatNewPassword = control.get('repeatNewPassword').value;

    if (newPassword != repeatNewPassword) {
      control.get('repeatNewPassword').setErrors({ PasswordsNotMatching: true });
    } else {
      return null
    }
  };

  passwordForm = new FormGroup({
    currentPassword:    new FormControl('', [
      Validators.required,
    ]),
    newPassword:        new FormControl('', [
      Validators.required,
      Validators.minLength(8)
    ]),
    repeatNewPassword:  new FormControl('', [
      Validators.required,
      Validators.minLength(8)
    ]),
  }, { validators: this.matchingPasswordValidation });

  constructor(
    private userService: UserService,
    private dialogRef: MatDialogRef<PasswordChangeDialogComponent>,
    private snackBar: MatSnackBar,
  ) { }

  ngOnInit() {
  }

  changePassword() {
    this.changePasswordDisabled = true;

    this.userService.changePassword(
      this.passwordForm.controls['newPassword'].value,
      this.passwordForm.controls['currentPassword'].value,
    )
    .subscribe(() => {
      this.changePasswordDisabled = false;
      this.dialogRef.close();

      this.snackBar.open('Password successfully changed', 'Close', {
        duration: 5000,
        horizontalPosition: 'end',
        verticalPosition: 'bottom',
      });
    },
    error => {
      this.changePasswordDisabled = false;

      // Backend returns 400 with detail "current_password is incorrect." or
      // "current_password is required to change password." — surface the
      // current-password error inline so the user sees which field failed.
      const detail: string = error?.error?.detail || error?.error?.message || '';
      if (detail.toLowerCase().includes('current_password')) {
        this.passwordForm.controls['currentPassword'].setErrors({ IncorrectPassword: true });
      }
    });
  }


}
