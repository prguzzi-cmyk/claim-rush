import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'rin-time-filter',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tf-wrap">
      <button
        *ngFor="let r of ranges"
        [class.tf-active]="r === value"
        (click)="pick(r)">{{ r }}</button>
      <button class="tf-clear" (click)="cleared.emit()">&#x2715; Clear</button>
    </div>
  `,
  styles: [`
    :host { display: contents; }

    .tf-wrap {
      all: unset;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px;
      margin-left: auto;
      background: #111827;
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 10px;
    }

    button {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 7px 18px;
      min-width: 44px;
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 0.875rem;
      font-weight: 600;
      line-height: 1;
      letter-spacing: 0.02em;
      border-radius: 7px;
      cursor: pointer;
      user-select: none;
      transition: background 120ms ease;

      /* inactive */
      background: #2A3A4F;
      color: #F9FAFB;
      border: 1px solid rgba(255,255,255,0.25);
    }

    button:hover:not(.tf-active):not(.tf-clear) {
      background: #354d68;
    }

    button.tf-active {
      background: #00C2FF;
      color: #0B0F14;
      border-color: #00C2FF;
    }

    .tf-clear {
      background: transparent;
      border-color: transparent;
      color: #9CA3AF;
      font-weight: 500;
      font-size: 0.8125rem;
      margin-left: 8px;
      padding: 7px 12px;
      min-width: 0;
    }

    .tf-clear:hover {
      color: #F9FAFB;
    }
  `],
})
export class TimeFilterComponent {
  @Input() value = '7d';
  @Output() valueChange = new EventEmitter<string>();
  @Output() cleared = new EventEmitter<void>();

  readonly ranges = ['24h', '7d', '30d'];

  pick(r: string): void {
    this.value = r;
    this.valueChange.emit(r);
  }
}
