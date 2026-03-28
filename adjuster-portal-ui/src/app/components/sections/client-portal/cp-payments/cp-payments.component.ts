import { Component, Input } from '@angular/core';
import { ClaimPayment } from 'src/app/models/client-portal.model';

@Component({
  selector: 'app-cp-payments',
  templateUrl: './cp-payments.component.html',
  styleUrls: ['./cp-payments.component.scss'],
  standalone: false,
})
export class CpPaymentsComponent {
  @Input() payments: ClaimPayment[] = [];

  displayedColumns = ['date', 'description', 'amount', 'status', 'method', 'referenceNumber'];

  get totalPaid(): number {
    return this.payments
      .filter(p => p.status === 'processed')
      .reduce((sum, p) => sum + p.amount, 0);
  }

  get totalPending(): number {
    return this.payments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0);
  }

  get estimatedRemaining(): number {
    return Math.max(0, 28750 - this.totalPaid - this.totalPending);
  }
}
