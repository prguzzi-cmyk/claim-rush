import { Component, OnInit, ViewChild } from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { NgxSpinnerService } from 'ngx-spinner';
import { ProductDetailsDialogComponent } from 'src/app/components/dialogs/product-details-dialog/product-details-dialog.component';
import { Product } from 'src/app/models/product.model';
import { DialogService } from 'src/app/services/dialog.service';
import { ProductService } from 'src/app/services/product.service';
import { TabService } from 'src/app/services/tab.service';

@Component({
    selector: 'app-product-list',
    templateUrl: './product-list.component.html',
    styleUrls: ['./product-list.component.scss'],
    standalone: false
})
export class ProductListComponent implements OnInit {
  products: Array<Product> = [];
  displayedColumns: string[] = [
    "id",
    "category_name",
    "product_image",
    "product_name",
    "price",
    "original_price",
    "created_at",
    "updated_at",
    "edit",
    "delete"
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
    private productService: ProductService,
    private dialogService: DialogService,
    private spinner: NgxSpinnerService,
  ) { }

  ngOnInit(): void {
    this.getProductList()
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  openProductAddDialog(): void {
    this.dialogService
      .openDialog(ProductDetailsDialogComponent, { type: "add" })
      .subscribe(() => this.getProductList());
  }

  getProductList(): void {
    this.spinner.show();
    this.productService.getProductList(this.pageIndex, this.pageSize).subscribe((resp) => {
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

    this.getProductList();

  }

  openProductDeleteDialog(product: Product) {
    this.dialogService
      .openDialog(ProductDetailsDialogComponent, { type: "delete", product: product })
      .subscribe(() => this.getProductList());
  }

  openProductEditialog(product: Product) {
    this.dialogService
      .openDialog(ProductDetailsDialogComponent, { type: "edit", product: product })
      .subscribe(() => this.getProductList());
  }

  
}
