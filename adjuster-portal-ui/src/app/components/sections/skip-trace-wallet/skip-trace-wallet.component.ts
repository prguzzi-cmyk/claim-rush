import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgxSpinnerService } from 'ngx-spinner';
import { SkiptraceWalletService } from 'src/app/services/skiptrace-wallet.service';
import {
  SkiptraceWalletSummary,
  SkiptraceTransaction,
  CreditPack,
  CREDIT_PACKS,
} from 'src/app/models/skiptrace-wallet.model';

@Component({
  selector: 'app-skip-trace-wallet',
  templateUrl: './skip-trace-wallet.component.html',
  styleUrls: ['./skip-trace-wallet.component.scss'],
  standalone: false,
})
export class SkipTraceWalletComponent implements OnInit {
  summary: SkiptraceWalletSummary | null = null;
  creditPacks: CreditPack[] = CREDIT_PACKS;
  purchasingPack: number | null = null;

  displayedColumns: string[] = ['created_at', 'action_type', 'lead_id', 'address_queried', 'credits_used', 'lookup_status'];
  dataSource = new MatTableDataSource<SkiptraceTransaction>([]);

  @ViewChild(MatSort) sort: MatSort;

  constructor(
    private walletService: SkiptraceWalletService,
    private snackBar: MatSnackBar,
    private spinner: NgxSpinnerService,
  ) {}

  ngOnInit(): void {
    this.loadBalance();
    this.loadTransactions();
  }

  loadBalance(): void {
    this.walletService.getBalance().subscribe({
      next: (data) => (this.summary = data),
      error: () => this.snackBar.open('Failed to load wallet balance', 'Close', { duration: 3000 }),
    });
  }

  loadTransactions(): void {
    this.spinner.show();
    this.walletService.getTransactions().subscribe({
      next: (data) => {
        this.dataSource.data = data;
        this.dataSource.sort = this.sort;
        this.spinner.hide();
      },
      error: () => {
        this.spinner.hide();
        this.snackBar.open('Failed to load transactions', 'Close', { duration: 3000 });
      },
    });
  }

  purchaseCredits(pack: CreditPack): void {
    this.purchasingPack = pack.size;
    this.walletService.purchaseCredits(pack.size).subscribe({
      next: (res) => {
        this.purchasingPack = null;
        this.summary = { ...this.summary!, credit_balance: res.new_balance };
        if (res.stripe_checkout_url) {
          this.snackBar.open(`Stripe checkout ready — ${res.credits_added} credits added. Balance: ${res.new_balance}`, 'OK', { duration: 5000 });
        } else {
          this.snackBar.open(`${res.credits_added} credits added! New balance: ${res.new_balance}`, 'OK', { duration: 4000 });
        }
      },
      error: () => {
        this.purchasingPack = null;
        this.snackBar.open('Purchase failed — please try again', 'Close', { duration: 3000 });
      },
    });
  }

  priceDisplay(cents: number): string {
    return '$' + (cents / 100).toFixed(0);
  }

  perCreditCost(pack: CreditPack): string {
    return '$' + (pack.price_cents / 100 / pack.size).toFixed(2);
  }

  statusColor(status: string): string {
    switch (status) {
      case 'success': return 'green';
      case 'failed': return 'red';
      case 'no_results': return 'amber';
      default: return '';
    }
  }
}
