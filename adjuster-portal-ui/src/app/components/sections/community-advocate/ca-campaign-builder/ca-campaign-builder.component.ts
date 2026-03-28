import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommunityAdvocateService } from 'src/app/services/community-advocate.service';
import { Campaign, CampaignStep, AudienceSegment, CaRole, AdvocateProfile } from 'src/app/models/community-advocate.model';

@Component({
  selector: 'app-ca-campaign-builder',
  templateUrl: './ca-campaign-builder.component.html',
  styleUrls: ['./ca-campaign-builder.component.scss'],
  standalone: false,
})
export class CaCampaignBuilderComponent implements OnInit, OnDestroy {
  @Input() caRole: CaRole = 'admin';
  @Input() myProfile: AdvocateProfile | null = null;
  campaigns: Campaign[] = [];
  segments: AudienceSegment[] = [];
  displayedColumns = ['name', 'status', 'audience', 'steps', 'sent', 'converted', 'actions'];

  showBuilder = false;
  builderStep = 0;
  editingCampaign: Campaign | null = null;

  formData: Partial<Campaign> = {};
  newStep: Partial<CampaignStep> = {};

  private subs: Subscription[] = [];

  constructor(private caService: CommunityAdvocateService) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    const cmpSub = this.caService.getCampaigns().subscribe(data => { this.campaigns = data; });
    this.subs.push(cmpSub);

    const segSub = this.caService.getAudienceSegments().subscribe(data => { this.segments = data; });
    this.subs.push(segSub);
  }

  openBuilder(campaign?: Campaign): void {
    this.editingCampaign = campaign || null;
    this.formData = campaign ? { ...campaign } : { name: '', status: 'draft', audience_segment_id: '', audience_segment_name: '', steps: [], metrics: { sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0 } };
    this.builderStep = 0;
    this.showBuilder = true;
  }

  closeBuilder(): void {
    this.showBuilder = false;
    this.editingCampaign = null;
  }

  addStep(): void {
    if (!this.formData.steps) this.formData.steps = [];
    this.formData.steps.push({
      id: 'step-' + Date.now(),
      order: this.formData.steps.length + 1,
      channel: 'email',
      template_id: '',
      template_name: '',
      delay_days: 0,
      ...this.newStep,
    } as CampaignStep);
    this.newStep = {};
  }

  removeStep(index: number): void {
    this.formData.steps?.splice(index, 1);
    this.formData.steps?.forEach((s, i) => s.order = i + 1);
  }

  saveCampaign(): void {
    if (this.editingCampaign) {
      const sub = this.caService.updateCampaign(this.editingCampaign.id, this.formData).subscribe(() => {
        this.closeBuilder();
        this.loadData();
      });
      this.subs.push(sub);
    } else {
      const sub = this.caService.createCampaign(this.formData).subscribe(() => {
        this.closeBuilder();
        this.loadData();
      });
      this.subs.push(sub);
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'active': return '#4caf50';
      case 'paused': return '#ff9800';
      case 'completed': return '#2196f3';
      case 'draft': return '#9e9e9e';
      default: return '#999';
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
