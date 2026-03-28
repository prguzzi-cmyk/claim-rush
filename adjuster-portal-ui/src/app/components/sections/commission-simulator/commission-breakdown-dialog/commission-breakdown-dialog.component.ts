import { Component, OnInit } from '@angular/core';

@Component({
    selector: 'app-commission-breakdown-dialog',
    templateUrl: './commission-breakdown-dialog.component.html',
    styleUrls: ['./commission-breakdown-dialog.component.scss'],
    standalone: false
})
export class CommissionBreakdownDialogComponent implements OnInit {

  constructor() { }

  commissionBreakdownImgUrl : string = 'assets/img/mlm/commission-breakdown.png';

  ngOnInit(): void {
  }

}
