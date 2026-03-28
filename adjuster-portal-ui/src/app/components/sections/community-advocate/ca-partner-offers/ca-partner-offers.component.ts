import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommunityAdvocateService } from 'src/app/services/community-advocate.service';
import { PartnerOffer, CaRole, AdvocateProfile } from 'src/app/models/community-advocate.model';

@Component({
  selector: 'app-ca-partner-offers',
  templateUrl: './ca-partner-offers.component.html',
  styleUrls: ['./ca-partner-offers.component.scss'],
  standalone: false,
})
export class CaPartnerOffersComponent implements OnInit, OnDestroy {
  @Input() caRole: CaRole = 'admin';
  @Input() myProfile: AdvocateProfile | null = null;
  offers: PartnerOffer[] = [];
  filteredOffers: PartnerOffer[] = [];
  categories = ['all', 'home_services', 'insurance', 'legal', 'restoration', 'financial'];
  selectedCategory = 'all';
  sortBy = 'redemptions';

  showForm = false;
  editingOffer: PartnerOffer | null = null;
  offerForm: Partial<PartnerOffer> = {};

  private subs: Subscription[] = [];

  constructor(private caService: CommunityAdvocateService) {}

  ngOnInit(): void {
    this.loadOffers();
  }

  private loadOffers(): void {
    const sub = this.caService.getPartnerOffers().subscribe(data => {
      this.offers = data;
      this.applyFilters();
    });
    this.subs.push(sub);
  }

  applyFilters(): void {
    let filtered = this.offers;
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(o => o.category === this.selectedCategory);
    }
    if (this.sortBy === 'redemptions') {
      filtered = [...filtered].sort((a, b) => b.redemptions - a.redemptions);
    }
    this.filteredOffers = filtered;
  }

  openForm(offer?: PartnerOffer): void {
    this.editingOffer = offer || null;
    this.offerForm = offer ? { ...offer } : { partner_name: '', category: 'home_services', title: '', description: '', discount_value: '', expiry_date: '', is_active: true, redemptions: 0 };
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingOffer = null;
  }

  saveOffer(): void {
    if (this.editingOffer) {
      const sub = this.caService.updatePartnerOffer(this.editingOffer.id, this.offerForm).subscribe(() => {
        this.closeForm();
        this.loadOffers();
      });
      this.subs.push(sub);
    } else {
      const sub = this.caService.createPartnerOffer(this.offerForm).subscribe(() => {
        this.closeForm();
        this.loadOffers();
      });
      this.subs.push(sub);
    }
  }

  getCategoryLabel(cat: string): string {
    return cat.replace(/_/g, ' ');
  }

  getCategoryIcon(cat: string): string {
    switch (cat) {
      case 'home_services': return 'home_repair_service';
      case 'insurance': return 'security';
      case 'legal': return 'gavel';
      case 'restoration': return 'build';
      case 'financial': return 'account_balance';
      default: return 'local_offer';
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
