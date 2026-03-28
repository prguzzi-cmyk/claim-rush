import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Category } from 'src/app/models/category.model';
import { Product } from 'src/app/models/product.model';
import { CategoryService } from 'src/app/services/category.service';
import { ProductService } from 'src/app/services/product.service';

@Component({
    selector: 'app-product-details-dialog',
    templateUrl: './product-details-dialog.component.html',
    styleUrls: ['./product-details-dialog.component.scss'],
    standalone: false
})
export class ProductDetailsDialogComponent implements OnInit {
  type: string;
  productForm = new FormGroup({
    name: new FormControl("", [Validators.required]),
    category_id: new FormControl(""),
    original_price: new FormControl("", [Validators.required]),
    price: new FormControl("", [Validators.required]),
    description: new FormControl("", [Validators.required]),
  });
  filename: string | undefined;
  file: File | undefined;
  fileType: string | undefined;
  cates: Category[] = [{ id: '', name: '/' }];
  product: Product;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private productService: ProductService,
    private categoryService: CategoryService,
    private dialogRef: MatDialogRef<ProductDetailsDialogComponent>,
    private snackBar: MatSnackBar,
  ) {
    if (!data) {
      return
    }

    this.type = data.type
    if (this.type === 'add') {
      this.getAllCategory()
    }
    else if (this.type === 'delete') {
      this.product = data.product
    }
    else if (this.type === 'edit') {
      this.getAllCategory()
      this.product = data.product
      if (this.product.category_id===null){
        this.product.category_id = ''
      }
      this.productForm.get('name').setValue(this.product.name)
      this.productForm.get('category_id').setValue(this.product.category_id)
      this.productForm.get('original_price').setValue(this.product.original_price.toString())
      this.productForm.get('price').setValue(this.product.price.toString())
      this.productForm.get('description').setValue(this.product.description)
    }
  }

  addProduct(): void {
    const formData = new FormData();
    formData.append('file', this.file);
    formData.append('file_name', this.filename);
    formData.append('description', this.productForm.get('description').value);
    formData.append('category_id', this.productForm.get('category_id').value);
    formData.append('name', this.productForm.get('name').value);
    formData.append('original_price', this.productForm.get('original_price').value);
    formData.append('price', this.productForm.get('price').value);

    this.productService.createProduct(formData).subscribe(resp => {
      this.dialogRef.close();

      this.snackBar.open("Product added", "Close", {
        duration: 5000,
        horizontalPosition: "end",
        verticalPosition: "bottom",
      });
    })
  }

  updateProduct(): void {
    const formData = new FormData(); 
    formData.append('file', this.file);
    formData.append('file_name', this.filename);
    formData.append('description', this.productForm.get('description').value);
    formData.append('category_id', this.productForm.get('category_id').value);
    formData.append('name', this.productForm.get('name').value);
    formData.append('original_price', this.productForm.get('original_price').value);
    formData.append('price', this.productForm.get('price').value);

    this.productService.updateProduct(this.product.id, formData).subscribe(resp => {
      this.dialogRef.close();

      this.snackBar.open("Product updated", "Close", {
        duration: 5000,
        horizontalPosition: "end",
        verticalPosition: "bottom",
      });
    })
  }

  ngOnInit(): void {
  }

  getAllCategory(): void {
    this.categoryService.getAllCategoryList().subscribe((allCates: Category[]) => {
      allCates.filter(c => c.parent_id === null).forEach(c => {
        c.name = '/' + c.name
        this.cates.push(c)
        this.addChildCategory(allCates, c.id, c.name)
      })
    })
  }

  addChildCategory(allCates: Category[], parent_id: string, parent_name: string) {
    allCates.filter(f => f.parent_id === parent_id).forEach(c => {
      c.name = parent_name + "/" + c.name
      this.cates.push(c)
      this.addChildCategory(allCates, c.id, c.name)
    })
  }

  selectFile(event: any) {
    this.file = event.target.files[0];
    this.filename = this.file?.name;
    this.fileType = this.file?.type;
  }

  deleteProduct(id: string) {
    this.productService.deleteProduct(id).subscribe(() => {
      this.dialogRef.close();
      this.snackBar.open("Product has been deleted.", "Close", {
        duration: 5000,
        horizontalPosition: "end",
        verticalPosition: "bottom",
      });
    },
      (error) => {

      }
    );
  }
}
