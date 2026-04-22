import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnInit,
  Renderer2,
  SimpleChanges,
  forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Currency input directive. Apply to a text input to get:
 *
 *   - Display:  "$80,000" / "$80,000.00" (Intl.NumberFormat en-US, USD)
 *   - On focus: strips formatting, shows the raw number (e.g. "80000")
 *   - On blur:  re-formats for display
 *   - Model:    plain number (e.g. 80000.00) — what ngModel / FormControl
 *               sees on read AND what the submit payload sends.
 *
 * Usage in template:
 *
 *     <input appCurrency type="text" inputmode="decimal"
 *            [(ngModel)]="form.estimate_amount"
 *            [currencyMax]="10000000" [currencyMin]="0" />
 *
 * Keeping the input type="text" lets us control the displayed string
 * while the directive maintains a separate numeric model. The global
 * spinner-suppression CSS handles legacy type="number" inputs
 * elsewhere in the app that haven't opted into this directive yet
 * (Record Settlement / Issue Advance / Issue Payout).
 */
@Directive({
  selector: 'input[appCurrency]',
  standalone: false,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CurrencyInputDirective),
      multi: true,
    },
  ],
})
export class CurrencyInputDirective implements ControlValueAccessor, OnInit, OnChanges {
  @Input() currencyMin: number = 0;
  @Input() currencyMax: number = 10_000_000;  // $10M sanity cap
  @Input() currencyFractionDigits: 0 | 2 = 2;

  private value: number | null = null;
  private focused = false;
  private onChange: (v: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(
    private readonly el: ElementRef<HTMLInputElement>,
    private readonly renderer: Renderer2,
  ) {}

  ngOnInit(): void {
    // Best-effort: nudge the native input toward decimal-friendly mobile
    // keyboards. Consumer templates should set inputmode="decimal"
    // explicitly too, in case the directive is applied post-render.
    if (!this.el.nativeElement.getAttribute('inputmode')) {
      this.renderer.setAttribute(this.el.nativeElement, 'inputmode', 'decimal');
    }
  }

  ngOnChanges(_changes: SimpleChanges): void {
    // Re-render if caps change while the value is displayed.
    if (!this.focused) this.render(this.value);
  }

  /** Format a number as "$X,XXX.XX" (or without cents if whole). */
  private format(n: number | null): string {
    if (n == null || isNaN(n)) return '';
    const fraction = Number.isInteger(n) ? 0 : this.currencyFractionDigits;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: fraction,
      maximumFractionDigits: this.currencyFractionDigits,
    }).format(n);
  }

  /** Strip anything non-numeric (except a single dot) back to a parseable string. */
  private stripFormatting(raw: string): string {
    // First pass: drop everything except digits and decimal points.
    let out = raw.replace(/[^\d.]/g, '');
    // Keep only the first dot — multiple dots make the number ambiguous.
    const firstDot = out.indexOf('.');
    if (firstDot !== -1) {
      out = out.slice(0, firstDot + 1) + out.slice(firstDot + 1).replace(/\./g, '');
    }
    return out;
  }

  private parse(raw: string): number | null {
    const stripped = this.stripFormatting(raw);
    if (!stripped) return null;
    const n = Number(stripped);
    if (isNaN(n)) return null;
    // Clamp to caps.
    return Math.min(Math.max(n, this.currencyMin), this.currencyMax);
  }

  /** Push a value into the DOM according to focus state. */
  private render(n: number | null): void {
    const input = this.el.nativeElement;
    if (this.focused) {
      input.value = n == null ? '' : String(n);
    } else {
      input.value = this.format(n);
    }
  }

  // ─── ControlValueAccessor ───────────────────────────────────────────

  writeValue(v: number | string | null): void {
    this.value = v == null || v === '' ? null : Number(v);
    this.render(this.value);
  }

  registerOnChange(fn: (v: number | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }

  setDisabledState(disabled: boolean): void {
    this.renderer.setProperty(this.el.nativeElement, 'disabled', disabled);
  }

  // ─── DOM events ─────────────────────────────────────────────────────

  @HostListener('focus')
  onFocus(): void {
    this.focused = true;
    this.render(this.value);
    // Select-all so typing replaces rather than appending.
    setTimeout(() => this.el.nativeElement.select(), 0);
  }

  @HostListener('blur')
  onBlur(): void {
    this.focused = false;
    this.render(this.value);
    this.onTouched();
  }

  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.value = this.parse(raw);
    this.onChange(this.value);
  }
}
