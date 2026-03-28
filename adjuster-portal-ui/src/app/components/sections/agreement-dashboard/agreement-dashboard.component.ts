import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

interface DocRow {
  id: string; name: string; clientName: string; status: string; sentDate: string | null;
  lastActivity: string; agent: string; signingMode: string; email: string;
  cert?: CertData | null;
}

interface CertData {
  documentHash: string;
  signedBy: string;
  signedAt: string;
  ipAddress: string;
  deviceType: string;
  browser: string;
  location: string;
  tamperStatus: 'verified' | 'failed';
  auditCount: number;
}

interface FieldPlacement {
  id: string; type: string; label: string; x: number; y: number; signer: string; required: boolean;
}

type View = 'dashboard' | 'create' | 'editor' | 'review' | 'certificate' | 'audit';

@Component({
  selector: 'app-agreement-dashboard',
  templateUrl: './agreement-dashboard.component.html',
  styleUrls: ['./agreement-dashboard.component.scss'],
  standalone: false,
})
export class AgreementDashboardComponent implements OnInit {

  view: View = 'dashboard';
  statusFilter = '';

  // KPIs
  kpis = { sentToday: 8, completed: 5, pending: 12, avgTime: '2.4h' };

  // Documents
  documents: DocRow[] = [];
  filteredDocs: DocRow[] = [];

  // Create modal
  showCreateModal = false;
  createMode: 'upload' | 'template' | null = null;
  newDocName = '';
  newClientName = '';
  newClientEmail = '';

  // Editor
  editorFields: FieldPlacement[] = [];
  selectedTool: string | null = null;
  editorDocName = '';

  // Review
  reviewEmail = '';
  reviewSubject = 'Please sign your document';
  reviewMessage = 'Please review and sign the attached document at your earliest convenience.';
  certifiedMode = false;
  sending = false;

  // Global certified mode
  globalCertified = false;

  // Certificate panel
  certDoc: DocRow | null = null;

  // Audit trail
  auditEvents: { action: string; time: string; detail: string }[] = [];

  // AI Assistant
  aiSuggestions: string[] = [];

  constructor(private router: Router, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    console.log('[UPASign] Dashboard component mounted');
    this.documents = this.getMockDocs();
    this.filteredDocs = this.documents;
    console.log('[UPASign] Loaded', this.documents.length, 'documents,', this.certifiedCount, 'certified');
  }

  // ── Filtering ──────────────────────────────────────────────────

  filterByStatus(s: string): void {
    this.statusFilter = s;
    this.filteredDocs = s ? this.documents.filter(d => d.status === s) : this.documents;
  }

  // ── Create Flow ────────────────────────────────────────────────

  openCreate(): void { this.showCreateModal = true; this.createMode = null; }
  closeCreate(): void { this.showCreateModal = false; this.newDocName = ''; this.newClientName = ''; }

  continueToEditor(): void {
    this.editorDocName = this.newDocName || 'Untitled Document';
    this.reviewEmail = this.newClientEmail;
    this.editorFields = [];
    this.showCreateModal = false;
    this.view = 'editor';
    this.runAiSuggestions();
  }

  // ── Editor ─────────────────────────────────────────────────────

  selectTool(tool: string): void { this.selectedTool = this.selectedTool === tool ? null : tool; }

  placeField(event: MouseEvent): void {
    if (!this.selectedTool) return;
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.editorFields.push({
      id: 'f-' + Date.now(),
      type: this.selectedTool,
      label: this.selectedTool.charAt(0).toUpperCase() + this.selectedTool.slice(1),
      x, y,
      signer: 'client',
      required: true,
    });
  }

  removeField(id: string): void {
    this.editorFields = this.editorFields.filter(f => f.id !== id);
  }

  toggleRequired(f: FieldPlacement): void { f.required = !f.required; }

  goToReview(): void { this.view = 'review'; }
  backToEditor(): void { this.view = 'editor'; }
  backToDashboard(): void { this.view = 'dashboard'; this.editorFields = []; }

  // ── Review + Send ──────────────────────────────────────────────

  sendDocument(): void {
    this.sending = true;
    const isCert = this.certifiedMode || this.globalCertified;
    setTimeout(() => {
      this.sending = false;
      this.documents.unshift({
        id: 'd-' + Date.now(), name: this.editorDocName, clientName: this.newClientName || 'Client',
        status: 'sent', sentDate: new Date().toISOString(), lastActivity: 'Sent just now',
        agent: 'You', signingMode: isCert ? 'certified' : 'standard', email: this.reviewEmail,
        cert: isCert ? this.generateCertData(this.newClientName || 'Client') : null,
      });
      this.filteredDocs = this.documents;
      this.view = 'dashboard';
      this.snackBar.open(isCert ? 'Certified document sent' : 'Document sent for signature', 'OK', { duration: 3000 });
    }, 1000);
  }

  saveDraft(): void {
    this.documents.unshift({
      id: 'd-' + Date.now(), name: this.editorDocName, clientName: this.newClientName || 'Client',
      status: 'draft', sentDate: null, lastActivity: 'Draft saved',
      agent: 'You', signingMode: 'standard', email: '',
    });
    this.filteredDocs = this.documents;
    this.view = 'dashboard';
    this.snackBar.open('Draft saved', 'OK', { duration: 3000 });
  }

  // ── Actions ────────────────────────────────────────────────────

  showCertModal = false;

  viewCertificate(doc: DocRow): void {
    this.setSelectedCertificate(doc);
    this.setShowCertModal(true);
  }

  setSelectedCertificate(doc: DocRow): void {
    this.certDoc = doc;
  }

  setShowCertModal(show: boolean): void {
    this.showCertModal = show;
  }

  closeCertificate(): void {
    console.log('[UPASign] closeCertificate called');
    this.showCertModal = false;
    this.certDoc = null;
  }

  downloadCertPdf(): void {
    this.snackBar.open('Certificate PDF downloaded', 'OK', { duration: 3000 });
  }

  openAuditTrail(): void {
    if (!this.certDoc) return;
    const t = (m: number) => new Date(Date.now() - m * 60000).toISOString();
    this.auditEvents = [
      { action: 'Document Created', time: t(4320), detail: 'Agreement generated from template' },
      { action: 'Sent for Signature', time: t(4300), detail: 'Delivered to ' + (this.certDoc.email || 'signer') },
      { action: 'Email Opened', time: t(3000), detail: 'Recipient opened signature request email' },
      { action: 'Document Viewed', time: t(2900), detail: 'Signer viewed the document' },
      { action: 'Signing Started', time: t(2880), detail: 'Signer began completing fields' },
      { action: 'Signature Applied', time: t(2870), detail: 'Digital signature captured' },
      { action: 'Document Signed', time: t(2860), detail: 'All required fields completed' },
      { action: 'Certificate Generated', time: t(2859), detail: 'SHA-256 hash computed, tamper seal applied' },
      { action: 'Copies Delivered', time: t(2858), detail: 'Signed copies sent to signer and agent' },
    ];
    this.showAuditModal = true;
  }

  showAuditModal = false;

  closeAuditTrail(): void {
    this.showAuditModal = false;
  }

  get certifiedCount(): number {
    return this.documents.filter(d => d.signingMode === 'certified').length;
  }

  formatAuditTime(d: string): string {
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }

  private generateCertData(signerName: string): CertData {
    const hash = Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
    return {
      documentHash: hash,
      signedBy: signerName,
      signedAt: new Date().toISOString(),
      ipAddress: '192.168.1.' + Math.floor(Math.random() * 254 + 1),
      deviceType: Math.random() > 0.5 ? 'iPhone 15 Pro' : 'Desktop — Chrome',
      browser: Math.random() > 0.5 ? 'Safari 17.3' : 'Chrome 122',
      location: 'Dallas, TX',
      tamperStatus: 'verified',
      auditCount: Math.floor(Math.random() * 8 + 4),
    };
  }

  resendDoc(doc: DocRow): void { this.snackBar.open('Reminder sent to ' + doc.clientName, 'OK', { duration: 3000 }); }
  deleteDoc(doc: DocRow): void {
    this.documents = this.documents.filter(d => d.id !== doc.id);
    this.filteredDocs = this.statusFilter ? this.documents.filter(d => d.status === this.statusFilter) : this.documents;
    this.snackBar.open('Document deleted', 'OK', { duration: 3000 });
  }
  viewDoc(doc: DocRow): void {
    if (doc.signingMode === 'certified' && (doc.status === 'signed' || doc.cert)) {
      this.viewCertificate(doc);
    } else {
      this.router.navigate(['/app/sign', doc.id]);
    }
  }

  // ── AI Assistant ───────────────────────────────────────────────

  private runAiSuggestions(): void {
    this.aiSuggestions = [];
    setTimeout(() => {
      this.aiSuggestions = [
        'Add a signature field at the bottom of page 1',
        'Add an initials field next to each clause',
        'Add a date field beside the signature',
      ];
    }, 1500);
  }

  applyAiSuggestion(s: string): void {
    const types: Record<string, string> = { signature: 'signature', initials: 'initials', date: 'date' };
    const type = s.includes('signature') ? 'signature' : s.includes('initials') ? 'initials' : 'date';
    this.editorFields.push({
      id: 'ai-' + Date.now(), type, label: type.charAt(0).toUpperCase() + type.slice(1),
      x: 80 + Math.random() * 200, y: 400 + this.editorFields.length * 60,
      signer: 'client', required: true,
    });
    this.aiSuggestions = this.aiSuggestions.filter(x => x !== s);
    this.snackBar.open('Field placed by AI assistant', 'OK', { duration: 2000 });
  }

  // ── Helpers ────────────────────────────────────────────────────

  getStatusColor(s: string): string {
    return ({ draft: '#9ca3af', sent: '#2563eb', viewed: '#d97706', signed: '#16a34a', expired: '#dc2626' } as any)[s] || '#6b7280';
  }

  formatDate(d: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private getMockDocs(): DocRow[] {
    const t = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
    return [
      { id: 'd1', name: 'Claim Representation Agreement', clientName: 'Robert Chen', status: 'signed', sentDate: t(5), lastActivity: 'Signed 4 days ago', agent: 'Mike Torres', signingMode: 'standard', email: 'rchen@example.com' },
      { id: 'd2', name: 'Property Inspection Auth', clientName: 'Maria Gonzalez', status: 'viewed', sentDate: t(2), lastActivity: 'Viewed 1 day ago', agent: 'Sarah Kim', signingMode: 'certified', email: 'mgonzalez@example.com', cert: { documentHash: 'a3f8c1d9e2b4f6a7c0d1e3f5a8b2c4d6e9f1a3b5c7d9e2f4a6b8c0d2e4f6a8b0', signedBy: 'Maria Gonzalez', signedAt: new Date(Date.now() - 86400000).toISOString(), ipAddress: '192.168.1.42', deviceType: 'iPhone 15 Pro', browser: 'Safari 17.3', location: 'Fort Worth, TX', tamperStatus: 'verified', auditCount: 7 } },
      { id: 'd3', name: 'Claim Representation Agreement', clientName: 'David Thompson', status: 'sent', sentDate: t(1), lastActivity: 'Sent yesterday', agent: 'James Rivera', signingMode: 'standard', email: 'dthompson@example.com' },
      { id: 'd4', name: 'Supplemental Agreement', clientName: 'Jennifer Adams', status: 'draft', sentDate: null, lastActivity: 'Created today', agent: 'You', signingMode: 'standard', email: 'jadams@example.com' },
      { id: 'd5', name: 'Assignment of Benefits', clientName: 'William Brown', status: 'expired', sentDate: t(35), lastActivity: 'Expired', agent: 'Lisa Park', signingMode: 'standard', email: 'wbrown@example.com' },
    ];
  }
}
