import { Component, OnInit, ViewChild } from "@angular/core";
import { MatPaginator, PageEvent } from "@angular/material/paginator";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatTableDataSource } from "@angular/material/table";
import { NgxSpinnerService } from "ngx-spinner";
import { Category } from "src/app/models/category.model";
import { Product } from "src/app/models/product.model";
import { AccountService } from "src/app/services/account.service";
import { CartService } from "src/app/services/cart.service";
import { CategoryService } from "src/app/services/category.service";
import { ProductService } from "src/app/services/product.service";
import { TabService } from "src/app/services/tab.service";

@Component({
    selector: "app-digital-hub",
    templateUrl: "./digital-hub.component.html",
    styleUrls: ["./digital-hub.component.scss"],
    standalone: false
})
export class DigitalHubComponent implements OnInit {
  account_balance: number;
  selectedCategoryId: null;
  categories: Array<Category> = [{ id: null, name: "/" }];
  products: Array<Product> = [];
  // Pagination
  dataSource: MatTableDataSource<any[]> = new MatTableDataSource([]);
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;
  totalRecords = 0;
  pageIndex = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];

  constructor(
    private productService: ProductService,
    private tabService: TabService,
    private spinner: NgxSpinnerService,
    private snackBar: MatSnackBar,
    private cartService: CartService,
    private categoryService: CategoryService,
    private accountService: AccountService
  ) {}

  ngOnInit(): void {
    this.getProductList(this.selectedCategoryId);
    this.getAllCategory();
    this.getAccount();
  }

  getAccount(): void {
    this.accountService.getMyAccount().subscribe((resp) => {
      this.account_balance = resp.account_balance;
    });
  }

  getAllCategory(): void {
    this.categoryService.getAllCategoryList().subscribe((cates: Category[]) => {
      cates
        .filter((c) => c.parent_id === null)
        .forEach((c) => {
          c.name = "/" + c.name;
          this.categories.push(c);
          this.addChildCategory(cates, c.id, c.name);
        });
    });
  }

  addChildCategory(cates: Category[], parent_id: string, parent_name: string) {
    cates
      .filter((f) => f.parent_id === parent_id)
      .forEach((c) => {
        c.name = parent_name + "/" + c.name;
        this.categories.push(c);
        this.addChildCategory(cates, c.id, c.name);
      });
  }

  getProductList(categoryId: null) {
    this.spinner.show();
    this.productService
      .getProductList(this.pageIndex, this.pageSize, this.selectedCategoryId)
      .subscribe((resp) => {
        this.spinner.hide();
        this.dataSource = new MatTableDataSource(resp.items);
        this.products = resp.items;
        this.pageIndex = resp.page;
        this.totalRecords = resp.total;
        this.spinner.hide();
      });
  }

  changePage(event: PageEvent) {
    this.pageIndex = event.pageIndex + 1;
    this.pageSize = event.pageSize;

    if (this.pageIndex == 0) {
      this.pageIndex = 1;
    }

    this.getProductList(this.selectedCategoryId);
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  addToCart(product: Product, button: HTMLButtonElement): void {
    button.disabled = true;
    this.cartService.addProductToCart(product).subscribe(
      (resp) => {
        this.snackBar.open("Added to shopping cart", "Close", {
          duration: 5000,
          horizontalPosition: "end",
          verticalPosition: "bottom",
        });
      },
      (error) => {
        this.snackBar.open(
          "Error: " +
            error.error.detail[0].loc[1] +
            ": " +
            error.error.detail[0].msg,
          "Close",
          {
            duration: 10000,
            horizontalPosition: "end",
            verticalPosition: "bottom",
            panelClass: ["snackbar-error"],
          }
        );
      }
    );
  }

  handleFilter(): void {
    this.getProductList(this.selectedCategoryId);
  }
}
