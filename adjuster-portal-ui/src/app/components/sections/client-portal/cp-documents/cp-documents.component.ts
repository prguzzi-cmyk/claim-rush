import { Component, Input } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ClaimDocument } from 'src/app/models/client-portal.model';

@Component({
  selector: 'app-cp-documents',
  templateUrl: './cp-documents.component.html',
  styleUrls: ['./cp-documents.component.scss'],
  standalone: false,
})
export class CpDocumentsComponent {
  @Input() documents: ClaimDocument[] = [];

  displayedColumns = ['name', 'category', 'uploadedBy', 'uploadedAt', 'size', 'actions'];
  activeFilter: string | null = null;
  categories = ['policy', 'estimate', 'photo', 'correspondence', 'report', 'supplement'];
  showUploadArea = false;

  constructor(private snackBar: MatSnackBar) {}

  get filteredDocuments(): ClaimDocument[] {
    if (!this.activeFilter) return this.documents;
    return this.documents.filter(d => d.category === this.activeFilter);
  }

  toggleFilter(category: string): void {
    this.activeFilter = this.activeFilter === category ? null : category;
  }

  getCategoryLabel(cat: string): string {
    const labels: Record<string, string> = {
      policy: 'Policy', estimate: 'Estimate', photo: 'Photo',
      correspondence: 'Correspondence', report: 'Report', supplement: 'Supplement',
    };
    return labels[cat] || cat;
  }

  getCategoryIcon(cat: string): string {
    const icons: Record<string, string> = {
      policy: 'verified_user', estimate: 'calculate', photo: 'photo_camera',
      correspondence: 'mail', report: 'assessment', supplement: 'add_circle',
    };
    return icons[cat] || 'description';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const newDoc: ClaimDocument = {
      id: String(this.documents.length + 1),
      name: file.name,
      type: file.name.split('.').pop()?.toUpperCase() || 'FILE',
      uploadedAt: new Date().toISOString().split('T')[0],
      size: this.formatFileSize(file.size),
      url: '#',
      category: 'photo',
      uploadedBy: 'client',
    };
    this.documents = [newDoc, ...this.documents];
    this.snackBar.open(`"${file.name}" uploaded successfully`, 'OK', { duration: 3000 });
    this.showUploadArea = false;
    input.value = '';
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
}
