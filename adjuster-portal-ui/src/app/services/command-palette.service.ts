import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { CommandItem, CommandCategory } from '../models/command-palette.model';
import { UserService } from './user.service';
import { LeadService } from './leads.service';
import { ClientService } from './client.service';
import { ClaimService } from './claim.service';
import { TabService } from './tab.service';
import { DialogService } from './dialog.service';
import { LeadDetailsDialogComponent } from '../components/dialogs/lead-details-dialog/lead-details-dialog.component';
import { ClientDetailsDialogComponent } from '../components/dialogs/client-details-dialog/client-details-dialog.component';
import { ClaimDialogComponent } from '../components/dialogs/client-claim-dialog/claim-dialog.component';

@Injectable({
  providedIn: 'root',
})
export class CommandPaletteService {
  constructor(
    private router: Router,
    private userService: UserService,
    private leadService: LeadService,
    private clientService: ClientService,
    private claimService: ClaimService,
    private tabService: TabService,
    private dialogService: DialogService
  ) {}

  getStaticCommands(): CommandItem[] {
    const items: CommandItem[] = [];
    const role = localStorage.getItem('role-name');
    const isSuperAdmin = role === 'super-admin';
    const isAdminOrSuperAdmin = role === 'admin' || role === 'super-admin';
    const isAgent = role === 'agent' || role === 'call-center-agent';
    const isCustomer = role === 'customer';

    // --- Navigation items ---

    if (isCustomer) {
      items.push(
        { id: 'nav-customer-dashboard', label: 'My Profile', category: 'navigation', icon: 'groups', route: '/app/customer-dashboard', sideTitle: 'Dashboard', keywords: ['profile', 'home', 'dashboard'] },
        { id: 'nav-customer-claims', label: 'My Claims', category: 'navigation', icon: 'money', route: '/app/customer-claims', sideTitle: 'My claims', keywords: ['claims'] }
      );
      return items;
    }

    // Dashboard
    if (isAdminOrSuperAdmin) {
      items.push({ id: 'nav-dashboard', label: 'Dashboard', category: 'navigation', icon: 'dashboard', route: '/app/dashboard', sideTitle: 'Dashboard', keywords: ['home', 'overview'] });
    }
    if (isAgent) {
      items.push({ id: 'nav-agent-dashboard', label: 'Dashboard', category: 'navigation', icon: 'dashboard', route: '/app/agent-dashboard', sideTitle: 'Dashboard', keywords: ['home', 'overview'] });
    }

    // Reports
    if (this.userService.getUserPermissions('report', 'read')) {
      items.push({ id: 'nav-reports', label: 'Reports', category: 'navigation', icon: 'search', route: '/app/search', sideTitle: 'Reports', keywords: ['search', 'report', 'analytics'] });
    }

    // Leads
    if (this.userService.getUserPermissions('lead', 'read')) {
      items.push({ id: 'nav-leads', label: 'Leads', category: 'navigation', icon: 'headset_mic', route: '/app/leads/search', sideTitle: 'Leads', keywords: ['lead', 'prospects'] });
    }

    // Clients
    if (this.userService.getUserPermissions('client', 'read')) {
      items.push({ id: 'nav-clients', label: 'Clients', category: 'navigation', icon: 'groups', route: '/app/clients/search', sideTitle: 'Clients', keywords: ['client', 'customers'] });
    }

    // Claims
    if (this.userService.getUserPermissions('claim', 'read')) {
      items.push({ id: 'nav-claims', label: 'Claims', category: 'navigation', icon: 'description', route: '/app/claims/search', sideTitle: 'Claims', keywords: ['claim', 'insurance'] });
    }

    // RIN / Fire Incidents
    if (this.userService.getUserPermissions('fire_incident', 'read')) {
      items.push({ id: 'nav-rin', label: 'RIN\u2122', category: 'navigation', icon: 'local_fire_department', route: '/app/fire-incidents', sideTitle: 'RIN', keywords: ['fire', 'incident', 'rin'] });
    }

    // Fire Claims
    items.push({ id: 'nav-fire-claims', label: 'Fire Claims', category: 'navigation', icon: 'whatshot', route: '/app/fire-claims', sideTitle: 'Fire Claims', keywords: ['fire', 'claim', 'damage', 'intake'] });

    // Simulator
    items.push({ id: 'nav-simulator', label: 'Simulator', category: 'navigation', icon: 'calculate', route: '/app/claims/basic-commission-calculator', sideTitle: 'Simulator', keywords: ['calculator', 'commission', 'estimate'] });

    // My Recruits
    if (this.userService.getUserPermissions('claim', 'read')) {
      items.push({ id: 'nav-my-recruits', label: 'My Recruits', category: 'navigation', icon: 'people_outline', route: '/app/users/my-recruits', sideTitle: 'My Recruits & Non team members', keywords: ['recruits', 'team'] });
    }

    // My Commission
    if (this.userService.getUserPermissions('claim', 'read')) {
      items.push({ id: 'nav-my-commission', label: 'My Commission', category: 'navigation', icon: 'local_atm', route: '/app/commission/me', sideTitle: 'My Commission', keywords: ['commission', 'payment', 'earnings'] });
    }

    // Tasks
    if (this.userService.getUserPermissions('user_task', 'read')) {
      items.push({ id: 'nav-tasks', label: 'Tasks', category: 'navigation', icon: 'task', route: '/app/usertask/usertask-list', sideTitle: 'Tasks', keywords: ['task', 'todo', 'to-do'] });
    }

    // Resources
    if (this.userService.getUserPermissions('task', 'read')) {
      items.push({ id: 'nav-business-docs', label: 'Business Documents', category: 'navigation', icon: 'tab', route: '/app/resources/business-documents', sideTitle: 'Business Documents', keywords: ['documents', 'files', 'resources'] });
    }
    items.push({ id: 'nav-assistant', label: 'Assistant', category: 'navigation', icon: 'topic', route: '/app/resources/assistant', sideTitle: 'Assistant', keywords: ['ai', 'help', 'assistant', 'chat'] });
    items.push({ id: 'nav-sources', label: 'Sources', category: 'navigation', icon: 'topic', route: '/app/resources/sources', sideTitle: 'Sources', keywords: ['sources', 'information'] });

    // Shop
    items.push({ id: 'nav-digital-hub', label: 'Digital Hub', category: 'navigation', icon: 'sell', route: '/app/shop/digital-hub', sideTitle: 'Shop', keywords: ['shop', 'digital', 'store'] });
    items.push({ id: 'nav-cart', label: 'Cart', category: 'navigation', icon: 'shopping_cart', route: '/app/shop/cart', sideTitle: 'Shop', keywords: ['cart', 'shopping'] });
    items.push({ id: 'nav-order-history', label: 'Order History', category: 'navigation', icon: 'list_alt', route: '/app/shop/order-history', sideTitle: 'Shop', keywords: ['orders', 'history', 'purchases'] });

    // Profile
    items.push({ id: 'nav-profile', label: 'Profile', category: 'navigation', icon: 'account_box', route: '/app/administration/profile', sideTitle: 'Profile', keywords: ['profile', 'account', 'settings'] });

    // --- Administration (super-admin only) ---
    if (isSuperAdmin) {
      items.push(
        { id: 'nav-users', label: 'Users', category: 'navigation', icon: 'people', route: '/app/administration/users', sideTitle: 'Users', keywords: ['users', 'manage', 'admin'] },
        { id: 'nav-roles', label: 'Roles', category: 'navigation', icon: 'group_add', route: '/app/administration/roles', sideTitle: 'Roles', keywords: ['roles', 'permissions', 'admin'] },
        { id: 'nav-permissions', label: 'Permissions', category: 'navigation', icon: 'admin_panel_settings', route: '/app/administration/permissions', sideTitle: 'Permissions', keywords: ['permissions', 'access', 'admin'] },
        { id: 'nav-recruits-admin', label: 'Recruits Admin', category: 'navigation', icon: 'group_add', route: '/app/administration/recruits-admin', sideTitle: 'Recruits Admin', keywords: ['recruits', 'admin'] },
        { id: 'nav-title-change', label: 'Title Change', category: 'navigation', icon: 'update', route: '/app/administration/title-change', sideTitle: 'Title Change', keywords: ['title', 'promotion'] },
        { id: 'nav-commission-admin', label: 'Commission Admin', category: 'navigation', icon: 'attach_money', route: '/app/administration/commission-admin', sideTitle: 'Commission Admin', keywords: ['commission', 'admin', 'payment'] },
        { id: 'nav-call-types', label: 'Call Types', category: 'navigation', icon: 'tune', route: '/app/administration/call-type-configs', sideTitle: 'Call Types', keywords: ['call', 'types', 'config'] },
        { id: 'nav-policies', label: 'Policies', category: 'navigation', icon: 'policy', route: '/app/administration/policies', sideTitle: 'Policies', keywords: ['policies', 'rules'] },
        { id: 'nav-shop-order-list', label: 'Shop Order List', category: 'navigation', icon: 'sell', route: '/app/administration/shop-management/order-list', sideTitle: 'Shop Management', keywords: ['shop', 'orders', 'admin'] },
        { id: 'nav-shop-accounts', label: 'Account Balance', category: 'navigation', icon: 'account_balance', route: '/app/administration/shop-management/account-list', sideTitle: 'Shop Management', keywords: ['shop', 'balance', 'accounts'] },
        { id: 'nav-shop-products', label: 'Product List', category: 'navigation', icon: 'production_quantity_limits', route: '/app/administration/shop-management/product-list', sideTitle: 'Shop Management', keywords: ['shop', 'products', 'admin'] },
        { id: 'nav-shop-categories', label: 'Category List', category: 'navigation', icon: 'category', route: '/app/administration/shop-management/category-list', sideTitle: 'Shop Management', keywords: ['shop', 'categories', 'admin'] },
      );

      if (this.userService.getUserPermissions('template_file', 'read')) {
        items.push({ id: 'nav-templates', label: 'Templates', category: 'navigation', icon: 'post_add', route: '/app/administration/templates', sideTitle: 'Templates', keywords: ['templates', 'admin'] });
      }

      items.push(
        { id: 'nav-admin-business-docs', label: 'Business Documents (Admin)', category: 'navigation', icon: 'tab', route: '/app/administration/business-documents', sideTitle: 'Business Documents', keywords: ['documents', 'admin'] },
        { id: 'nav-tags', label: 'Tags', category: 'navigation', icon: 'sell', route: '/app/tags', sideTitle: 'Tags', keywords: ['tags', 'labels'] },
        { id: 'nav-npo', label: 'NPO Initiatives', category: 'navigation', icon: 'group_work', route: '/app/administration/npo-initiatives', sideTitle: 'NPO Initiatives', keywords: ['npo', 'nonprofit'] },
        { id: 'nav-partnerships', label: 'Partnerships', category: 'navigation', icon: 'handshake', route: '/app/administration/partnerships', sideTitle: 'Partnerships', keywords: ['partners'] },
        { id: 'nav-networks', label: 'Networks', category: 'navigation', icon: 'share', route: '/app/administration/networks', sideTitle: 'Networks', keywords: ['networks'] },
        { id: 'nav-admin-tasks', label: 'Admin Tasks', category: 'navigation', icon: 'task', route: '/app/administration/tasks/task-list', sideTitle: 'Admin tasks', keywords: ['tasks', 'admin'] },
        { id: 'nav-schedules', label: 'Schedules', category: 'navigation', icon: 'schedule', route: '/app/administration/schedules/schedule-list', sideTitle: 'Schedules', keywords: ['schedules', 'admin'] },
        { id: 'nav-announcements', label: 'Announcements', category: 'navigation', icon: 'announcement', route: '/app/administration/announcements', sideTitle: 'Announcements', keywords: ['announcements', 'admin'] },
        { id: 'nav-newsletters', label: 'Newsletters', category: 'navigation', icon: 'newspaper', route: '/app/administration/newsletters', sideTitle: 'Newsletters', keywords: ['newsletters', 'admin'] },
        { id: 'nav-release-notes', label: 'Release Notes', category: 'navigation', icon: 'notes', route: '/app/administration/release-notes', sideTitle: 'Release notes', keywords: ['release', 'notes', 'changelog'] },
      );
    }

    // --- Quick actions ---
    if (this.userService.getUserPermissions('lead', 'write')) {
      items.push({
        id: 'action-create-lead',
        label: 'Create New Lead',
        category: 'action',
        icon: 'add_circle',
        description: 'Open the new lead form',
        keywords: ['create', 'new', 'lead', 'add'],
        action: () => {
          this.dialogService.openDialog(LeadDetailsDialogComponent, {}, { width: '800px' });
        },
      });
    }

    if (this.userService.getUserPermissions('client', 'write')) {
      items.push({
        id: 'action-create-client',
        label: 'Create New Client',
        category: 'action',
        icon: 'person_add',
        description: 'Open the new client form',
        keywords: ['create', 'new', 'client', 'add'],
        action: () => {
          this.dialogService.openDialog(ClientDetailsDialogComponent, {}, { width: '800px' });
        },
      });
    }

    if (this.userService.getUserPermissions('claim', 'write')) {
      items.push({
        id: 'action-create-claim',
        label: 'Create New Claim',
        category: 'action',
        icon: 'note_add',
        description: 'Open the new claim form',
        keywords: ['create', 'new', 'claim', 'add'],
        action: () => {
          this.dialogService.openDialog(ClaimDialogComponent, {}, { width: '800px' });
        },
      });
    }

    return items;
  }

  searchEntities(query: string): Observable<CommandItem[]> {
    const searches: Observable<CommandItem[]>[] = [];

    if (this.userService.getUserPermissions('lead', 'read')) {
      searches.push(
        this.leadService.searchLeads(1, 5, query).pipe(
          map((res: any) => {
            const leads = res?.data || res?.items || [];
            return leads.map((lead: any) => ({
              id: `lead-${lead.id}`,
              label: lead.contact?.full_name || lead.ref_string || 'Untitled Lead',
              category: 'lead' as CommandCategory,
              icon: 'headset_mic',
              description: [lead.ref_string, lead.status, lead.insurance_company].filter(Boolean).join(' \u2022 '),
              entityId: lead.id,
              entityType: 'lead' as const,
              refString: lead.ref_string,
            }));
          }),
          catchError(() => of([]))
        )
      );
    }

    if (this.userService.getUserPermissions('client', 'read')) {
      searches.push(
        this.clientService.searchClients(1, 5, query).pipe(
          map((res: any) => {
            const clients = res?.data || res?.items || [];
            return clients.map((client: any) => ({
              id: `client-${client.id}`,
              label: client.full_name || client.ref_string || 'Untitled Client',
              category: 'client' as CommandCategory,
              icon: 'groups',
              description: [client.ref_string, client.city, client.state].filter(Boolean).join(' \u2022 '),
              entityId: client.id,
              entityType: 'client' as const,
              refString: client.ref_string,
            }));
          }),
          catchError(() => of([]))
        )
      );
    }

    if (this.userService.getUserPermissions('claim', 'read')) {
      searches.push(
        this.claimService.searchClaims({ search_term: query, page: 1, size: 5 }).pipe(
          map((res: any) => {
            const claims = res?.data || res?.items || [];
            return claims.map((claim: any) => ({
              id: `claim-${claim.id}`,
              label: claim.client?.full_name || claim.ref_string || 'Untitled Claim',
              category: 'claim' as CommandCategory,
              icon: 'description',
              description: [claim.ref_string, claim.status, claim.insurance_company].filter(Boolean).join(' \u2022 '),
              entityId: claim.id,
              entityType: 'claim' as const,
              refString: claim.ref_string,
            }));
          }),
          catchError(() => of([]))
        )
      );
    }

    if (searches.length === 0) {
      return of([]);
    }

    return forkJoin(searches).pipe(
      map((results) => results.flat())
    );
  }

  execute(item: CommandItem): void {
    if (item.action) {
      item.action();
      return;
    }

    if (item.entityId && item.entityType) {
      this.tabService.addItem({
        id: item.entityId,
        name: item.label,
        type: item.entityType,
      });
      return;
    }

    if (item.route) {
      if (item.sideTitle) {
        this.tabService.setSideTitle(item.sideTitle);
      }
      this.router.navigate([item.route]);
    }
  }
}
