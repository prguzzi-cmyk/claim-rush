import { Injectable } from '@angular/core';
import { UserService } from './user.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ImpersonationService {
  impersonating: boolean = false;
  public impersonatingObservable = new Subject<boolean>();

  constructor(
    private http: HttpClient,
    private router: Router,
    private userService: UserService,
  ) { }

  emitImpersonating(val) {
    this.impersonatingObservable.next(val);
  }

  isImpersonating() {
    this.emitImpersonating(localStorage.getItem('original_access_token') ? true : false);
  }

  /**
   * Impersonate an user
   * @param user The user to impersonate
   */
  impersonate(user) {
    // Get the users authentication token
    return this.http.post<any>('auth/impersonate', { user_id: user.id })
      .pipe(
        map(token => {
          // Set status as impersonating
          this.emitImpersonating(true);

          localStorage.setItem('original_access_token', localStorage.getItem('access_token'));
          localStorage.setItem('access_token', JSON.stringify(token.impersonation_token));

          // Load the impersonated user data
          this.userService.getUser()
            .subscribe(() => {
              // Navigate to dashboard
              this.router.navigate(['/app/dashboard']);
            });
        })
      );
  }

  /**
   * Stop impersonating the user
   */
  stopImpersonating() {
    localStorage.setItem('access_token', localStorage.getItem('original_access_token'));
    localStorage.removeItem('original_access_token');

    this.emitImpersonating(false);

    // Load the original user data
    this.userService.getUser()
    .subscribe(() => {
      // Navigate to dashboard
      this.router.navigate(['/app/administration/users']);
    });
  }
}
