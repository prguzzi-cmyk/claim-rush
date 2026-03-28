import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CartItem } from 'src/app/models/cart-item.model';
import { AccountService } from 'src/app/services/account.service';
import { CartService } from 'src/app/services/cart.service';
import { OrderService } from 'src/app/services/order.service';
import { TabService } from 'src/app/services/tab.service';


@Component({
    selector: 'app-cart',
    templateUrl: './cart.component.html',
    styleUrls: ['./cart.component.scss'],
    standalone: false
})
export class CartComponent implements OnInit {
  account_balance: number = 0
  total: number = 0;
  carts: Array<CartItem> = [];
  displayedColumns: string[] = [
    "id",
    "product_image",
    "product_name",
    "price",
    "quantity",
    "subtotal",
    "delete"
  ];

  constructor(
    private cartService: CartService,
    private tabService: TabService,
    private snackBar: MatSnackBar,
    private accountService: AccountService,
    private orderService: OrderService
  ) { }

  ngOnInit(): void {
    this.getAccount()
    this.getCartList()
  
  }

  getCartList() {
    this.cartService.getCartList().subscribe(resp => {
      this.total = 0
      this.carts = resp
      this.carts.forEach(cart => {
        cart.subtotal = parseInt(cart.quantity.toString()) * parseFloat(cart.price.toString())
        this.total += cart.subtotal
      })
    })
  }


  getAccount(): void { 
    this.accountService.getMyAccount().subscribe((resp) => { 
      this.account_balance = resp.account_balance
    })
  }


  updateCart(): void {
    const data = []
    this.carts.forEach(cart => {
      data.push({ id: cart.id, quantity: cart.quantity })
    })
    this.cartService.updateCart(data).subscribe(resp => {
      this.getCartList()
      this.snackBar.open("Cart has been updated.", "Close", {
        duration: 5000,
        horizontalPosition: "end",
        verticalPosition: "bottom",
      });
    }
    )
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }


  deleteCart(cartItem: CartItem) {
    this.cartService.deleteCart(cartItem.id).subscribe(() => {
      this.getCartList()
      this.snackBar.open("Cart item has been deleted.", "Close", {
        duration: 5000,
        horizontalPosition: "end",
        verticalPosition: "bottom",
      });
    },
      (error) => {

      }
    );
  }

  handleCheckout():void{
    this.orderService.createOrder().subscribe((resp:any)=>{
      if (resp.msg!=='ok'){
        this.snackBar.open(resp.msg, "Close", {
          duration: 10000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
          panelClass: ['snackbar-error']
        });
      }
      else{
        this.getCartList()
        this.snackBar.open('Order Submitted', "Close", {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'bottom',
        });
      }
    })
  }
}
