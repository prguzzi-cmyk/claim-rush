import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommunityAdvocateService } from 'src/app/services/community-advocate.service';
import { EducationContent, CaRole, AdvocateProfile } from 'src/app/models/community-advocate.model';

@Component({
  selector: 'app-ca-education-library',
  templateUrl: './ca-education-library.component.html',
  styleUrls: ['./ca-education-library.component.scss'],
  standalone: false,
})
export class CaEducationLibraryComponent implements OnInit, OnDestroy {
  @Input() caRole: CaRole = 'admin';
  @Input() myProfile: AdvocateProfile | null = null;
  allContent: EducationContent[] = [];
  filteredContent: EducationContent[] = [];
  categories = ['all', 'article', 'video', 'checklist', 'infographic'];
  selectedCategory = 'all';
  expandedId: string | null = null;

  showForm = false;
  contentForm: Partial<EducationContent> = {};

  private subs: Subscription[] = [];

  constructor(private caService: CommunityAdvocateService) {}

  ngOnInit(): void {
    this.loadContent();
  }

  private loadContent(): void {
    const sub = this.caService.getEducationContent().subscribe(data => {
      this.allContent = data;
      this.applyFilter();
    });
    this.subs.push(sub);
  }

  applyFilter(): void {
    this.filteredContent = this.selectedCategory === 'all'
      ? this.allContent
      : this.allContent.filter(c => c.category === this.selectedCategory);
  }

  toggleExpand(id: string): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  openForm(): void {
    this.contentForm = { title: '', category: 'article', topic: '', summary: '', content: '', is_published: true };
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
  }

  saveContent(): void {
    const sub = this.caService.createEducationContent(this.contentForm).subscribe(() => {
      this.closeForm();
      this.loadContent();
    });
    this.subs.push(sub);
  }

  getCategoryIcon(cat: string): string {
    switch (cat) {
      case 'article': return 'article';
      case 'video': return 'play_circle';
      case 'checklist': return 'checklist';
      case 'infographic': return 'image';
      default: return 'school';
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
