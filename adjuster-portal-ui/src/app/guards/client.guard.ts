import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { MyClaimService } from '../components/my-claim/my-claim.service';

@Injectable({ providedIn: 'root' })
export class ClientGuard implements CanActivate {
  constructor(private claimService: MyClaimService, private router: Router) {}

  canActivate(): boolean {
    if (this.claimService.isLoggedIn()) return true;
    this.router.navigate(['/client/login']);
    return false;
  }
}
