import { Component, OnInit, ViewChild } from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import moment from 'moment';
import { NgxSpinnerService } from 'ngx-spinner';
import { CategoryDetailsDialogComponent } from 'src/app/components/dialogs/category-details-dialog/category-details-dialog.component';
import { Category } from 'src/app/models/category.model';
import { CategoryService } from 'src/app/services/category.service';
import { DialogService } from 'src/app/services/dialog.service';
import { TabService } from 'src/app/services/tab.service';

// type TreeNode = {
//   id: string;
//   parentId: string | null
// }

// type Tree = {
//   [id: string]: TreeNode;
// };



@Component({
    selector: 'app-category-list',
    templateUrl: './category-list.component.html',
    styleUrls: ['./category-list.component.scss'],
    standalone: false
})
export class CategoryListComponent implements OnInit {
  categories: Array<Category> = [];
  displayedColumns: string[] = [
    "id",
    "name",
    "parent_id",
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
    private dialogService: DialogService,
    private spinner: NgxSpinnerService,
    private categoryService: CategoryService
  ) {

  }

  ngOnInit(): void {
    this.getCategories()
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  getCategories() {
    this.spinner.show();
    this.categoryService.getAllCategoryList().subscribe(allCates => {
      this.categoryService.getCategoryList(this.pageIndex, this.pageSize).subscribe(resp => {
        this.spinner.hide()
        this.dataSource = new MatTableDataSource(resp.items);
        this.categories = resp.items;
        this.pageIndex = resp.page;
        this.totalRecords = resp.total;

        this.categories.forEach(cate => {
          cate.parent_path = buildCategoryPath(allCates, cate.parent_id)
        })
      })
    })
  }



  changePage(event: PageEvent) {

    this.pageIndex = event.pageIndex + 1;
    this.pageSize = event.pageSize;

    if (this.pageIndex == 0) {
      this.pageIndex = 1;
    }

    this.getCategories();

  }



  openCategoryAddDialog() {
    this.dialogService
      .openDialog(CategoryDetailsDialogComponent, { type: "add" })
      .subscribe(() => this.getCategories());
  }

  openCategoryDeleteDialog(category: Category) {
    this.dialogService
      .openDialog(CategoryDetailsDialogComponent, { type: "delete", category: category })
      .subscribe(() => this.getCategories());
  }

  openCategoryEditDialog(category: Category) {
    this.dialogService
      .openDialog(CategoryDetailsDialogComponent, { type: "edit", category: category })
      .subscribe(() => this.getCategories());
  }


}

function buildCategoryPath(categories: Category[], parentId: string | null): string {
  const categoryMap: { [id: string]: Category } = categories.reduce((map, category) => {
    map[category.id] = category;
    return map;
  }, {});

  const fullPath = []

  while (true) {
    if (parentId == null) {
      fullPath.push('/')
      break
    }
    const parentCate = categoryMap[parentId]
    fullPath.push(`${parentCate.name}/`)
    parentId = parentCate.parent_id
  }

  return fullPath.reverse().join("")
}

