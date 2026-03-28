import { Component, OnInit } from '@angular/core';
import {MatDialogRef} from "@angular/material/dialog";
import {DomSanitizer, SafeResourceUrl} from "@angular/platform-browser";

@Component({
    selector: 'app-team-mgr-override-graph-component',
    templateUrl: './team-mgr-override-graph-component.component.html',
    styleUrls: ['./team-mgr-override-graph-component.component.scss'],
    standalone: false
})
export class TeamMgrOverrideGraphComponentComponent implements OnInit {

  constructor(public dialogRef: MatDialogRef<TeamMgrOverrideGraphComponentComponent>,
              private sanitizer: DomSanitizer) { }

  teamMgrOverrideImgUrl: SafeResourceUrl;

  ngOnInit(): void {
    console.log("TeamMgrOverrideGraphComponentComponent ......");
    this.teamMgrOverrideImgUrl = this.sanitizer.bypassSecurityTrustResourceUrl("assets/img/mlm/HierarchyLevels.pdf");
  }

  closeDialog(): void {
    this.dialogRef.close();
  }
}
