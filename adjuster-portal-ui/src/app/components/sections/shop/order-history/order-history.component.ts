import { Component, OnInit, ViewChild } from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { OrderDetailsDialogComponent } from 'src/app/components/dialogs/order-details-dialog/order-details-dialog.component';
import { DialogService } from 'src/app/services/dialog.service';
import { OrderService } from 'src/app/services/order.service';
import { TabService } from 'src/app/services/tab.service';

@Component({
    selector: 'app-order-history',
    templateUrl: './order-history.component.html',
    styleUrls: ['./order-history.component.scss'],
    standalone: false
})
export class OrderHistoryComponent implements OnInit {

  orders = [];
  displayedColumns: string[] = [
    "id",
    "total_amount",
    "status",
    "created_at",
    "updated_at",
    "view"
  ];

  // Pagination
  dataSource: MatTableDataSource<any[]> = new MatTableDataSource([]);
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;
  totalRecords = 0;
  pageIndex = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];



  constructor(
    private tabService: TabService,
    private orderService: OrderService,
    private dialogService: DialogService
  ) { }

  ngOnInit(): void {
    this.getMyOrderList()
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }


  changePage(event: PageEvent) {

    this.pageIndex = event.pageIndex + 1;
    this.pageSize = event.pageSize;

    if (this.pageIndex == 0) {
      this.pageIndex = 1;
    }

    this.getMyOrderList();

  }

  getMyOrderList() {
    this.orderService.getMyOrderList(this.pageIndex, this.pageSize).subscribe((resp: any) => {
      this.orders = resp.items
      this.dataSource = new MatTableDataSource(resp.items);
      this.pageIndex = resp.page;
      this.totalRecords = resp.total;
    })
  }

  handleViewDetail(order: any) {
    this.dialogService
      .openDialog(OrderDetailsDialogComponent, { type: "view", order_id: order.id })
  }

}
