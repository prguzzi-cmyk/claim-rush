import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
    selector: 'app-registration',
    templateUrl: './registration.component.html',
    styleUrls: ['./registration.component.scss'],
    standalone: false
})
export class RegistrationComponent implements OnInit {
  credentials: any = {};
  hash: any = null;
  message: string;
  registrationDisabled: boolean = false;
  hashError: string = null;
  hashChecked: boolean = false;
  registered: boolean = false;
  passwordsMatch: boolean = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    // Get the hash
    this.hash = this.route.snapshot.params['hash'];

    // Check the hash
    this.checkHash();
  }

  checkHash() {
    this.authService.checkRegistrationHash(this.hash)
      .subscribe(
        response => {
          this.hashChecked = true;
          switch (response.status) {
            case 'ok':
              this.hashError = null;
              break;

            default:
              this.hashError = response.status;
              break;
          }
        },
        error => {
          this.hashChecked = true;
        }
      );
  }

  register() {
    this.registrationDisabled = true;

    if(this.credentials.password != this.credentials.passwordRepeat) {
      this.passwordsMatch = false;
      this.registrationDisabled = false;
      return;
    }
    else {
      this.passwordsMatch = true;
    }

    this.message = null;
    this.authService
      .register(this.hash, this.credentials.password)
      .subscribe(
        response => {
          this.registered = true;
        },
        error => {
          console.log(error);
          this.registrationDisabled = false;
        }
      );
  }
}
