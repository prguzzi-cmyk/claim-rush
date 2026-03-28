import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { CategoryService } from 'src/app/services/category.service';
import { Category } from 'src/app/models/category.model';
import { MatSnackBar } from '@angular/material/snack-bar';
import { error } from 'console';


@Component({
    selector: 'app-category-details-dialog',
    templateUrl: './category-details-dialog.component.html',
    styleUrls: ['./category-details-dialog.component.scss'],
    standalone: false
})
export class CategoryDetailsDialogComponent implements OnInit {
  type: string;
  items: Category[] = [{ id: "", name: '/' }]
  cateForm = new FormGroup({
    name: new FormControl("", [Validators.required]),
    parentId: new FormControl(""),
  });
  category: Category

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private categoryService: CategoryService,
    private dialogRef: MatDialogRef<CategoryDetailsDialogComponent>,
    private snackBar: MatSnackBar,
  ) {
    if (!data) {
      return
    }

    this.type = data.type
    if (this.type === 'delete') {
      this.category = data.category
    } else if (this.type === 'add') {
      this.getAllCategory()
    } else if (this.type === 'edit') {
      this.getAllCategory()
      this.category = data.category
      this.cateForm.controls['name'].setValue(this.category.name)
      this.cateForm.controls['parentId'].setValue(this.category.parent_id ?? "")
    }
  }

  ngOnInit(): void {
  }

  updateCategory(): void {
    const category = new Category()
    category.name = this.cateForm.controls['name'].value
    category.parent_id = this.cateForm.controls['parentId'].value
    if (!category.parent_id) {
      category.parent_id = null
    }
    category.id = this.category.id

    this.categoryService.updateCategory(category).subscribe(() => {
      this.dialogRef.close();

      this.snackBar.open("Category updated", "Close", {
        duration: 5000,
        horizontalPosition: "end",
        verticalPosition: "bottom",
      });
    }, (error) => {

    })
  }

  getAllCategory(): void {
    this.categoryService.getAllCategoryList().subscribe((cates: Category[]) => {
      cates.filter(c => c.parent_id === null).forEach(c => {
        c.name = '/' + c.name
        this.items.push(c)
        this.addChildCategory(cates, c.id, c.name)
      })
    })
  }

  addChildCategory(cates: Category[], parent_id: string, parent_name: string) {
    cates.filter(f => f.parent_id === parent_id).forEach(c => {
      c.name = parent_name + "/" + c.name
      this.items.push(c)
      this.addChildCategory(cates, c.id, c.name)
    })
  }

  addCategory(): void {
    const category = new Category()
    category.name = this.cateForm.controls['name'].value
    category.parent_id = this.cateForm.controls['parentId'].value
    if (!category.parent_id) {
      category.parent_id = null
    }

    this.categoryService.createCategory(category).subscribe(() => {
      this.dialogRef.close();

      this.snackBar.open("Category added", "Close", {
        duration: 5000,
        horizontalPosition: "end",
        verticalPosition: "bottom",
      });
    }, (error) => {

    })
  }

  deleteCategory(id: string) {
    this.categoryService.deleteCategory(id).subscribe(() => {
      this.dialogRef.close();
      this.snackBar.open("Category has been deleted.", "Close", {
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
