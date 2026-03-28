import { Component, OnInit, OnDestroy, ViewChild, isDevMode } from '@angular/core';
import { MatTabGroup } from '@angular/material/tabs';
import { Subscription } from 'rxjs';
import { CommunityAdvocateService } from 'src/app/services/community-advocate.service';
import {
  AdvocacyKpiSummary, AdvocateProfile, CaRole,
  ROLE_TO_CA_ROLE, CA_ROLE_TITLES, CA_ROLE_SUBTITLES
} from 'src/app/models/community-advocate.model';

@Component({
  selector: 'app-community-advocate',
  templateUrl: './community-advocate.component.html',
  styleUrls: ['./community-advocate.component.scss'],
  standalone: false,
})
export class CommunityAdvocateComponent implements OnInit, OnDestroy {
  @ViewChild('tabGroup') tabGroup: MatTabGroup;

  selectedTabIndex = 0;
  kpiSummary: AdvocacyKpiSummary;
  loading = true;

  // Role-based
  caRole: CaRole = 'admin';
  pageTitle = 'Community Advocate';
  pageSubtitle = '';
  myProfile: AdvocateProfile | null = null;
  isDev = isDevMode();

  // Tab visibility per role
  tabConfig: { label: string; visible: boolean }[] = [];

  private subs: Subscription[] = [];

  constructor(private caService: CommunityAdvocateService) {}

  ngOnInit(): void {
    this.detectRole();
    this.loadData();
  }

  private detectRole(): void {
    const roleName = localStorage.getItem('role-name') || 'admin';
    this.caRole = ROLE_TO_CA_ROLE[roleName] || 'admin';
    this.pageTitle = CA_ROLE_TITLES[this.caRole];
    this.pageSubtitle = CA_ROLE_SUBTITLES[this.caRole];
    this.buildTabConfig();
  }

  switchDevRole(role: CaRole): void {
    this.caRole = role;
    this.pageTitle = CA_ROLE_TITLES[role];
    this.pageSubtitle = CA_ROLE_SUBTITLES[role];
    this.buildTabConfig();
    this.selectedTabIndex = 0;
    this.loadData();
  }

  private buildTabConfig(): void {
    const r = this.caRole;
    this.tabConfig = [
      { label: 'Overview',            visible: true },
      { label: 'Advocate Profiles',   visible: r !== 'advocate' },
      { label: 'Territory & Audience', visible: true },
      { label: 'Campaign Builder',    visible: true },
      { label: 'Outreach Channels',   visible: true },
      { label: 'Community Pages',     visible: true },
      { label: 'Partner Offers',      visible: true },
      { label: 'Education Library',   visible: true },
      { label: 'Social & Ad Studio',  visible: true },
      { label: 'Automations',         visible: true },
      { label: 'Analytics',           visible: true },
      { label: 'Compliance',          visible: r === 'regional-vp' || r === 'admin' },
    ];
  }

  private loadData(): void {
    this.loading = true;

    if (this.caRole === 'advocate') {
      // Load personal profile + personal KPI
      const profSub = this.caService.getMyAdvocateProfile().subscribe(profile => {
        this.myProfile = profile;
        const kpiSub = this.caService.getMyKpiSummary(profile.id).subscribe(data => {
          this.kpiSummary = data;
          this.loading = false;
        });
        this.subs.push(kpiSub);
      });
      this.subs.push(profSub);
    } else {
      // Load global KPI for chapter/regional/admin
      const sub = this.caService.getKpiSummary().subscribe(data => {
        this.kpiSummary = data;
        this.loading = false;
      });
      this.subs.push(sub);
    }
  }

  onNavigateToTab(index: number): void {
    this.selectedTabIndex = index;
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
