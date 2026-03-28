import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { OrderService } from 'src/app/services/order.service';

@Component({
    selector: 'app-order-details-management-dialog',
    templateUrl: './order-details-management-dialog.component.html',
    styleUrls: ['./order-details-management-dialog.component.scss'],
    standalone: false
})
export class OrderDetailsManagementDialogComponent implements OnInit {

  type: string;

  order_id: string;

  order_details: []

  displayedColumns: string[] = [
    "id",
    "product_image",
    "product_name",
    "price",
    "quantity",
  ];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<OrderDetailsManagementDialogComponent>,
    private snackBar: MatSnackBar,
    private orderService: OrderService
  ) {
    if (!data) {
      return
    }

    this.type = data.type
    this.order_id = data.order_id
  }

  ngOnInit(): void {
    this.getOderDetailListForManagement(this.order_id)
  }

  getOderDetailListForManagement(order_id: string) {
    this.orderService.getOrderDetailListForManagement(order_id).subscribe((resp: any) => {
      this.order_details = resp
    })
  }

  handleProcessed(): void {
    this.orderService.updateOrder(this.order_id).subscribe((resp: any) => {
      this.dialogRef.close();

      this.snackBar.open("Order updated", "Close", {
        duration: 5000,
        horizontalPosition: "end",
        verticalPosition: "bottom",
      });
    }, (error) => {
    })
  }
}
