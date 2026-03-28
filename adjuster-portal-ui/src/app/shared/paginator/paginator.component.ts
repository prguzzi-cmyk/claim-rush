import { Component, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';

@Component({
    selector: 'app-paginator',
    templateUrl: './paginator.component.html',
    styleUrls: ['./paginator.component.scss'],
    standalone: false
})
export class PaginatorComponent {
  @Input() totalItems: number;
  @Input() pageSizeOptions: number[] = [10, 25, 50, 100, 500];
  @Output() pageChange = new EventEmitter<{ pageIndex: number, pageSize: number }>();

  @ViewChild(MatPaginator) paginator: MatPaginator;

  constructor() { }

  onPageChange(event) {
    this.pageChange.emit({ pageIndex: event.pageIndex + 1, pageSize: event.pageSize });
  }
}
