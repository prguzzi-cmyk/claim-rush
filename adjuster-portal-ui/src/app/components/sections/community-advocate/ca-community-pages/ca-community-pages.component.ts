import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommunityAdvocateService } from 'src/app/services/community-advocate.service';
import { CommunityPage, CaRole, AdvocateProfile } from 'src/app/models/community-advocate.model';

@Component({
  selector: 'app-ca-community-pages',
  templateUrl: './ca-community-pages.component.html',
  styleUrls: ['./ca-community-pages.component.scss'],
  standalone: false,
})
export class CaCommunityPagesComponent implements OnInit, OnDestroy {
  @Input() caRole: CaRole = 'admin';
  @Input() myProfile: AdvocateProfile | null = null;
  pages: CommunityPage[] = [];
  showEditor = false;
  editingPage: CommunityPage | null = null;
  pageForm: Partial<CommunityPage> = {};

  private subs: Subscription[] = [];

  constructor(private caService: CommunityAdvocateService) {}

  ngOnInit(): void {
    this.loadPages();
  }

  private loadPages(): void {
    const sub = this.caService.getCommunityPages().subscribe(data => { this.pages = data; });
    this.subs.push(sub);
  }

  openEditor(page?: CommunityPage): void {
    this.editingPage = page || null;
    this.pageForm = page ? { ...page } : { title: '', slug: '', advocate_id: '', advocate_name: '', content: '', is_published: false };
    this.showEditor = true;
  }

  closeEditor(): void {
    this.showEditor = false;
    this.editingPage = null;
  }

  savePage(): void {
    if (this.editingPage) {
      const sub = this.caService.updateCommunityPage(this.editingPage.id, this.pageForm).subscribe(() => {
        this.closeEditor();
        this.loadPages();
      });
      this.subs.push(sub);
    } else {
      const sub = this.caService.createCommunityPage(this.pageForm).subscribe(() => {
        this.closeEditor();
        this.loadPages();
      });
      this.subs.push(sub);
    }
  }

  togglePublish(page: CommunityPage): void {
    const sub = this.caService.updateCommunityPage(page.id, { is_published: !page.is_published }).subscribe(() => {
      page.is_published = !page.is_published;
    });
    this.subs.push(sub);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
