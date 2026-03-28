import { Component, OnInit, ViewChild } from '@angular/core';
import { TabService } from 'src/app/services/tab.service';
import { Router } from '@angular/router';
import { Order } from 'src/app/models/order.model';
import moment from 'moment';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { OrderService } from 'src/app/services/order.service';
import { DialogService } from 'src/app/services/dialog.service';
import { OrderDetailsManagementDialogComponent } from 'src/app/components/dialogs/order-details-management-dialog/order-details-management-dialog.component';

@Component({
    selector: 'app-order-list',
    templateUrl: './order-list.component.html',
    styleUrls: ['./order-list.component.scss'],
    standalone: false
})
export class OrderListComponent implements OnInit {

  orders: Array<Order> = [];
  displayedColumns: string[] = [
    "id",
    "user_name",
    "email",
    "total_amount",
    "status",
    "created_at",
    "updated_at",
    "edit",
    "view"
  ];

  // Pagination
  dataSource: MatTableDataSource<any[]> = new MatTableDataSource([]);
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;
  totalRecords = 0;
  pageIndex = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];

  constructor(private tabService: TabService, private router: Router,
    private orderService: OrderService,
    private dialogService: DialogService
  ) { }

  ngOnInit(): void {
    this.getOrderList()
  }
  getOrderList() {
    this.orderService.getOrderList(this.pageIndex, this.pageSize).subscribe((resp: any) => {
      this.orders = resp.items;
      this.dataSource = new MatTableDataSource(resp.items);
      this.pageIndex = resp.page;
      this.totalRecords = resp.total;
    })
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  handleView(order_id:string) {
    this.dialogService
      .openDialog(OrderDetailsManagementDialogComponent, { type: "view", order_id: order_id })
  }

  handleEdit(order_id:string) {
    this.dialogService
      .openDialog(OrderDetailsManagementDialogComponent, { type: "edit", order_id: order_id })
      .subscribe(()=>{
        this.getOrderList()
      })
  }
}
