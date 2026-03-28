import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  ClientClaim,
  ClaimDocument,
  ClaimPayment,
  MessageThread,
  ClaimReport,
  ClaimNotification,
  CLAIM_STAGES,
} from 'src/app/models/client-portal.model';

@Component({
  selector: 'app-client-portal',
  templateUrl: './client-portal.component.html',
  styleUrls: ['./client-portal.component.scss'],
  standalone: false,
})
export class ClientPortalComponent implements OnInit {
  claimStages = CLAIM_STAGES;
  claim: ClientClaim;
  documents: ClaimDocument[] = [];
  payments: ClaimPayment[] = [];
  threads: MessageThread[] = [];
  reports: ClaimReport[] = [];
  notifications: ClaimNotification[] = [];
  unreadCount = 0;
  activeTab = 0;

  // Processing state — shown when arriving from capture flow
  showProcessingBanner = false;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.loadMockData();
    this.unreadCount = this.notifications.filter(n => !n.read).length;

    // Check if arriving from capture flow
    this.route.queryParams.subscribe(params => {
      if (params['status'] === 'processing') {
        this.showProcessingBanner = true;
        this.claim.status = 'Processing Claim';
        this.claim.currentStage = 'inspection_scheduled';
      }
    });
  }

  dismissProcessingBanner(): void {
    this.showProcessingBanner = false;
  }

  markNotificationRead(id: string): void {
    const n = this.notifications.find(x => x.id === id);
    if (n) { n.read = true; this.unreadCount = this.notifications.filter(x => !x.read).length; }
  }

  markAllRead(): void {
    this.notifications.forEach(n => n.read = true);
    this.unreadCount = 0;
  }

  getStageIndex(stage: string): number {
    return CLAIM_STAGES.findIndex(s => s.key === stage);
  }

  private loadMockData(): void {
    this.claim = {
      id: '1',
      claimNumber: 'CLM-2024-00847',
      status: 'In Review',
      type: 'Residential – Wind Damage',
      dateOfLoss: '2024-09-14',
      dateOpened: '2024-09-16',
      adjusterName: 'Marcus Rivera',
      adjusterPhone: '(407) 555-0188',
      adjusterEmail: 'mrivera@upagroup.com',
      description: 'Wind damage to roof shingles, soffit, and fascia from tropical storm. Partial interior water intrusion in master bedroom and hallway.',
      propertyAddress: '4218 Magnolia Blvd',
      city: 'Orlando',
      state: 'FL',
      zip: '32806',
      estimatedValue: 28750,
      currentPhase: 'Carrier Review',
      currentStage: 'carrier_review',
      timeline: [
        { date: '2024-09-16', label: 'Intake Completed', description: 'Claim filed by homeowner via online intake.', icon: 'assignment', completed: true },
        { date: '2024-09-17', label: 'Adjuster Assigned', description: 'Assigned to adjuster Marcus Rivera.', icon: 'person_add', completed: true },
        { date: '2024-09-22', label: 'Inspection Completed', description: 'On-site inspection completed. Damage documented with 42 photos.', icon: 'search', completed: true },
        { date: '2024-10-01', label: 'Estimate Submitted', description: 'Repair estimate prepared and submitted to carrier — $28,750.', icon: 'calculate', completed: true },
        { date: '2024-10-10', label: 'Carrier Review', description: 'Estimate under carrier review. Expected response within 15 days.', icon: 'rate_review', completed: false },
        { date: '', label: 'Supplement', description: 'Pending — additional items may be supplemented.', icon: 'add_circle', completed: false },
        { date: '', label: 'Payment Issued', description: 'Pending settlement approval and payment.', icon: 'payments', completed: false },
        { date: '', label: 'Closed', description: 'Claim will be closed after final payment.', icon: 'check_circle', completed: false },
      ],
    };

    this.documents = [
      { id: '1', name: 'Policy Declaration Page', type: 'PDF', uploadedAt: '2024-09-16', size: '245 KB', url: '#', category: 'policy', uploadedBy: 'client' },
      { id: '2', name: 'Initial Repair Estimate', type: 'PDF', uploadedAt: '2024-10-01', size: '1.2 MB', url: '#', category: 'estimate', uploadedBy: 'adjuster' },
      { id: '3', name: 'Roof Damage — Front Elevation', type: 'JPG', uploadedAt: '2024-09-22', size: '3.4 MB', url: '#', category: 'photo', uploadedBy: 'adjuster' },
      { id: '4', name: 'Roof Damage — Rear Elevation', type: 'JPG', uploadedAt: '2024-09-22', size: '2.9 MB', url: '#', category: 'photo', uploadedBy: 'adjuster' },
      { id: '5', name: 'Interior Water Damage — Master Bedroom', type: 'JPG', uploadedAt: '2024-09-22', size: '2.1 MB', url: '#', category: 'photo', uploadedBy: 'client' },
      { id: '6', name: 'Hallway Ceiling Damage', type: 'JPG', uploadedAt: '2024-10-02', size: '1.8 MB', url: '#', category: 'photo', uploadedBy: 'client' },
      { id: '7', name: 'Supplement Request Letter', type: 'PDF', uploadedAt: '2024-10-08', size: '98 KB', url: '#', category: 'supplement', uploadedBy: 'adjuster' },
      { id: '8', name: 'Carrier Acknowledgment Letter', type: 'PDF', uploadedAt: '2024-10-12', size: '65 KB', url: '#', category: 'correspondence', uploadedBy: 'system' },
    ];

    this.payments = [
      { id: '1', date: '2024-09-20', amount: 5000, description: 'Emergency Mitigation Advance', status: 'processed', method: 'Direct Deposit', referenceNumber: 'PAY-2024-1101', payerName: 'State Farm Insurance' },
      { id: '2', date: '2024-10-05', amount: 12500, description: 'Partial Roof Repair — First Draw', status: 'processed', method: 'Check', referenceNumber: 'PAY-2024-1234', payerName: 'State Farm Insurance' },
      { id: '3', date: '2024-10-12', amount: 8750, description: 'Interior Restoration — Second Draw', status: 'pending', method: 'Direct Deposit', referenceNumber: 'PAY-2024-1340', payerName: 'State Farm Insurance' },
      { id: '4', date: '2024-10-12', amount: 2500, description: 'Supplemental Claim — Soffit Repair', status: 'denied', method: 'Check', referenceNumber: 'PAY-2024-1341', payerName: 'State Farm Insurance' },
    ];

    this.threads = [
      {
        id: '1', subject: 'Inspection Follow-Up', lastMessageAt: '2024-10-09T14:32:00', unread: true,
        messages: [
          { id: '1', senderName: 'Marcus Rivera', senderRole: 'adjuster', body: 'Hi, I completed the on-site inspection on 9/22. I wanted to follow up with some findings and next steps for your claim.', timestamp: '2024-09-23T09:15:00' },
          { id: '2', senderName: 'You', senderRole: 'client', body: 'Thank you Marcus. I noticed additional damage in the hallway ceiling that appeared after the heavy rain last week. Should I document it?', timestamp: '2024-10-01T11:20:00' },
          { id: '3', senderName: 'Marcus Rivera', senderRole: 'adjuster', body: 'Absolutely — please take photos and upload them to the Documents tab. I\'ll include it in the supplement request to the carrier.', timestamp: '2024-10-09T14:32:00' },
        ],
      },
      {
        id: '2', subject: 'Payment Notification', lastMessageAt: '2024-10-05T08:00:00', unread: false,
        messages: [
          { id: '4', senderName: 'System', senderRole: 'system', body: 'A payment of $12,500.00 for "Partial Roof Repair — First Draw" has been issued via check. Reference: PAY-2024-1234. Please allow 5–7 business days for delivery.', timestamp: '2024-10-05T08:00:00' },
        ],
      },
      {
        id: '3', subject: 'Carrier Review Update', lastMessageAt: '2024-10-10T10:00:00', unread: true,
        messages: [
          { id: '5', senderName: 'Marcus Rivera', senderRole: 'adjuster', body: 'I wanted to let you know that we submitted your estimate to the carrier on October 1st. They have 15 business days to respond. I\'ll keep you updated on any developments.', timestamp: '2024-10-10T10:00:00' },
        ],
      },
    ];

    this.reports = [
      { id: '1', name: 'Initial Claim Report', type: 'claim_report', generatedAt: '2024-09-23', size: '2.4 MB', url: '#' },
      { id: '2', name: 'Inspection Report — Property Assessment', type: 'inspection_report', generatedAt: '2024-09-24', size: '5.1 MB', url: '#' },
      { id: '3', name: 'Repair Estimate Report', type: 'estimate_report', generatedAt: '2024-10-01', size: '1.8 MB', url: '#' },
      { id: '4', name: 'Supplement Report — Additional Damage', type: 'supplement_report', generatedAt: '2024-10-08', size: '1.2 MB', url: '#' },
    ];

    this.notifications = [
      { id: '1', title: 'Claim Status Updated', message: 'Your claim has moved to Carrier Review. The carrier has 15 business days to respond to the estimate.', type: 'status_change', timestamp: '2024-10-10T10:00:00', read: false, icon: 'update', relatedStage: 'carrier_review' },
      { id: '2', title: 'New Message from Adjuster', message: 'Marcus Rivera sent you a message about the carrier review process.', type: 'message', timestamp: '2024-10-10T10:05:00', read: false, icon: 'chat', relatedStage: null },
      { id: '3', title: 'Supplement Report Generated', message: 'A supplement report for additional damage has been generated and is available in the Reports tab.', type: 'document', timestamp: '2024-10-08T15:00:00', read: false, icon: 'description', relatedStage: 'negotiation' },
      { id: '4', title: 'Payment Issued', message: 'A payment of $12,500.00 for "Partial Roof Repair — First Draw" has been issued via check.', type: 'payment', timestamp: '2024-10-05T08:00:00', read: true, icon: 'payments', relatedStage: 'payment_issued' },
      { id: '5', title: 'Estimate Submitted', message: 'Your repair estimate of $28,750 has been submitted to the insurance carrier for review.', type: 'status_change', timestamp: '2024-10-01T14:00:00', read: true, icon: 'send', relatedStage: 'estimate_submitted' },
      { id: '6', title: 'Inspection Completed', message: 'On-site inspection completed. 42 photos documented. Your adjuster will prepare the estimate next.', type: 'status_change', timestamp: '2024-09-22T16:30:00', read: true, icon: 'check_circle', relatedStage: 'inspection_scheduled' },
      { id: '7', title: 'Emergency Payment Issued', message: 'A mitigation advance of $5,000.00 has been deposited to your account.', type: 'payment', timestamp: '2024-09-20T09:00:00', read: true, icon: 'payments', relatedStage: 'payment_issued' },
      { id: '8', title: 'Adjuster Assigned', message: 'Marcus Rivera has been assigned as your dedicated adjuster. He will contact you to schedule an inspection.', type: 'status_change', timestamp: '2024-09-17T08:30:00', read: true, icon: 'person_add', relatedStage: 'claim_reported' },
    ];
  }
}
