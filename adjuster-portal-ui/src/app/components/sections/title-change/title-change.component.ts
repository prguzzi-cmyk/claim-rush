import {Component, OnInit, ViewChild} from '@angular/core';
import {UserService} from "../../../services/user.service";
import {FormBuilder, FormControl} from "@angular/forms";
import {CommissionService} from "../../../services/commission.service";
import {NgxSpinnerService} from "ngx-spinner";
import {MatSnackBar} from "@angular/material/snack-bar";
import {TabService} from "../../../services/tab.service";
import {MatTableDataSource} from "@angular/material/table";
import {Commission} from "../../../models/commission.model";
import {MatPaginator, PageEvent} from "@angular/material/paginator";
import {SelectionModel} from "@angular/cdk/collections";
import {MatSort} from "@angular/material/sort";
import {TitleChangeTicket} from "../../../models/title-change.model";
import {User} from "../../../models/user.model";
import {TitleChangeService} from "../../../services/title-change.service";

@Component({
    selector: 'app-title-change',
    templateUrl: './title-change.component.html',
    styleUrls: ['./title-change.component.scss'],
    standalone: false
})
export class TitleChangeComponent implements OnInit {

  searchFormGroup = this._formBuilder.group({
    ticketOwnerId: new FormControl('', []),
    status: new FormControl(0, []),
  });

  tickets: any = [];

  displayedColumnsTitleChangeTickets: string[] = [
    'select',
    'owner_id',
    'status',
    'type',
    'current_title_name',
    'next_title_name',
    'created_at',
    'effected_at',
    'edit',
  ];

  dataSourceTickets: MatTableDataSource<TitleChangeTicket>;
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  selection = new SelectionModel<TitleChangeTicket>(true, []);
  @ViewChild(MatSort) sort: MatSort;

  queryParams: any = {};
  pageIndex = 1;
  pageSize = 10;
  pageSizeOptions = [10, 25, 50, 100, 500];
  totalRecords = 0;

  users: [User];
  private user: User;

  constructor(public userService: UserService,
              private _formBuilder: FormBuilder,
              private titleChangeService: TitleChangeService,
              private spinner: NgxSpinnerService,
              private snackBar: MatSnackBar,
              private tabService: TabService,) { }

  ngOnInit(): void {
    this.getUsers();
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSourceTickets.data.length;
    return numSelected === numRows;
  }

  compareCategoryObjects(u1: User, u2: User) {
    return u1 && u2 && u1.id == u2.id;
  }

  getUser() {
    this.spinner.show();
    this.userService.currentUser.subscribe((user) => {
      if (user) {
        this.user = user;
      }
    });
  }

  getUsers() {
    this.getUser();
    this.userService.getUsers(1, 500).subscribe((users) => {
      this.users = users.items;
      this.spinner.hide();
      this.search(this.pageIndex, this.pageSize)
    });
  }

  search(page: number, size: number) {
    if (page == 1 ) {
      this.paginator.pageIndex = 0;
    }

    this.spinner.show();
    this.tickets = [];

    this.searchFormGroup.markAllAsTouched();

    // if (this.searchFormGroup.valid) {

    let owner_id = this.searchFormGroup.get('ticketOwnerId').value.trim();
    let status = this.searchFormGroup.get('status').value;

    this.queryParams['ticketOwnerId'] = owner_id;
    this.queryParams['status'] = status;

    this.selection.clear();

    this.spinner.show();
    this.titleChangeService.getTitleChangeTickets(owner_id, status, page, size).subscribe(
        (commissions) => {
          this.spinner.hide();
          this.tickets = commissions;
          if (commissions !== undefined) {
            // filter deleted claims
            this.dataSourceTickets = new MatTableDataSource(
                commissions?.items
            );

            this.totalRecords = commissions?.total_items;
            this.pageIndex = commissions?.page_num;
            this.pageSize = commissions?.page_size;
          }
        },
        (error) => {
          this.spinner.hide();
          this.snackBar.open(
              'Error: ' +
              error?.message  ,
              'Close',
              {
                duration: 10000,
                horizontalPosition: 'end',
                verticalPosition: 'bottom',
                panelClass: ['snackbar-error'],
              }
          );
        }
    );
    // }
  }

  /** Selects all rows if they are not all selected; otherwise clear selection. */
  masterToggle() {
    this.isAllSelected()
        ? this.selection.clear()
        : this.dataSourceTickets.data.forEach((row) =>
            this.selection.select(row)
        );
  }

  translateOwnerInfo(ticket: TitleChangeTicket) {
      const currentUser = this.users?.filter((value: User) => value.id === ticket.owner_id);
      if (currentUser.length && currentUser.length> 0) {
        return currentUser[0].first_name + " " + currentUser[0].last_name;
      } else {
        return ticket.owner_id;
      }
  }

  translateTicketStatus(status:number = 0) {
    if (status === 0) {
      return "PENDING";
    } else if (status==1) {
      return "FULFILLED";
    } else if (status==2) {
      return "OBSOLETE";
    } else {
      return status;
    }
  }

  translateTicketType(type:number = 0) {
   if (type == 0) {
     return "LEVEL UP";
   } else if (type == 1) {
      return "LEVEL DOWN";
   } else {
     return type;
   }
  }

  confirmPromotion(ticket: TitleChangeTicket){
    const userConfirmed = confirm('Are you sure you want to confirm the title change?');
    if (userConfirmed) {
    this.titleChangeService.executeTitleChange({
      owner_id: ticket.owner_id,
      change_type: ticket.type
    }).subscribe((data) => {
      this.search(this.pageIndex, this.pageSize)
    })
    }
  }

  changePage(event: PageEvent) {
    this.pageIndex = event.pageIndex + 1;
    this.pageSize = event.pageSize;

    if (this.pageIndex == 0) {
      this.pageIndex = 1;
    }

    this.search(this.pageIndex, this.pageSize);
  }

  rejectPromotion(ticket: TitleChangeTicket) {
    const userConfirmed = confirm('Are you sure you want to reject the title change?');
    if (userConfirmed) {
      this.titleChangeService.cancelTitleChange({
        owner_id: ticket.owner_id,
        change_type: ticket.type
      }).subscribe((data) => {
        this.search(this.pageIndex, this.pageSize);
      })
    }
  }
}
