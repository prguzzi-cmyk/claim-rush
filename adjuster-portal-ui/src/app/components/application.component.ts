import { Component, OnInit, ViewChild, ViewContainerRef, TemplateRef, HostListener } from '@angular/core';
import { transition, trigger, query, style, animate, group, animateChild } from '@angular/animations';
import { NgxPermissionsService } from 'ngx-permissions';
import { UserService } from 'src/app/services/user.service';
import { ImpersonationService } from 'src/app/services/impersonation.service';
import { User } from '../models/user.model';
import { Router } from '@angular/router';
import { MatSidenav } from '@angular/material/sidenav';
import { GlobalVariable } from 'src/global';
import { environment } from 'src/environments/environment';
import { PermissionService } from '../services/permission.service';
import { debounceTime, distinctUntilChanged, filter, map, mergeMap, startWith, switchMap } from 'rxjs/operators';
import { DialogService } from '../services/dialog.service';
import { ClientDetailsDialogComponent } from './dialogs/client-details-dialog/client-details-dialog.component';
import { ClaimDialogComponent } from './dialogs/client-claim-dialog/claim-dialog.component';
import { AuthService } from '../services/auth.service';
import { TabService } from '../services/tab.service';
import { Subscription, Observable } from 'rxjs';
import {
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { MatTabGroup } from '@angular/material/tabs';
import { ClientService } from '../services/client.service';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { CommandPaletteComponent } from './command-palette/command-palette.component';


@Component({
    selector: 'app-application',
    templateUrl: './application.component.html',
    styleUrls: ['./application.component.scss'],
    animations: [
        trigger('sectionAnimation', [
            transition('* => *', [
                query(':enter, :leave', style({ position: 'absolute', width: '100%' }), { optional: true }),
                group([
                    query(':enter', [
                        style({ transform: 'translateY(100vh)' }),
                        animate('.2s ease-in-out', style({ transform: 'translateY(0%)' }))
                    ], { optional: true }),
                    query(':leave', [
                        style({ transform: 'translateY(0%) scale(1)' }),
                        animate('.2s ease-in-out', style({ transform: 'translateY(-110%) scale(.5)' }))
                    ], { optional: true }),
                ])
            ])
        ])
    ],
    standalone: false
})
export class ApplicationComponent implements OnInit {
  user: User;
  narrowScreen: boolean;
  isImpersonating: boolean = false;
  userManualVersion = "";
  internalUserManualVersion = "";
  selectedIndex: number = 0;

  role: string;

  @ViewChild(MatTabGroup) tabGroup: MatTabGroup;
  @ViewChild('outlet', { read: ViewContainerRef }) outletRef: ViewContainerRef;
  @ViewChild('content', { read: TemplateRef }) contentRef: TemplateRef<any>;

  readonly narrowScreenBreakpoint: number = 840;
  @ViewChild('sidenav') public sidenav: MatSidenav;

  // itemList$: Observable<Array<any>>;
  itemList: any[] = [];
  private focusSubscription: Subscription;
  private sideSubscription: Subscription;
  private itemSubscription: Subscription;
  side: string = 'Dashboard';
  private commandPaletteRef: MatDialogRef<CommandPaletteComponent> | null = null;

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      this.openCommandPalette();
    }
  }

  constructor(
    public userService: UserService,
    private ngxPermissionsService: NgxPermissionsService,
    private impersonationService: ImpersonationService,
    private router: Router,
    private permissionsService: PermissionService,
    private dialogService: DialogService,
    private auth: AuthService,
    private tabService: TabService,
    private clientService: ClientService,
    private matDialog: MatDialog
  ) {
    // Track whether the screen is narrow
    this.narrowScreen = window.innerWidth < this.narrowScreenBreakpoint;
    window.onresize = () => {
      this.narrowScreen = window.innerWidth < this.narrowScreenBreakpoint;
    };

    // this.itemList$ = this.tabService.itemList$;

    // Subscribe to router URL
    router.events.subscribe(val => {
      // Close the side navigation if the screen is narrow
      if (this.narrowScreen) {
        this.sidenav?.close();
      }
    });

    this.internalUserManualVersion = GlobalVariable.INTERNAL_USER_MANUAL_VERSION;
  }

  ngOnInit() {

    this.userService.currentUser.subscribe((user) => {
      this.user = user;

      if (this.user) {
        this.user = user;
        localStorage.setItem("user-name", user.first_name + ' ' + user.last_name);
        localStorage.setItem("role-name", user.role?.name);
        localStorage.setItem("operating-mode", user.operating_mode || 'neutral');
        this.role = user.role?.name;


        const role = [user.role?.name];
        this.ngxPermissionsService.loadPermissions(role);
        if (this.user?.permissions)
          localStorage.setItem("permissions", JSON.stringify(this.user?.permissions));
      }

    });

    this.userService.getUser().subscribe(
      user => {

      },
      error => {
        if (error?.status == 403) {
          this.router.navigate(['login']);
        }
      },
      () => {
      }
    );


    // Subscribe to impersonation status
    this.impersonationService.impersonatingObservable.subscribe(impersonating => {
      this.isImpersonating = impersonating;
    });

    this.focusSubscription = this.tabService.focus$.pipe(
      distinctUntilChanged()
    ).subscribe(focus => {
      this.selectedIndex = focus;
    })

    this.sideSubscription = this.tabService.side$.subscribe(
      side => this.side = side
    );

    this.itemSubscription = this.tabService.itemList$.subscribe(
      items => this.itemList = items
    );

    // Check impersonation status
    this.impersonationService.isImpersonating();
  }

  ngOnDestroy() {
    if (this.focusSubscription)
      this.focusSubscription.unsubscribe();
    if (this.sideSubscription)
      this.sideSubscription.unsubscribe();
    if (this.itemSubscription)
      this.itemSubscription.unsubscribe();
  }



  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  getAllListConnections(index) {
    var connections = []
    for (var i = 0; i < this.itemList.length; i++) {
      if (i != index) {
        connections.push("list-" + i);
      }
    }
    return connections;
  }


  drop(event: CdkDragDrop<string[]>) {
    var previousIndex = parseInt(event.previousContainer.id.replace("list-", ""));
    var currentIndex = parseInt(event.container.id.replace("list-", ""));
    if (!Number.isNaN(previousIndex) && !Number.isNaN(currentIndex) && previousIndex != undefined && currentIndex != undefined && previousIndex != currentIndex) {
      const reorderedList = [...this.itemList];
      moveItemInArray(reorderedList, previousIndex, currentIndex);
      this.itemList = reorderedList;
      this.tabService.setItemList(reorderedList);
      this.tabGroup.selectedIndex = currentIndex + 1;
    }
  }

  trackByIndex(index: number, item: any): string {
    return item.id + index;
  }

  /**
   * Stop impersonating
   */
  stopImpersonating() {
    this.impersonationService.stopImpersonating();
  }

  closeTab(index: number) {
    this.tabService.removeItem(index);
  }

  openCommandPalette(): void {
    // Toggle behavior: if already open, close it
    if (this.commandPaletteRef) {
      this.commandPaletteRef.close();
      this.commandPaletteRef = null;
      return;
    }

    this.commandPaletteRef = this.matDialog.open(CommandPaletteComponent, {
      panelClass: 'command-palette-dialog',
      width: '600px',
      position: { top: '15vh' },
      hasBackdrop: true,
      backdropClass: 'command-palette-backdrop',
    });

    this.commandPaletteRef.afterClosed().subscribe(() => {
      this.commandPaletteRef = null;
    });
  }
}
