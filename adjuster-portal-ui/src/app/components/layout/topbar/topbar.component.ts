import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { PermissionService } from 'src/app/services/permission.service';
import { TabService } from 'src/app/services/tab.service';
import { UserService } from 'src/app/services/user.service';
import { LeadDetailsDialogComponent } from '../../dialogs/lead-details-dialog/lead-details-dialog.component';
import { DialogService } from 'src/app/services/dialog.service';
import { Router } from '@angular/router';
import { ClientDetailsDialogComponent } from '../../dialogs/client-details-dialog/client-details-dialog.component';
import { ClaimDialogComponent } from '../../dialogs/client-claim-dialog/claim-dialog.component';
import { Client } from 'src/app/models/client.model';
import { Observable, Subscription } from 'rxjs';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { ClientService } from 'src/app/services/client.service';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { User } from 'src/app/models/user.model';
import { LeadService } from 'src/app/services/leads.service';
import { MatTableDataSource } from '@angular/material/table';
import { InAppNotificationService } from 'src/app/services/in-app-notification.service';
import { AppNotification } from 'src/app/models/notification.model';
import { LiveActivityService } from 'src/app/services/live-activity.service';

@Component({
    selector: 'app-topbar',
    templateUrl: './topbar.component.html',
    styleUrls: ['./topbar.component.scss'],
    standalone: false
})
export class TopbarComponent implements OnInit, OnDestroy {
  user: User;
  // filteredClients: Observable<Client[]>;
  clientCtrl = new FormControl();
  clients: Client[];
  placeholder: string = 'Search by name';
  role: string;
  pendingLeadsCount = 0;
  showDropdown = false;
  allClients = []; // populate this with your clients list
  filteredClients = [];

  // Notifications
  notifications: AppNotification[] = [];
  showNotificationPanel = false;
  unreadCount = 0;
  private unreadCountSub: Subscription;

  constructor(
    private auth: AuthService,
    private tabService: TabService,
    public userService: UserService,
    private dialogService: DialogService,
    private router: Router,
    private clientService: ClientService,
    private leadService: LeadService,
    private inAppNotificationService: InAppNotificationService,
    public liveActivityService: LiveActivityService,
  ) { }

  ngOnInit(): void {

    this.userService.currentUser.subscribe((user) => {
      this.user = user;

      if (this.user) {
        this.user = user;

        localStorage.setItem("role-name", user.role?.name);
        this.role = user.role?.name;

        if(this.role != 'customer') {
          this.getPendingForApprovalLeadsCount();
        }

        // Start notification polling once user is loaded
        this.inAppNotificationService.startPolling(30000);
        this.unreadCountSub = this.inAppNotificationService.unreadCount$.subscribe(
          count => this.unreadCount = count
        );
      }

    });

    this.clientCtrl.valueChanges
    .pipe(
      debounceTime(500),
      distinctUntilChanged()
    )
    .subscribe(query => {
      if (typeof query === 'string' && query.trim()) {
        this.clientService.searchClientsNavbar(1, 20, query).subscribe(
          clients => {
            this.filteredClients = clients;
            this.showDropdown = true;
          },
          error => {
            console.error('Error fetching clients:', error);
            this.filteredClients = [];
          }
        );
      } else {
        this.filteredClients = [];
        this.showDropdown = false;
      }
    });
  }

  getPendingForApprovalLeadsCount() {
    let params = {
      search_field: 'status',
      search_value: 'signed'
    }
    this.leadService.getLeads(1,1, params).subscribe(
      (leads) => {

        if (leads !== undefined) {
         this.pendingLeadsCount = leads.total;
        }
      },
      (error) => {
       console.log(error);
      }
    );
  }

  logOut() {
    this.auth.logout();
    this.tabService.setItemList([]);
  }

  openLeadAddDialog() {
    this.dialogService
      .openDialog(LeadDetailsDialogComponent, { type: "add" })
      .subscribe(() => this.router.navigate(["/app/leads"]));
  }

  openCreateClientDialog() {
    this.dialogService
      .openDialog(ClientDetailsDialogComponent, { type: 'add' })
      .subscribe((client) => {
        if (client) {
          this.dialogService.openDialog(ClaimDialogComponent, { type: 'add', client: client })

        } else {
          this.router.navigate(["/app/clients"]);
          this.tabService.setSideTitle("Clients");
        }

      });
  }

  openClaimAddDialog() {
    this.dialogService
      .openDialog(ClaimDialogComponent, {
        type: 'add'
      })
      .subscribe(() => { this.router.navigate(["/app/claims"]); this.tabService.setSideTitle("Claims"); });
  }

  displayClientName(client: Client): string {
    return client ? client.full_name : '';
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  hidePlaceholder(): void {
    this.placeholder = '';
  }

  onClientSelected(client: any): void {
    if (client) {
      this.tabService.addItem({
        id: client.id,
        name: `${client.full_name}-${client.ref_string.slice(-3)}`,
        type: client.type
      });
      this.clientCtrl.setValue('');
      this.filteredClients = [];
      this.showDropdown = false;
    }
  }

  hideDropdown() {
    this.showDropdown = false;
  }

  onInputChange() {
    this.showDropdown = true;
  }

  ngOnDestroy(): void {
    this.inAppNotificationService.stopPolling();
    if (this.unreadCountSub) {
      this.unreadCountSub.unsubscribe();
    }
  }

  toggleNotificationPanel() {
    this.showNotificationPanel = !this.showNotificationPanel;
    if (this.showNotificationPanel) {
      this.loadNotifications();
    }
  }

  loadNotifications() {
    this.inAppNotificationService.getNotifications(false, 0, 20).subscribe({
      next: (notifications) => this.notifications = notifications,
      error: (err) => console.error('Error loading notifications:', err),
    });
  }

  onNotificationClick(notification: AppNotification) {
    if (!notification.is_read) {
      this.inAppNotificationService.markAsRead(notification.id).subscribe(() => {
        notification.is_read = true;
        this.inAppNotificationService.refreshUnreadCount();
      });
    }
    if (notification.link) {
      this.router.navigateByUrl(notification.link);
    }
    this.showNotificationPanel = false;
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'lead_assignment': return 'assignment_ind';
      case 'escalation': return 'trending_up';
      case 'announcement': return 'campaign';
      case 'system': return 'warning';
      default: return 'info';
    }
  }

  markAllRead() {
    this.inAppNotificationService.markAllAsRead().subscribe(() => {
      this.notifications.forEach(n => n.is_read = true);
      this.inAppNotificationService.refreshUnreadCount();
    });
  }

}
