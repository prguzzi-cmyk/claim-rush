import { Component, OnInit } from '@angular/core';
import { OutreachService } from 'src/app/services/outreach.service';
import { OutreachTemplate } from 'src/app/models/outreach.model';
import { MatTableDataSource } from '@angular/material/table';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
  selector: 'app-outreach-templates',
  templateUrl: './outreach-templates.component.html',
  styleUrls: ['./outreach-templates.component.scss'],
  standalone: false,
})
export class OutreachTemplatesComponent implements OnInit {
  templates: OutreachTemplate[] = [];
  displayedColumns: string[] = ['sn', 'name', 'channel', 'subject', 'is_active', 'created_at', 'edit', 'delete'];
  dataSource: MatTableDataSource<OutreachTemplate> = new MatTableDataSource([]);

  showForm = false;
  editingId: string | null = null;
  form: Partial<OutreachTemplate> = this.emptyForm();
  previewText = '';

  channels = ['sms', 'email', 'voice'];
  variableButtons = ['{{owner_name}}', '{{property_address}}', '{{incident_type}}', '{{adjuster_name}}'];

  constructor(
    private outreachService: OutreachService,
    private spinner: NgxSpinnerService,
  ) {}

  ngOnInit() {
    this.loadTemplates();
  }

  loadTemplates() {
    this.spinner.show();
    this.outreachService.getTemplates().subscribe((data) => {
      this.templates = data;
      this.dataSource = new MatTableDataSource(data);
      this.spinner.hide();
    });
  }

  emptyForm(): Partial<OutreachTemplate> {
    return {
      name: '',
      channel: 'sms',
      subject: '',
      body: '',
      is_active: true,
    };
  }

  openCreateForm() {
    this.showForm = true;
    this.editingId = null;
    this.form = this.emptyForm();
    this.previewText = '';
  }

  openEditForm(template: OutreachTemplate) {
    this.showForm = true;
    this.editingId = template.id;
    this.form = { ...template };
    this.previewText = '';
  }

  cancelForm() {
    this.showForm = false;
    this.editingId = null;
  }

  insertVariable(variable: string) {
    this.form.body = (this.form.body || '') + variable;
  }

  previewTemplate() {
    if (!this.form.body) return;
    this.outreachService.previewTemplate({
      body: this.form.body,
      channel: this.form.channel || 'sms',
    }).subscribe((response) => {
      this.previewText = response.rendered;
    });
  }

  saveTemplate() {
    this.spinner.show();
    if (this.editingId) {
      this.outreachService.updateTemplate(this.editingId, this.form).subscribe(() => {
        this.showForm = false;
        this.editingId = null;
        this.loadTemplates();
      });
    } else {
      this.outreachService.createTemplate(this.form).subscribe(() => {
        this.showForm = false;
        this.loadTemplates();
      });
    }
  }

  deleteTemplate(id: string) {
    if (confirm('Delete this template?')) {
      this.outreachService.deleteTemplate(id).subscribe(() => this.loadTemplates());
    }
  }
}
