import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommunityAdvocateService } from 'src/app/services/community-advocate.service';
import { SocialPost, AdCreative, CaRole, AdvocateProfile } from 'src/app/models/community-advocate.model';

@Component({
  selector: 'app-ca-social-ad-studio',
  templateUrl: './ca-social-ad-studio.component.html',
  styleUrls: ['./ca-social-ad-studio.component.scss'],
  standalone: false,
})
export class CaSocialAdStudioComponent implements OnInit, OnDestroy {
  @Input() caRole: CaRole = 'admin';
  @Input() myProfile: AdvocateProfile | null = null;
  activePanel: 'social' | 'ads' = 'social';

  socialPosts: SocialPost[] = [];
  adCreatives: AdCreative[] = [];

  showComposer = false;
  postForm: Partial<SocialPost> = {};

  private subs: Subscription[] = [];

  constructor(private caService: CommunityAdvocateService) {}

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    const spSub = this.caService.getSocialPosts().subscribe(data => { this.socialPosts = data; });
    this.subs.push(spSub);

    const adSub = this.caService.getAdCreatives().subscribe(data => { this.adCreatives = data; });
    this.subs.push(adSub);
  }

  openComposer(): void {
    this.postForm = { platform: 'facebook', content: '', status: 'draft', engagement: { likes: 0, comments: 0, shares: 0, reach: 0 } };
    this.showComposer = true;
  }

  closeComposer(): void {
    this.showComposer = false;
  }

  savePost(): void {
    const sub = this.caService.createSocialPost(this.postForm).subscribe(() => {
      this.closeComposer();
      this.loadData();
    });
    this.subs.push(sub);
  }

  getPlatformIcon(platform: string): string {
    switch (platform) {
      case 'facebook': return 'facebook';
      case 'instagram': return 'photo_camera';
      case 'linkedin': return 'work';
      case 'twitter': return 'tag';
      case 'google': return 'search';
      default: return 'public';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'published': return '#4caf50';
      case 'scheduled': return '#2196f3';
      case 'active': return '#4caf50';
      case 'paused': return '#ff9800';
      case 'draft': return '#9e9e9e';
      default: return '#999';
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
