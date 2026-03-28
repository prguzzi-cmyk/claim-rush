import { RoleService } from "src/app/services/role.service";
import { Component, OnInit, OnDestroy } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import { AuthService } from "src/app/services/auth.service";
import { DialogService } from "src/app/services/dialog.service";
import { UserService } from "src/app/services/user.service";
import { User } from "src/app/models/user.model";
import { GlobalVariable } from "src/global";
import { environment } from "src/environments/environment";
import { Role } from "src/app/models/role.model";
import { NgxSpinnerService } from "ngx-spinner";
import { TabService } from "src/app/services/tab.service";
import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import packageJson from '../../../../../package.json';
import { LeadNotificationService } from "src/app/shared/services/lead-notification.service";

export interface NavSection {
  key: string;
  label: string;
  icon: string;
  collapsed: boolean;
}

@Component({
    selector: "app-sidebar",
    templateUrl: "./sidebar.component.html",
    styleUrls: ["./sidebar.component.scss"],
    standalone: false
})
export class SidebarComponent implements OnInit, OnDestroy {
  public version: string = packageJson.version;
  path: string;
  user: User;
  role: Role;
  roleName: string = 'agent';
  operatingMode: string = 'neutral';
  userManualVersion = "";
  internalUserManualVersion = "";
  environment;
  private routerSub: Subscription;

  /** Route-to-title map for automatic tab title setting */
  private readonly routeTitleMap: Record<string, string> = {
    '/app/dashboard': 'Dashboard',
    '/app/agent-dashboard': 'Dashboard',
    '/app/incident-intelligence': 'Incident Intelligence',
    '/app/storm-intelligence': 'Storm Intel',
    '/app/roof-intelligence': 'Roof Intel',
    '/app/potential-claims': 'Potential Claims',
    '/app/claim-opportunity-dashboard': 'Opportunity Scoring',
    '/app/lead-intelligence': 'Lead Intelligence',
    '/app/crime-claims-intelligence': 'Crime Claims Intel',
    '/app/dashboard/intelligence': 'Global Intelligence',
    '/app/dashboard/storm-impact': 'Storm Impact Targeting',
    '/app/search': 'Reports',
    '/app/leads': 'Leads',
    '/app/leads/search': 'Search Leads',
    '/app/clients/search': 'Clients',
    '/app/claims/search': 'Claims',
    '/app/fire-claims': 'Fire Claims',
    '/app/skip-trace-wallet': 'Skip Trace Wallet',
    '/app/voice-outreach': 'Voice Outreach',
    '/app/outreach/voice': 'Voice Campaigns',
    '/app/outreach/campaigns/builder': 'Campaign Builder',
    '/app/outreach/campaigns/new': 'Voice Campaign Builder',
    '/app/outreach/call-logs': 'Call Logs',
    '/app/outreach/transcripts': 'Transcripts',
    '/app/outreach/analytics': 'Campaign Analytics',
    '/app/outreach': 'Outreach Dashboard',
    '/app/outreach/campaigns': 'Campaign Manager',
    '/app/outreach/templates': 'Outreach Templates',
    '/app/outreach/conversations': 'Outreach Conversations',
    '/app/usertask/usertask-list': 'Tasks',
    '/app/estimating': 'Estimating',
    '/app/adjuster-assistant': 'ACI Adjuster',
    '/app/policy-vault': 'Policy Vault',
    '/app/fire-incidents': 'RIN',
    '/app/response-desk': 'Response Desk',
    '/app/communications-hub': 'Comms Hub',
    '/app/resources/business-documents': 'Business Documents',
    '/app/resources/assistant': 'Assistant',
    '/app/resources/sources': 'Sources',
    '/app/shop/digital-hub': 'Shop',
    '/app/shop/cart': 'Shop',
    '/app/shop/order-history': 'Shop',
    '/app/users/my-recruits': 'My Recruits',
    '/app/commission/me': 'My Commission',
    '/app/agent-performance': 'Agent Performance',
    '/app/revenue-intelligence': 'Revenue Intelligence',
    '/app/claim-recovery': 'Claim Recovery',
    '/app/administration/users': 'Users',
    '/app/administration/roles': 'Roles',
    '/app/administration/permissions': 'Permissions',
    '/app/administration/territories': 'Territory Records',
    '/app/administration/territory-control': 'Territory Map Control',
    '/app/administration/lead-distribution': 'Lead Distribution',
    '/app/administration/lead-intake': 'Lead Intake',
    '/app/administration/rotation-config': 'Rotation Config',
    '/app/administration/agent-setup': 'Agent Setup Wizard',
    '/app/administration/intake-control': 'Intake Control',
    '/app/rotation-leads': 'Lead Rotation',
    '/app/lead-rotation-engine': 'Rotation Engine',
    '/app/rotation-leads/metrics': 'Rotation Metrics',
    '/app/administration/recruits-admin': 'Recruits Admin',
    '/app/administration/title-change': 'Title Change',
    '/app/administration/commission-admin': 'Commission Admin',
    '/app/administration/policies': 'Policies',
    '/app/administration/templates': 'Templates',
    '/app/administration/business-documents': 'Business Documents',
    '/app/tags': 'Tags',
    '/app/administration/npo-initiatives': 'NPO Initiatives',
    '/app/administration/partnerships': 'Partnerships',
    '/app/administration/networks': 'Networks',
    '/app/administration/tasks/task-list': 'Admin Tasks',
    '/app/administration/schedules/schedule-list': 'Schedules',
    '/app/administration/announcements': 'Announcements',
    '/app/administration/newsletters': 'Newsletters',
    '/app/administration/release-notes': 'Release Notes',
    '/app/administration/shop-management/order-list': 'Shop Management',
    '/app/administration/shop-management/account-list': 'Shop Management',
    '/app/administration/shop-management/product-list': 'Shop Management',
    '/app/administration/shop-management/category-list': 'Shop Management',
    '/app/claims/basic-commission-calculator': 'Simulator',
    '/app/administration/profile': 'Profile',
    '/app/community-advocate': 'Community Advocate',
    '/app/client-portal': 'Client Portal',
    '/app/customer-dashboard': 'Dashboard',
    '/app/customer-claims': 'My Claims',
    '/app/ai-intake': 'AI Lead Intake',
    '/app/ai-intake/dashboard': 'Intake Dashboard',
    '/app/sales-ai': 'Sales AI',
    '/app/sales-dashboard': 'Sales Dashboard',
    '/app/sales-claims': 'My Claims',
    '/app/ai-sales-agent': 'AI Sales Agent',
    '/app/ai-sales-agent/appointments': 'Appointments',
    '/app/ai-sales-agent/intake-launcher': 'Intake Launcher',
    '/app/ai-sales-agent/scripts': 'Sales Scripts',
    '/app/ai-sales-agent/kpis': 'Sales KPIs',
    '/app/voice-outreach-agent': 'AI Voice Outreach',
    '/app/voice-outreach-agent/campaigns': 'Voice Campaigns',
    '/app/voice-outreach-agent/calls': 'Voice Call Engine',
    '/app/voice-outreach-agent/classifier': 'Call Classifier',
    '/app/voice-outreach-agent/routing': 'Auto Lead Routing',
    '/app/claim-intake': 'AI Lead Intake',
    '/app/claim-file-manager': 'Claim File Manager',
    '/app/inspection-calendar': 'Inspection Calendar',
    '/app/inspection-performance': 'Inspection Performance',
    '/app/outreach-campaigns': 'Outreach Campaigns',
    '/app/message-templates': 'Message Templates',
    '/app/upa-outreach/profiles': 'Outreach Profiles',
    '/app/upa-outreach/campaign': 'UPA Campaign',
    '/app/administration/outreach-compliance': 'Outreach Compliance',
    '/app/workflow-queues': 'Workflow Queues',
  };

  /** Track collapsed state for each nav section */
  sections: Record<string, NavSection> = {
    intel:      { key: 'intel',      label: 'Intelligence',    icon: 'hub',           collapsed: false },
    leads:      { key: 'leads',      label: 'Leads & Sales',   icon: 'call_split',    collapsed: true },
    comms:      { key: 'comms',      label: 'Communications',  icon: 'cell_tower',    collapsed: true },
    ops:        { key: 'ops',        label: 'Operations',      icon: 'settings',      collapsed: true },
    claims:     { key: 'claims',     label: 'Claims',          icon: 'description',   collapsed: true },
    perf:       { key: 'perf',       label: 'Performance',     icon: 'trending_up',   collapsed: true },
    resources:  { key: 'resources',  label: 'Resources',       icon: 'folder_open',   collapsed: true },
    admin:      { key: 'admin',      label: 'Admin',           icon: 'shield',        collapsed: true },
  };

  notificationCount = 0;

  constructor(
    private auth: AuthService,
    private router: Router,
    private dialogService: DialogService,
    public userService: UserService,
    private roleService: RoleService,
    private spinner: NgxSpinnerService,
    private tabService: TabService,
    private leadNotifications: LeadNotificationService,
  ) {
    this.environment = environment;

    this.routerSub = router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe((e) => {
      this.path = e.urlAfterRedirects || e.url;
      this.autoExpandActiveSection();
      this.setTitleFromRoute(this.path);
    });
  }

  ngOnInit() {
    this.leadNotifications.getNotifications().subscribe(
      notifs => this.notificationCount = notifs.filter(n => !n.read).length
    );

    this.userService.currentUser.subscribe(
      (result) => {
        this.user = result;
      },
      (error) => {
        if (error?.status == 403) {
          this.router.navigate(["login"]);
        }
      },
      () => {
        this.spinner.hide();
      }
    );

    this.roleName = localStorage.getItem('role-name');
    this.operatingMode = localStorage.getItem('operating-mode') || 'neutral';

    // Restore collapsed state from localStorage
    const saved = localStorage.getItem('sidebar-sections');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        for (const key of Object.keys(parsed)) {
          if (this.sections[key]) {
            this.sections[key].collapsed = parsed[key];
          }
        }
      } catch {}
    }

    this.autoExpandActiveSection();
  }

  toggleSection(key: string): void {
    if (this.sections[key]) {
      this.sections[key].collapsed = !this.sections[key].collapsed;
      this.saveSectionState();
    }
  }

  isSectionOpen(key: string): boolean {
    return this.sections[key] && !this.sections[key].collapsed;
  }

  private saveSectionState(): void {
    const state: Record<string, boolean> = {};
    for (const [key, section] of Object.entries(this.sections)) {
      state[key] = section.collapsed;
    }
    localStorage.setItem('sidebar-sections', JSON.stringify(state));
  }

  /** Auto-expand the section containing the active route */
  private autoExpandActiveSection(): void {
    if (!this.path) return;

    const routeMap: Record<string, string[]> = {
      intel: [
        '/app/dashboard', '/app/agent-dashboard', '/app/incident-intelligence',
        '/app/storm-intelligence', '/app/roof-intelligence', '/app/potential-claims',
        '/app/claim-opportunity-dashboard', '/app/lead-intelligence',
        '/app/crime-claims-intelligence', '/app/dashboard/intelligence',
        '/app/dashboard/storm-impact',
      ],
      leads: [
        '/app/leads', '/app/leads/', '/app/claim-intake', '/app/ai-intake',
        '/app/ai-sales-agent', '/app/voice-outreach-agent', '/app/voice-secretary',
      ],
      comms: [
        '/app/communications-hub', '/app/outreach/campaigns', '/app/outreach/templates',
        '/app/outreach-campaigns', '/app/message-templates',
        '/app/voice-outreach', '/app/outreach',
        '/app/upa-outreach',
      ],
      ops: [
        '/app/response-desk', '/app/rotation-leads', '/app/lead-rotation-engine',
        '/app/inspection-calendar', '/app/inspection-performance', '/app/usertask/',
      ],
      claims: [
        '/app/claims/', '/app/clients/', '/app/claim-file-manager',
        '/app/estimating', '/app/fire-incidents', '/app/adjuster-assistant',
        '/app/policy-vault', '/app/fire-claims',
      ],
      perf: [
        '/app/sales-ai', '/app/agent-performance', '/app/users/my-recruits',
        '/app/commission/me', '/app/revenue-intelligence', '/app/claim-recovery',
        '/app/search', '/app/agreements',
      ],
      resources: [
        '/app/resources/', '/app/shop/',
        '/app/community-advocate', '/app/administration/partnerships',
        '/app/administration/networks', '/app/administration/npo-initiatives',
      ],
      admin: [
        '/app/administration/', '/app/tags',
        '/app/claims/basic-commission-calculator',
        '/app/administration/outreach-compliance',
      ],
    };

    for (const [key, routes] of Object.entries(routeMap)) {
      if (routes.some(r => this.path.startsWith(r) || this.path === r)) {
        this.sections[key].collapsed = false;
      }
    }
  }

  ngOnDestroy(): void {
    if (this.routerSub) {
      this.routerSub.unsubscribe();
    }
  }

  /** Derive the tab title from the current URL using the route-title map. */
  private setTitleFromRoute(url: string): void {
    if (this.routeTitleMap[url]) {
      this.tabService.setSideTitle(this.routeTitleMap[url]);
      return;
    }
    for (const [route, title] of Object.entries(this.routeTitleMap)) {
      if (url.startsWith(route + '/') || url.startsWith(route + '?')) {
        this.tabService.setSideTitle(title);
        return;
      }
    }
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  openExportDialog() {
    this.dialogService.openExportDialog();
  }

  onSidebarClick(data: string) {
    // Kept for backward compatibility
  }

  openOfferExportDialog(type) {}

  logOut() {
    this.auth.logout();
    this.tabService.setItemList([]);
  }
}
