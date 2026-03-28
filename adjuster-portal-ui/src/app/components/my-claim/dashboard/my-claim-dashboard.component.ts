import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { MyClaimService, ClientProfile } from '../my-claim.service';
import {
  ClientClaim, ClaimDocument, ClaimPayment, MessageThread,
  ClaimNotification, CLAIM_STAGES,
} from 'src/app/models/client-portal.model';

interface ActivityItem {
  icon: string;
  color: string;
  label: string;
  detail: string;
  timestamp: string;
}

@Component({
  selector: 'app-my-claim-dashboard',
  templateUrl: './my-claim-dashboard.component.html',
  styleUrls: ['./my-claim-dashboard.component.scss'],
  standalone: false,
})
export class MyClaimDashboardComponent implements OnInit, OnDestroy {
  profile: ClientProfile | null = null;
  claim: ClientClaim | null = null;
  documents: ClaimDocument[] = [];
  payments: ClaimPayment[] = [];
  threads: MessageThread[] = [];
  notifications: ClaimNotification[] = [];
  stages = CLAIM_STAGES;

  selectedThread: MessageThread | null = null;
  newMessage = '';
  showUpload = false;

  // Processing state
  isProcessing = false;
  showProcessingBanner = true;
  showWelcomeStrip = true;

  // Live activity feed
  activityFeed: ActivityItem[] = [];

  // Estimate range
  estimateReady = false;
  estimateMin = 0;
  estimateMax = 0;

  // Stage helper descriptions (shown under current stage)
  private stageHelpers: Record<string, string> = {
    claim_reported: 'Information received',
    inspection_scheduled: 'Property review in progress',
    estimate_submitted: 'Scope and value being prepared',
    carrier_review: 'Claim package delivered',
    negotiation: 'Working to improve outcome',
    payment_issued: 'Payment received',
    claim_closed: 'Claim finalized',
  };

  private subs: Subscription[] = [];

  constructor(
    private svc: MyClaimService,
    private snackBar: MatSnackBar,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.subs.push(
      this.svc.getProfile().subscribe(p => this.profile = p),
      this.svc.getClaim().subscribe(c => {
        this.claim = c;
        if (c) {
          this.buildActivityFeed(c);
          this.buildEstimateRange(c);
          this.isProcessing = c.status === 'Processing Claim' || c.currentStage === 'inspection_scheduled';
        }
      }),
      this.svc.getDocuments().subscribe(d => this.documents = d),
      this.svc.getPayments().subscribe(p => this.payments = p),
      this.svc.getThreads().subscribe(t => this.threads = t),
      this.svc.getNotifications().subscribe(n => this.notifications = n),
    );

    // Check query params for processing state
    const status = this.route.snapshot.queryParamMap.get('status');
    if (status === 'processing') {
      this.isProcessing = true;
    }
  }

  ngOnDestroy(): void { this.subs.forEach(s => s.unsubscribe()); }

  // ── Activity Feed ──────────────────────────────────────────────

  private buildActivityFeed(c: ClientClaim): void {
    this.activityFeed = [];

    // Build from timeline events
    for (const event of c.timeline) {
      if (event.completed || (!event.completed && event.date)) {
        this.activityFeed.push({
          icon: event.icon,
          color: event.completed ? '#16a34a' : '#d97706',
          label: event.label,
          detail: event.description,
          timestamp: event.date || 'Pending',
        });
      }
    }

    // Add processing-specific items if in processing state
    if (this.isProcessing) {
      const now = new Date().toISOString();
      this.activityFeed.unshift(
        { icon: 'photo_camera', color: '#2563eb', label: 'Photos Received', detail: 'We received your uploaded property photos.', timestamp: now },
        { icon: 'smart_toy', color: '#7c3aed', label: 'Analysis Started', detail: 'Our system is reviewing the damage and organizing findings.', timestamp: now },
        { icon: 'calculate', color: '#d97706', label: 'Estimate In Progress', detail: 'Your repair estimate is being prepared based on the analysis.', timestamp: '' },
        { icon: 'event', color: '#9ca3af', label: 'Inspection Pending', detail: 'Inspection scheduling is still needed.', timestamp: '' },
      );
    }
  }

  // ── Estimate Range ─────────────────────────────────────────────

  private buildEstimateRange(c: ClientClaim): void {
    if (c.estimatedValue && c.estimatedValue > 0) {
      this.estimateReady = true;
      this.estimateMin = Math.round(c.estimatedValue * 0.85);
      this.estimateMax = Math.round(c.estimatedValue * 1.15);
    } else {
      this.estimateReady = false;
    }
  }

  // ── Adjuster ──
  get adjusterInitials(): string {
    if (!this.claim?.adjusterName) return '';
    return this.claim.adjusterName.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  // ── Claim Progress ──
  get currentStageIdx(): number {
    if (!this.claim) return -1;
    return CLAIM_STAGES.findIndex(s => s.key === this.claim!.currentStage);
  }

  get statusLabel(): string {
    if (!this.claim) return '';
    if (this.isProcessing) return 'Claim In Progress';
    return this.claim.currentPhase || this.claim.status || '';
  }

  get currentStageHelper(): string {
    if (!this.claim) return '';
    return this.stageHelpers[this.claim.currentStage] || '';
  }

  // ── Payments ──
  get totalPaid(): number {
    return this.payments.filter(p => p.status === 'processed').reduce((s, p) => s + p.amount, 0);
  }
  get totalPending(): number {
    return this.payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  }

  // ── Messages ──
  selectThread(t: MessageThread): void { this.selectedThread = t; }
  sendMessage(): void {
    if (!this.newMessage.trim() || !this.selectedThread) return;
    this.svc.sendMessage(this.selectedThread.id, this.newMessage.trim());
    this.newMessage = '';
    this.snackBar.open('Message sent', 'OK', { duration: 2500 });
  }
  getLastMessage(t: MessageThread): string {
    const m = t.messages[t.messages.length - 1];
    return m ? (m.body.length > 80 ? m.body.substring(0, 80) + '...' : m.body) : '';
  }

  // ── Documents ──
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const doc: ClaimDocument = {
      id: 'ud-' + Date.now(), name: file.name,
      type: file.name.split('.').pop()?.toUpperCase() || 'FILE',
      uploadedAt: new Date().toISOString().split('T')[0],
      size: file.size < 1048576 ? (file.size / 1024).toFixed(0) + ' KB' : (file.size / 1048576).toFixed(1) + ' MB',
      url: '#', category: 'photo', uploadedBy: 'client',
    };
    this.svc.addDocument(doc);
    this.snackBar.open(`"${file.name}" uploaded`, 'OK', { duration: 3000 });
    this.showUpload = false;
    input.value = '';
  }

  // ── Navigation ──
  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  dismissBanner(): void {
    this.showProcessingBanner = false;
  }

  dismissWelcome(): void {
    this.showWelcomeStrip = false;
  }

  // ── Helpers ──
  formatTime(ts: string): string {
    if (!ts) return 'Pending';
    const d = new Date(ts);
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  formatCurrency(v: number): string {
    return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
}
