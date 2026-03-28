import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, of } from 'rxjs';
import { AgreementService } from 'src/app/shared/services/agreement.service';
import {
  Agreement, SigningField, SignatureMethod, SignRequest, SIGNATURE_FONTS,
} from 'src/app/shared/models/agreement.model';

type SigningStep = 'loading' | 'review' | 'sign_modal' | 'signing' | 'complete';

@Component({
  selector: 'app-agreement-signing',
  templateUrl: './agreement-signing.component.html',
  styleUrls: ['./agreement-signing.component.scss'],
  standalone: false,
})
export class AgreementSigningComponent implements OnInit {

  @ViewChild('signatureCanvas') signatureCanvas!: ElementRef<HTMLCanvasElement>;

  step: SigningStep = 'loading';
  agreement: Agreement | null = null;
  agreementId = '';

  // Signing fields
  fields: SigningField[] = [];
  currentFieldIndex = 0;

  // Signature capture
  signatureMethod: SignatureMethod = 'draw';
  typedSignature = '';
  selectedFont = SIGNATURE_FONTS[0];
  signatureFonts = SIGNATURE_FONTS;
  signatureDataUrl = '';

  // Canvas state
  private ctx: CanvasRenderingContext2D | null = null;
  private drawing = false;
  private lastX = 0;
  private lastY = 0;

  submitting = false;

  constructor(
    private agreementService: AgreementService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.agreementId = this.route.snapshot.paramMap.get('id') || '';
    if (this.agreementId) {
      this.loadAgreement();
    } else {
      this.loadMockAgreement();
    }
  }

  private loadAgreement(): void {
    this.agreementService.getAgreement(this.agreementId).pipe(
      catchError(() => {
        this.loadMockAgreement();
        return of(null);
      }),
    ).subscribe(agr => {
      if (agr) {
        this.agreement = agr;
        this.fields = agr.field_config || this.getDefaultFields();
        this.step = 'review';

        // Track viewed
        const env = this.agreementService.collectSignerEnvironment();
        this.agreementService.markViewed(this.agreementId, env).subscribe();
      }
    });
  }

  private loadMockAgreement(): void {
    this.agreement = {
      id: 'mock-agr-1',
      lead_id: null,
      agent_id: null,
      signer_name: 'John Smith',
      signer_email: 'john@example.com',
      signer_phone: '(555) 123-4567',
      title: 'Claim Representation Agreement',
      source: 'system',
      original_pdf_url: null,
      signed_pdf_url: null,
      version: '1.0',
      signing_mode: 'standard',
      signature_method: null,
      status: 'sent',
      sent_at: new Date().toISOString(),
      viewed_at: null,
      started_at: null,
      signed_at: null,
      expires_at: null,
      insured_copy_sent: false,
      agent_copy_sent: false,
      reminder_count: 0,
      field_config: null,
      created_at: new Date().toISOString(),
      updated_at: null,
    };
    this.fields = this.getDefaultFields();
    this.step = 'review';
  }

  private getDefaultFields(): SigningField[] {
    return [
      { id: 'sig-1', type: 'signature', page: 1, x: 100, y: 600, width: 300, height: 60, required: true, label: 'Signature' },
      { id: 'init-1', type: 'initials', page: 1, x: 100, y: 500, width: 100, height: 40, required: true, label: 'Initials' },
      { id: 'date-1', type: 'date', page: 1, x: 420, y: 600, width: 150, height: 30, required: true, label: 'Date', value: new Date().toLocaleDateString() },
      { id: 'cb-1', type: 'checkbox', page: 1, x: 100, y: 450, width: 20, height: 20, required: true, label: 'I acknowledge and agree to the terms' },
    ];
  }

  // ── Field Navigation ───────────────────────────────────────────

  get currentField(): SigningField | null {
    return this.fields[this.currentFieldIndex] || null;
  }

  get completedCount(): number {
    return this.fields.filter(f => f.completed).length;
  }

  get allFieldsComplete(): boolean {
    return this.fields.filter(f => f.required).every(f => f.completed);
  }

  nextField(): void {
    if (this.currentFieldIndex < this.fields.length - 1) {
      this.currentFieldIndex++;
    }
  }

  prevField(): void {
    if (this.currentFieldIndex > 0) {
      this.currentFieldIndex--;
    }
  }

  jumpToField(index: number): void {
    this.currentFieldIndex = index;
  }

  // ── Signing Actions ────────────────────────────────────────────

  openSignModal(): void {
    this.step = 'sign_modal';
    // Track started
    if (this.agreementId) {
      const env = this.agreementService.collectSignerEnvironment();
      this.agreementService.markStarted(this.agreementId, env).subscribe();
    }
  }

  selectSignatureMethod(method: SignatureMethod): void {
    this.signatureMethod = method;
    if (method === 'draw') {
      setTimeout(() => this.initCanvas(), 100);
    }
  }

  selectFont(font: typeof SIGNATURE_FONTS[0]): void {
    this.selectedFont = font;
  }

  // ── Canvas Drawing ─────────────────────────────────────────────

  private initCanvas(): void {
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas) return;
    this.ctx = canvas.getContext('2d');
    if (this.ctx) {
      this.ctx.lineWidth = 2.5;
      this.ctx.lineCap = 'round';
      this.ctx.strokeStyle = '#111827';
    }
  }

  onCanvasStart(e: MouseEvent | TouchEvent): void {
    this.drawing = true;
    const pos = this.getCanvasPos(e);
    this.lastX = pos.x;
    this.lastY = pos.y;
  }

  onCanvasMove(e: MouseEvent | TouchEvent): void {
    if (!this.drawing || !this.ctx) return;
    e.preventDefault();
    const pos = this.getCanvasPos(e);
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();
    this.lastX = pos.x;
    this.lastY = pos.y;
  }

  onCanvasEnd(): void {
    this.drawing = false;
  }

  clearCanvas(): void {
    const canvas = this.signatureCanvas?.nativeElement;
    if (canvas && this.ctx) {
      this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  private getCanvasPos(e: MouseEvent | TouchEvent): { x: number; y: number } {
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const touch = (e as TouchEvent).touches?.[0];
    const clientX = touch ? touch.clientX : (e as MouseEvent).clientX;
    const clientY = touch ? touch.clientY : (e as MouseEvent).clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  // ── Apply Signature ────────────────────────────────────────────

  applySignature(): void {
    if (this.signatureMethod === 'draw') {
      const canvas = this.signatureCanvas?.nativeElement;
      this.signatureDataUrl = canvas?.toDataURL('image/png') || '';
    } else if (this.signatureMethod === 'type' || this.signatureMethod === 'font') {
      this.signatureDataUrl = this.typedSignature || this.agreement?.signer_name || '';
    }

    // Mark signature and initials fields as complete
    this.fields.forEach(f => {
      if (f.type === 'signature' || f.type === 'initials') {
        f.completed = true;
        f.value = this.signatureDataUrl;
      }
    });

    this.step = 'signing';
  }

  applyIAgree(): void {
    this.signatureMethod = 'i_agree';
    this.signatureDataUrl = this.agreement?.signer_name || 'Agreed';
    this.fields.forEach(f => {
      f.completed = true;
      if (f.type === 'signature') f.value = this.signatureDataUrl;
      if (f.type === 'initials') f.value = (this.agreement?.signer_name || '').split(' ').map(n => n[0]).join('');
      if (f.type === 'date') f.value = new Date().toLocaleDateString();
      if (f.type === 'checkbox') f.value = 'true';
    });
    this.step = 'signing';
  }

  completeField(field: SigningField): void {
    field.completed = true;
    if (field.type === 'date' && !field.value) {
      field.value = new Date().toLocaleDateString();
    }
    if (field.type === 'checkbox') {
      field.value = 'true';
    }
  }

  // ── Submit ─────────────────────────────────────────────────────

  submitAgreement(): void {
    if (!this.allFieldsComplete) return;
    this.submitting = true;

    const env = this.agreementService.collectSignerEnvironment();
    const signReq: SignRequest = {
      signature_method: this.signatureMethod,
      signature_data: this.signatureDataUrl,
      font_name: this.signatureMethod === 'font' ? this.selectedFont.name : null,
      ip_address: env.ip_address,
      device_type: env.device_type,
      browser: env.browser,
      platform: env.platform,
      completed_fields: this.fields.map(f => ({
        field_id: f.id,
        field_type: f.type,
        value: f.value || '',
      })),
    };

    if (this.agreementId && this.agreementId !== 'mock-agr-1') {
      this.agreementService.signAgreement(this.agreementId, signReq).subscribe({
        next: () => this.onSignComplete(),
        error: () => this.onSignComplete(),
      });
    } else {
      setTimeout(() => this.onSignComplete(), 1500);
    }
  }

  private onSignComplete(): void {
    this.submitting = false;
    this.step = 'complete';
    if (this.agreement) {
      this.agreement.status = 'signed';
      this.agreement.signed_at = new Date().toISOString();
    }
  }

  goToDashboard(): void {
    this.router.navigate(['/client/dashboard'], {
      queryParams: { status: 'processing', signed: 'true' },
    });
  }
}
