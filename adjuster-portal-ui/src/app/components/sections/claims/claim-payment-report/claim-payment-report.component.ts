import { DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ClaimService } from 'src/app/services/claim.service';
import { TabService } from 'src/app/services/tab.service';
import { UserService } from 'src/app/services/user.service';

@Component({
    selector: 'app-claim-payment-report',
    templateUrl: './claim-payment-report.component.html',
    styleUrls: ['./claim-payment-report.component.scss'],
    standalone: false
})

export class ClaimPaymentReportComponent implements OnInit {

  payments: any;

  displayedColumns: string[] = [
    'sn',
    'ref_string',
    'client',
    'payment_date',
    'check_amount',
    'contingency_fee_percentage',
    'appraisal_fee',
    'umpire_fee',
    'mold_fee',
    'misc_fee',
    'check_ref_number',
    'check_type'
  ];

  constructor(
    private claimService: ClaimService,
    public userService: UserService,
    private tabService: TabService

  ) {

    const today = new Date();
    const lastMonth = new Date(today.setMonth(today.getMonth() - 1));

    // Format the date to 'YYYY-MM-DD'
    const formattedDate = lastMonth.toISOString().split('T')[0];

    this.claimService.getClaimPaymentsReady(1, 500, formattedDate).subscribe(
      (payments) => {
        this.payments = payments.items;
      });
  }

  ngOnInit(): void {
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  onClaimDetail(id: string, name: string) {
    this.tabService.addItem({ id, name, type: "claim" });
  }

  onClientDetail(id: string, name: string) {
    this.tabService.addItem({ id, name, type: "client" });
  }

}
