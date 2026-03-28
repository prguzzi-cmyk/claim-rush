import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommunityAdvocateService } from 'src/app/services/community-advocate.service';
import { ChannelConfig, OutreachTemplate, CaRole, AdvocateProfile } from 'src/app/models/community-advocate.model';

@Component({
  selector: 'app-ca-outreach-channels',
  templateUrl: './ca-outreach-channels.component.html',
  styleUrls: ['./ca-outreach-channels.component.scss'],
  standalone: false,
})
export class CaOutreachChannelsComponent implements OnInit, OnDestroy {
  @Input() caRole: CaRole = 'admin';
  @Input() myProfile: AdvocateProfile | null = null;
  channels: ChannelConfig[] = [];
  templates: OutreachTemplate[] = [];
  templateColumns = ['name', 'channel', 'category', 'active', 'actions'];

  showEditor = false;
  editingTemplate: OutreachTemplate | null = null;
  templateForm: Partial<OutreachTemplate> = {};
  previewMode = false;

  private subs: Subscription[] = [];

  constructor(private caService: CommunityAdvocateService) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    const chSub = this.caService.getChannelConfigs().subscribe(data => { this.channels = data; });
    this.subs.push(chSub);

    const tplSub = this.caService.getTemplates().subscribe(data => { this.templates = data; });
    this.subs.push(tplSub);
  }

  toggleChannel(channel: ChannelConfig): void {
    const sub = this.caService.updateChannelConfig(channel.id, { is_enabled: !channel.is_enabled }).subscribe(() => {
      channel.is_enabled = !channel.is_enabled;
    });
    this.subs.push(sub);
  }

  openTemplateEditor(template?: OutreachTemplate): void {
    this.editingTemplate = template || null;
    this.templateForm = template ? { ...template } : { name: '', channel: 'email', subject: '', body: '', category: '', is_active: true };
    this.showEditor = true;
    this.previewMode = false;
  }

  closeEditor(): void {
    this.showEditor = false;
    this.editingTemplate = null;
  }

  saveTemplate(): void {
    if (this.editingTemplate) {
      const sub = this.caService.updateTemplate(this.editingTemplate.id, this.templateForm).subscribe(() => {
        this.closeEditor();
        this.loadData();
      });
      this.subs.push(sub);
    } else {
      const sub = this.caService.createTemplate(this.templateForm).subscribe(() => {
        this.closeEditor();
        this.loadData();
      });
      this.subs.push(sub);
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
