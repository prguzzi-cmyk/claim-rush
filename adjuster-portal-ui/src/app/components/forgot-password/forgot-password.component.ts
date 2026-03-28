import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserService } from 'src/app/services/user.service';
import { ActivatedRoute } from '@angular/router';


@Component({
    selector: 'app-forgot-password',
    templateUrl: './forgot-password.component.html',
    styleUrls: ['./forgot-password.component.scss'],
    standalone: false
})
export class ForgotPasswordComponent implements OnInit {

  changePasswordDisabled: boolean = false;
  token: string;


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
    newPassword: new FormControl('', [
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
    private snackBar: MatSnackBar,
    private route: ActivatedRoute
  ) {



   }

   ngOnInit() {
    this.route.queryParams
      .subscribe(params => {
        this.token = params.token;
      }
    );
  }


   changePassword() {
    this.changePasswordDisabled = true;

    this.userService.resetPassword(
      this.passwordForm.controls['newPassword'].value,
      this.token
    )
    .subscribe(() => {
      this.changePasswordDisabled = false;

      this.snackBar.open('Password successfully changed', 'Close', {
        duration: 5000,
        horizontalPosition: 'end',
        verticalPosition: 'bottom',
      });
    },
    error => {
      this.changePasswordDisabled = false;

      // Handle incorrect password
      if(error.error.message == 'incorrect password') {
        this.passwordForm.controls['currentPassword'].setErrors({ IncorrectPassword: true });
      }
    });
  }





}
