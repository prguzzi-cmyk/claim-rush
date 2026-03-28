import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  OutreachMessageTemplate,
  TEMPLATE_VARIABLES,
} from 'src/app/shared/models/outreach-campaign.model';
import {
  OUTREACH_TEMPLATES,
  interpolateTemplate,
} from 'src/app/constants/outreach-template.config';

type ViewMode = 'list' | 'editor';

interface TemplateVersion {
  version: number;
  body: string;
  subject: string | null;
  callScript: string | null;
  savedAt: string;
}

@Component({
  selector: 'app-message-templates',
  templateUrl: './message-templates.component.html',
  styleUrls: ['./message-templates.component.scss'],
  standalone: false,
})
export class MessageTemplatesComponent implements OnInit {

  view: ViewMode = 'list';
  loading = true;

  // List
  templates: OutreachMessageTemplate[] = [];
  channelFilter: string | null = null;

  // Editor
  editingTemplate: OutreachMessageTemplate | null = null;
  isNew = false;

  // Editor fields
  tplId = '';
  tplName = '';
  tplChannel: 'voice' | 'sms' | 'email' = 'sms';
  tplSubject: string | null = null;
  tplBody = '';
  tplCallScript: string | null = null;
  tplCategory = 'general';
  tplIsActive = true;

  // Preview
  previewContext: Record<string, string> = {
    owner_name: 'John Smith',
    property_address: '1234 Oak Lane, Dallas, TX 75201',
    incident_type: 'hail',
    adjuster_name: 'Sarah Mitchell',
    company_name: 'ACI Adjuster Intelligence',
    callback_number: '(214) 555-0199',
    claim_number: 'CLM-2025-0847',
    storm_type: 'hail',
    loss_date: '03/10/2025',
  };

  // Version history
  versionHistory: TemplateVersion[] = [];

  // Test
  testRecipient = '';
  testSending = false;

  // Lookup
  availableVariables = TEMPLATE_VARIABLES;
  channelOptions = [
    { value: 'voice', label: 'AI Voice', icon: 'phone', color: '#1565c0' },
    { value: 'sms',   label: 'SMS',      icon: 'sms',   color: '#2e7d32' },
    { value: 'email', label: 'Email',    icon: 'email', color: '#e65100' },
  ];
  categoryOptions = [
    'storm_outreach', 'fire_outreach', 'followup', 'appointment',
    'reengagement', 'general',
  ];

  constructor(
    private snackBar: MatSnackBar,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.loadTemplates();
  }

  // ═══════════════════════════════════════════════════════════════
  // 1. Template List
  // ═══════════════════════════════════════════════════════════════

  loadTemplates(): void {
    this.loading = true;
    this.http.get<OutreachMessageTemplate[]>('outreach-templates').pipe(
      catchError(() => of([...OUTREACH_TEMPLATES]))
    ).subscribe(data => {
      this.templates = data.length > 0 ? data : [...OUTREACH_TEMPLATES];
      this.loading = false;
    });
  }

  get filteredTemplates(): OutreachMessageTemplate[] {
    if (!this.channelFilter) return this.templates;
    return this.templates.filter(t => t.channel === this.channelFilter);
  }

  getChannelIcon(channel: string): string {
    return this.channelOptions.find(c => c.value === channel)?.icon || 'message';
  }

  getChannelColor(channel: string): string {
    return this.channelOptions.find(c => c.value === channel)?.color || '#757575';
  }

  getChannelLabel(channel: string): string {
    return this.channelOptions.find(c => c.value === channel)?.label || channel;
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. Template Editor
  // ═══════════════════════════════════════════════════════════════

  openNewTemplate(): void {
    this.isNew = true;
    this.editingTemplate = null;
    this.tplId = '';
    this.tplName = '';
    this.tplChannel = 'sms';
    this.tplSubject = null;
    this.tplBody = '';
    this.tplCallScript = null;
    this.tplCategory = 'general';
    this.tplIsActive = true;
    this.versionHistory = [];
    this.view = 'editor';
  }

  openEditTemplate(tpl: OutreachMessageTemplate): void {
    this.isNew = false;
    this.editingTemplate = tpl;
    this.tplId = tpl.id;
    this.tplName = tpl.name;
    this.tplChannel = tpl.channel;
    this.tplSubject = tpl.subject;
    this.tplBody = tpl.body;
    this.tplCallScript = tpl.callScript;
    this.tplCategory = tpl.category;
    this.tplIsActive = tpl.isActive;
    this.versionHistory = this.buildVersionHistory(tpl);
    this.view = 'editor';
  }

  saveTemplate(): void {
    const tpl: OutreachMessageTemplate = {
      id: this.tplId || `tpl-${Date.now()}`,
      name: this.tplName,
      channel: this.tplChannel,
      subject: this.tplChannel === 'email' ? this.tplSubject : null,
      body: this.tplBody,
      callScript: this.tplChannel === 'voice' ? this.tplCallScript : null,
      category: this.tplCategory,
      variables: this.extractVariables(this.tplBody + (this.tplSubject || '') + (this.tplCallScript || '')),
      isActive: this.tplIsActive,
    };

    this.http.post<OutreachMessageTemplate>('outreach-templates', tpl).pipe(
      catchError(() => of(tpl))
    ).subscribe(() => {
      if (this.isNew) {
        this.templates.push(tpl);
      } else {
        const idx = this.templates.findIndex(t => t.id === tpl.id);
        if (idx >= 0) this.templates[idx] = tpl;
      }
      this.snackBar.open('Template saved', 'Close', { duration: 3000 });
      this.view = 'list';
    });
  }

  deleteTemplate(tpl: OutreachMessageTemplate): void {
    if (!confirm(`Delete template "${tpl.name}"?`)) return;
    this.http.delete(`outreach-templates/${tpl.id}`).pipe(
      catchError(() => of(null))
    ).subscribe(() => {
      this.templates = this.templates.filter(t => t.id !== tpl.id);
      this.snackBar.open('Template deleted', 'Close', { duration: 3000 });
    });
  }

  cancelEdit(): void {
    this.view = 'list';
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. Preview
  // ═══════════════════════════════════════════════════════════════

  get previewBody(): string {
    return interpolateTemplate(this.tplBody, this.previewContext);
  }

  get previewSubject(): string {
    return this.tplSubject ? interpolateTemplate(this.tplSubject, this.previewContext) : '';
  }

  get previewCallScript(): string {
    return this.tplCallScript ? interpolateTemplate(this.tplCallScript, this.previewContext) : '';
  }

  insertVariable(variable: string): void {
    this.tplBody += variable;
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. SMS Character Counter
  // ═══════════════════════════════════════════════════════════════

  get smsCharCount(): number {
    return this.tplBody.length;
  }

  get smsSegments(): number {
    if (this.smsCharCount <= 160) return 1;
    return Math.ceil(this.smsCharCount / 153);
  }

  get smsCharClass(): string {
    if (this.smsCharCount > 320) return 'char-danger';
    if (this.smsCharCount > 160) return 'char-warn';
    return 'char-ok';
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. Test Send
  // ═══════════════════════════════════════════════════════════════

  sendTest(): void {
    if (!this.testRecipient) return;
    this.testSending = true;
    this.http.post('outreach-templates/test', {
      channel: this.tplChannel,
      recipient: this.testRecipient,
      subject: this.previewSubject,
      body: this.previewBody,
    }).pipe(
      catchError(() => {
        this.snackBar.open('Test sent (simulated)', 'Close', { duration: 3000 });
        return of(null);
      })
    ).subscribe(() => {
      this.testSending = false;
      this.snackBar.open('Test message sent', 'Close', { duration: 3000 });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. Version History
  // ═══════════════════════════════════════════════════════════════

  private buildVersionHistory(tpl: OutreachMessageTemplate): TemplateVersion[] {
    // In production this would come from the backend.
    // For now, return the current state as version 1.
    return [{
      version: 1,
      body: tpl.body,
      subject: tpl.subject,
      callScript: tpl.callScript,
      savedAt: new Date().toISOString(),
    }];
  }

  restoreVersion(version: TemplateVersion): void {
    if (!confirm(`Restore version ${version.version}?`)) return;
    this.tplBody = version.body;
    this.tplSubject = version.subject;
    this.tplCallScript = version.callScript;
    this.snackBar.open(`Restored to version ${version.version}`, 'Close', { duration: 3000 });
  }

  // ═══════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════

  private extractVariables(text: string): string[] {
    const matches = text.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
  }

  formatCategory(cat: string): string {
    return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
