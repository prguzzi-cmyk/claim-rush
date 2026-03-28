import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommunityAdvocateService } from 'src/app/services/community-advocate.service';
import { ComplianceDisclaimer, ComplianceChecklist, CaRole, AdvocateProfile } from 'src/app/models/community-advocate.model';

@Component({
  selector: 'app-ca-compliance',
  templateUrl: './ca-compliance.component.html',
  styleUrls: ['./ca-compliance.component.scss'],
  standalone: false,
})
export class CaComplianceComponent implements OnInit, OnDestroy {
  @Input() caRole: CaRole = 'admin';
  @Input() myProfile: AdvocateProfile | null = null;
  disclaimers: ComplianceDisclaimer[] = [];
  checklist: ComplianceChecklist;
  disclaimerColumns = ['title', 'category', 'required', 'approved', 'actions'];

  showEditor = false;
  editingDisclaimer: ComplianceDisclaimer | null = null;
  disclaimerForm: Partial<ComplianceDisclaimer> = {};

  private subs: Subscription[] = [];

  constructor(private caService: CommunityAdvocateService) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    const disSub = this.caService.getDisclaimers().subscribe(data => { this.disclaimers = data; });
    this.subs.push(disSub);

    const clSub = this.caService.getComplianceChecklist().subscribe(data => { this.checklist = data; });
    this.subs.push(clSub);
  }

  toggleCheckItem(itemId: string, completed: boolean): void {
    const sub = this.caService.updateChecklistItem(this.checklist.id, itemId, completed).subscribe(data => {
      this.checklist = data;
    });
    this.subs.push(sub);
  }

  openEditor(disclaimer?: ComplianceDisclaimer): void {
    this.editingDisclaimer = disclaimer || null;
    this.disclaimerForm = disclaimer ? { ...disclaimer } : { title: '', content: '', category: 'general', is_required: false, is_approved: false };
    this.showEditor = true;
  }

  closeEditor(): void {
    this.showEditor = false;
    this.editingDisclaimer = null;
  }

  saveDisclaimer(): void {
    if (this.editingDisclaimer) {
      const sub = this.caService.updateDisclaimer(this.editingDisclaimer.id, this.disclaimerForm).subscribe(() => {
        this.closeEditor();
        this.loadData();
      });
      this.subs.push(sub);
    } else {
      const sub = this.caService.createDisclaimer(this.disclaimerForm).subscribe(() => {
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
