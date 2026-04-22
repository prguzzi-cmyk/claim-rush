import { Component, OnInit } from '@angular/core';
import { Observable, of, switchMap, catchError } from 'rxjs';

import {
  AdminMembersDataService,
} from 'src/app/services/admin-members-data.service';
import { UserService } from 'src/app/services/user.service';

interface MemberStatusView {
  user_id: string;
  status: 'pending_charter' | 'pending_w9' | 'active' | string;
  full_name: string;
  w9_uploaded: boolean;
}

// dev_user → Alice (matches CommissionEngineDataService alias).
const DEV_USER_ID = 'dev_user';
const DEV_ALIAS_UUID = 'a88fe7c8-1982-5856-aa70-5efe96ece7c7';
function resolveUserId(uid: string): string {
  return uid === DEV_USER_ID ? DEV_ALIAS_UUID : uid;
}

/**
 * Site-wide onboarding banner. Renders only when the current user's
 * status is 'pending_w9' — i.e. they've signed the charter (R1) but
 * haven't uploaded a W-9 yet. Dismissible; flag persists in the DB
 * (banner re-appears on refresh until W-9 is uploaded or admin marks
 * it received).
 *
 * Hidden for status='active' (the steady state) and for
 * status='pending_charter' (those users don't have portal access yet).
 */
@Component({
  selector: 'app-onboarding-banner',
  templateUrl: './onboarding-banner.component.html',
  styleUrls: ['./onboarding-banner.component.scss'],
  standalone: false,
})
export class OnboardingBannerComponent implements OnInit {
  status$!: Observable<MemberStatusView | null>;
  dismissedThisSession = false;

  constructor(
    private readonly userService: UserService,
    private readonly adminMembers: AdminMembersDataService,
  ) {}

  ngOnInit(): void {
    this.status$ = this.userService.currentUser.pipe(
      switchMap(user => {
        if (!user || !(user as any).id) return of(null);
        const uid = resolveUserId(String((user as any).id));
        return this.adminMembers.getMemberStatus$(uid).pipe(
          catchError(() => of(null)),
        );
      }),
    );
  }

  dismiss(): void { this.dismissedThisSession = true; }
}
