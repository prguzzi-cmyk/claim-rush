import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { OrderService } from 'src/app/services/order.service';

@Component({
    selector: 'app-order-details-dialog',
    templateUrl: './order-details-dialog.component.html',
    styleUrls: ['./order-details-dialog.component.scss'],
    standalone: false
})
export class OrderDetailsDialogComponent implements OnInit {
  type: string;

  order_id:string;

  order_details : []

  displayedColumns: string[] = [
    "id",
    "product_image",
    "product_name",
    "price",
    "quantity", 
  ];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<OrderDetailsDialogComponent>,
    private snackBar: MatSnackBar,
    private orderService: OrderService
  ) {
    if (!data) {
      return
    }

    this.type = data.type
    if (this.type === 'view') {
      this.order_id = data.order_id
    }
    
  }

  ngOnInit(): void {
    this.getOderDetailList(this.order_id)
  }

  getOderDetailList(order_id: string) {
    this.orderService.getOrderDetailList(order_id).subscribe((resp:any)=>{
      this.order_details = resp
    })
  }

}
