import { Component, OnInit, OnDestroy, ViewChild, Input } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Subscription } from 'rxjs';
import { CommunityAdvocateService } from 'src/app/services/community-advocate.service';
import { AdvocateProfile, CaRole } from 'src/app/models/community-advocate.model';

@Component({
  selector: 'app-ca-advocate-profiles',
  templateUrl: './ca-advocate-profiles.component.html',
  styleUrls: ['./ca-advocate-profiles.component.scss'],
  standalone: false,
})
export class CaAdvocateProfilesComponent implements OnInit, OnDestroy {
  @Input() caRole: CaRole = 'admin';
  @Input() myProfile: AdvocateProfile | null = null;
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  displayedColumns = ['name', 'email', 'status', 'territories', 'referrals', 'satisfaction', 'actions'];
  dataSource = new MatTableDataSource<AdvocateProfile>([]);
  searchQuery = '';
  statusFilter = '';

  showForm = false;
  editingAdvocate: AdvocateProfile | null = null;
  formData: Partial<AdvocateProfile> = {};
  expandedId: string | null = null;

  private subs: Subscription[] = [];

  constructor(private caService: CommunityAdvocateService) {}

  ngOnInit(): void {
    this.loadAdvocates();
  }

  private loadAdvocates(): void {
    const sub = this.caService.getAdvocates().subscribe(data => {
      this.dataSource.data = data;
      setTimeout(() => {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
      });
    });
    this.subs.push(sub);
  }

  applyFilter(): void {
    let filtered = this.dataSource.data;
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      this.dataSource.filter = q;
    } else {
      this.dataSource.filter = '';
    }
  }

  toggleExpand(id: string): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  openCreateForm(): void {
    this.editingAdvocate = null;
    this.formData = { name: '', email: '', phone: '', status: 'pending', territories: [], specialties: [], bio: '' };
    this.showForm = true;
  }

  openEditForm(advocate: AdvocateProfile): void {
    this.editingAdvocate = advocate;
    this.formData = { ...advocate };
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingAdvocate = null;
  }

  saveAdvocate(): void {
    if (this.editingAdvocate) {
      const sub = this.caService.updateAdvocate(this.editingAdvocate.id, this.formData).subscribe(() => {
        this.closeForm();
        this.loadAdvocates();
      });
      this.subs.push(sub);
    } else {
      const sub = this.caService.createAdvocate(this.formData).subscribe(() => {
        this.closeForm();
        this.loadAdvocates();
      });
      this.subs.push(sub);
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'active': return '#4caf50';
      case 'inactive': return '#f44336';
      case 'pending': return '#ff9800';
      default: return '#999';
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
