import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MyClaimService, ClientProfile } from '../my-claim.service';

@Component({
  selector: 'app-my-claim-shell',
  templateUrl: './my-claim-shell.component.html',
  styleUrls: ['./my-claim-shell.component.scss'],
  standalone: false,
})
export class MyClaimShellComponent implements OnInit, OnDestroy {
  profile: ClientProfile | null = null;
  menuOpen = false;
  notifCount = 0;
  private subs: Subscription[] = [];

  constructor(private claimService: MyClaimService, private router: Router) {}

  ngOnInit(): void {
    this.subs.push(
      this.claimService.getProfile().subscribe(p => this.profile = p),
      this.claimService.getNotifications().subscribe(n => this.notifCount = n.filter(x => !x.read).length),
    );
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }

  logout(): void {
    this.claimService.clientLogout();
    this.router.navigate(['/client/login']);
  }

  get initials(): string {
    if (!this.profile) return '';
    return (this.profile.firstName[0] + this.profile.lastName[0]).toUpperCase();
  }
}
