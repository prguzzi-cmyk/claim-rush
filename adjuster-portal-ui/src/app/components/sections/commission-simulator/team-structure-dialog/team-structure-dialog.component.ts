import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA} from "@angular/material/dialog";
import {MatTableDataSource} from "@angular/material/table";

@Component({
    selector: 'app-team-structure-dialog',
    templateUrl: './team-structure-dialog.component.html',
    styleUrls: ['./team-structure-dialog.component.scss'],
    standalone: false
})
export class TeamStructureDialogComponent implements OnInit {

  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {
  }

  ngOnInit(): void {
  }
}
