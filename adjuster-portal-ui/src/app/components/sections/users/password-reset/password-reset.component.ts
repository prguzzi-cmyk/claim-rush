import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
    selector: 'app-password-reset',
    templateUrl: './password-reset.component.html',
    styleUrls: ['./password-reset.component.scss'],
    standalone: false
})
export class PasswordResetComponent implements OnInit {
  credentials: any = {};
  token: any = null;
  message: string;
  resetDisabled: boolean = false;
  tokenError: string = null;
  tokenChecked: boolean = false;
  reset: boolean = false;
  passwordsMatch: boolean = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    // Get the token
    this.token = this.route.snapshot.params['token'];

    // Check the token
    this.checkToken();
  }

  checkToken() {
    this.authService.checkPasswordResetToken(this.token)
      .subscribe(
        response => {
          this.tokenChecked = true;
          switch (response.status) {
            case 'ok':
              this.tokenError = null;
              break;

            default:
              this.tokenError = response.status;
              break;
          }
        },
        error => {
          this.tokenChecked = true;
        }
      );
  }

  register() {
    this.resetDisabled = true;

    if(this.credentials.password != this.credentials.passwordRepeat) {
      this.passwordsMatch = false;
      this.resetDisabled = false;
      return;
    }
    else {
      this.passwordsMatch = true;
    }

    this.message = null;
    this.authService
      .resetPassword(this.token, this.credentials.password)
      .subscribe(
        response => {
          this.reset = true;
        },
        error => {
          console.log(error);
          this.resetDisabled = false;
        }
      );
  }
}
