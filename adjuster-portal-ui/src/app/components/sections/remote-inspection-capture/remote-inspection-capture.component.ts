import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpEventType } from '@angular/common/http';
import { EstimatingService } from 'src/app/services/estimating.service';
import { FollowUpEngineService } from 'src/app/shared/services/follow-up-engine.service';

interface UploadedFile {
  file: File;
  preview: string;
  progress: number;
  uploaded: boolean;
  id?: string;
  aiFeedback?: string;
  aiFeedbackIcon?: string;
  aiFeedbackColor?: string;
  analyzing?: boolean;
}

type CoverageLevel = 'none' | 'basic' | 'good' | 'complete';

interface ProcessingStep {
  label: string;
  icon: string;
  active: boolean;
  complete: boolean;
}

interface DetectedDamage {
  icon: string;
  label: string;
  area: string;
}

interface AiInsightResult {
  damageAreas: DetectedDamage[];
  confidenceLevel: 'moderate' | 'high';
  confidencePercent: number;
  insightMessage: string;
  reassurance: string;
}

@Component({
  selector: 'app-remote-inspection-capture',
  templateUrl: './remote-inspection-capture.component.html',
  styleUrls: ['./remote-inspection-capture.component.scss'],
  standalone: false,
})
export class RemoteInspectionCaptureComponent implements OnInit, OnDestroy {

  // State
  photos: UploadedFile[] = [];
  scanFile: UploadedFile | null = null;
  uploading = false;
  submitted = false;

  // Post-upload flow
  showProcessing = false;
  showInsightPanel = false;
  showAdvisorPanel = false;
  processingComplete = false;

  processingSteps: ProcessingStep[] = [
    { label: 'Scanning uploaded photos...', icon: 'photo_camera', active: false, complete: false },
    { label: 'Identifying affected areas...', icon: 'search', active: false, complete: false },
    { label: 'Evaluating potential damage...', icon: 'assessment', active: false, complete: false },
    { label: 'Preparing your claim insights...', icon: 'insights', active: false, complete: false },
  ];

  // AI Insight Results (future: replace with real API response)
  insightResult: AiInsightResult | null = null;

  // Thresholds
  readonly minPhotos = 4;

  // Project context (would come from route or service)
  projectId: string | null = null;

  // AI Photo Guidance
  guidanceExpanded = true;
  currentTipIndex = 0;
  private tipInterval: any;

  readonly photoTips = [
    { icon: 'crop_free', text: 'Take one wide shot of each room' },
    { icon: 'zoom_in', text: 'Get close-up photos of visible damage' },
    { icon: 'flip_camera_android', text: 'Capture different angles' },
    { icon: 'vertical_align_top', text: "Don't forget ceilings and floors" },
    { icon: 'wb_sunny', text: 'Use natural light when possible' },
    { icon: 'home', text: 'Include exterior shots if damage is visible outside' },
  ];

  // AI feedback pool (simulated)
  private readonly positiveFeedback = [
    { text: 'Good coverage', icon: 'check_circle', color: '#16a34a' },
    { text: 'Nice angle', icon: 'thumb_up', color: '#16a34a' },
    { text: 'Clear shot', icon: 'visibility', color: '#16a34a' },
    { text: 'Great detail', icon: 'stars', color: '#16a34a' },
  ];
  private readonly suggestFeedback = [
    { text: 'Try adding a wider view', icon: 'crop_free', color: '#d97706' },
    { text: 'A close-up would help here', icon: 'zoom_in', color: '#d97706' },
    { text: 'Low light — consider retaking if possible', icon: 'wb_sunny', color: '#d97706' },
  ];

  // Follow-up tracking
  private clientId = 'client-' + Date.now();

  constructor(
    private estimatingService: EstimatingService,
    private snackBar: MatSnackBar,
    private router: Router,
    private followUpEngine: FollowUpEngineService,
  ) {}

  ngOnInit(): void {
    // Track: user started the capture flow
    this.followUpEngine.trackState(this.clientId, 'started_no_photos', {
      name: '', phone: '', email: '',
    });
  }

  ngOnDestroy(): void {
    // If user leaves without completing, the sequence continues in background
  }

  // ── Photo Upload ───────────────────────────────────────────────

  onPhotosSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    for (const file of Array.from(input.files)) {
      if (!file.type.startsWith('image/')) continue;

      const reader = new FileReader();
      reader.onload = (e) => {
        const photo: UploadedFile = {
          file,
          preview: e.target?.result as string,
          progress: 0,
          uploaded: false,
          analyzing: true,
        };
        this.photos.push(photo);
        this.simulatePhotoAnalysis(photo);
      };
      reader.readAsDataURL(file);
    }
    input.value = '';

    // Start tip rotation when first photo added
    if (!this.tipInterval) {
      this.startTipRotation();
    }

    // Track: photos uploaded — update state
    this.followUpEngine.trackState(this.clientId, 'photos_uploaded_no_continue', {
      name: '', phone: '', email: '',
    });
  }

  removePhoto(index: number): void {
    this.photos.splice(index, 1);
  }

  // ── AI Photo Guidance ──────────────────────────────────────────

  private startTipRotation(): void {
    this.tipInterval = setInterval(() => {
      this.currentTipIndex = (this.currentTipIndex + 1) % this.photoTips.length;
    }, 5000);
  }

  private simulatePhotoAnalysis(photo: UploadedFile): void {
    // Simulate 1-2s analysis delay
    const delay = 800 + Math.random() * 1200;
    setTimeout(() => {
      photo.analyzing = false;
      const feedback = this.generateFeedback(photo);
      photo.aiFeedback = feedback.text;
      photo.aiFeedbackIcon = feedback.icon;
      photo.aiFeedbackColor = feedback.color;
    }, delay);
  }

  private generateFeedback(photo: UploadedFile): { text: string; icon: string; color: string } {
    const idx = this.photos.indexOf(photo);
    const fileSize = photo.file.size;

    // Low light heuristic: very small file size might mean dark/blurry
    if (fileSize < 50000) {
      return this.suggestFeedback[2]; // low light
    }

    // First few photos: encourage wider views
    if (idx < 2 && Math.random() < 0.3) {
      return this.suggestFeedback[0]; // try wider view
    }

    // After several photos: mostly positive
    if (this.photos.length > 6 && Math.random() < 0.2) {
      return this.suggestFeedback[1]; // close-up would help
    }

    // Default: positive feedback (weighted random)
    return this.positiveFeedback[Math.floor(Math.random() * this.positiveFeedback.length)];
  }

  get coverageLevel(): CoverageLevel {
    const count = this.photos.length;
    if (count === 0) return 'none';
    if (count < 4) return 'basic';
    if (count < 8) return 'good';
    return 'complete';
  }

  get coverageLabel(): string {
    switch (this.coverageLevel) {
      case 'none': return 'No photos yet';
      case 'basic': return 'Basic';
      case 'good': return 'Good';
      case 'complete': return 'Complete';
    }
  }

  get coveragePercent(): number {
    switch (this.coverageLevel) {
      case 'none': return 0;
      case 'basic': return 33;
      case 'good': return 66;
      case 'complete': return 100;
    }
  }

  get smartFeedback(): string | null {
    const count = this.photos.length;
    if (count === 0) return null;
    if (count < 3) return null;
    if (count >= 3 && count < 8) return 'Great — this gives us a strong starting point.';
    return 'Excellent coverage — this helps us be more precise.';
  }

  get smartFeedbackIcon(): string {
    if (this.photos.length >= 8) return 'verified';
    return 'thumb_up';
  }

  get roomHint(): string | null {
    if (this.photos.length >= 6 && this.photos.length % 3 === 0) {
      return "Looks like you've covered this area well. You can move to the next room.";
    }
    return null;
  }

  toggleGuidance(): void {
    this.guidanceExpanded = !this.guidanceExpanded;
  }

  get photoCountMet(): boolean {
    return this.photos.length >= this.minPhotos;
  }

  get canProceed(): boolean {
    return this.photoCountMet || this.scanFile !== null;
  }

  get photosRemaining(): number {
    return Math.max(this.minPhotos - this.photos.length, 0);
  }

  // ── 3D Scan Upload ─────────────────────────────────────────────

  onScanSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    this.scanFile = {
      file,
      preview: '',
      progress: 0,
      uploaded: false,
    };
    input.value = '';
  }

  removeScan(): void {
    this.scanFile = null;
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  // ── Submit ─────────────────────────────────────────────────────

  submit(): void {
    if (!this.canProceed) return;

    this.uploading = true;

    if (this.projectId) {
      this.uploadToBackend();
    } else {
      // Simulate upload when no project context
      setTimeout(() => {
        this.onUploadComplete();
      }, 1500);
    }
  }

  private onUploadComplete(): void {
    this.uploading = false;
    this.submitted = true;
    this.showProcessing = true;

    // User is progressing — cancel "no continue" follow-up
    this.followUpEngine.cancelSequencesForClient(this.clientId);

    this.runProcessingAnimation();
  }

  private runProcessingAnimation(): void {
    // Reset steps
    this.processingSteps.forEach(s => { s.active = false; s.complete = false; });

    const stepDuration = 1100;

    this.processingSteps.forEach((step, i) => {
      // Activate step
      setTimeout(() => {
        step.active = true;
      }, i * stepDuration);

      // Complete step
      setTimeout(() => {
        step.active = false;
        step.complete = true;
      }, (i + 1) * stepDuration - 200);
    });

    // All done — transition to insight panel
    setTimeout(() => {
      this.processingComplete = true;
    }, this.processingSteps.length * stepDuration);

    setTimeout(() => {
      this.insightResult = this.generateInsightResult();
      this.showProcessing = false;
      this.showInsightPanel = true;
    }, this.processingSteps.length * stepDuration + 600);
  }

  // ── AI Insight Generation (simulated — replace with real API later) ──

  private generateInsightResult(): AiInsightResult {
    const photoCount = this.photos.length;

    // Damage area pool — pick 2-4 dynamically
    const allDamageAreas: DetectedDamage[] = [
      { icon: 'water_drop', label: 'Interior water damage', area: 'Living areas' },
      { icon: 'texture', label: 'Ceiling staining', area: 'Multiple rooms' },
      { icon: 'wall', label: 'Wall deterioration', area: 'Interior walls' },
      { icon: 'layers', label: 'Flooring impact', area: 'Ground level' },
      { icon: 'roofing', label: 'Roof surface damage', area: 'Exterior' },
      { icon: 'window', label: 'Window seal compromise', area: 'Perimeter' },
      { icon: 'foundation', label: 'Structural stress indicators', area: 'Foundation' },
      { icon: 'grass', label: 'Exterior surface damage', area: 'Outdoor areas' },
    ];

    // Shuffle and pick 2-4 items based on photo count
    const shuffled = allDamageAreas.sort(() => Math.random() - 0.5);
    const damageCount = photoCount >= 8 ? 4 : photoCount >= 5 ? 3 : 2;
    const damageAreas = shuffled.slice(0, damageCount);

    const isHigh = photoCount >= 6;

    return {
      damageAreas,
      confidenceLevel: isHigh ? 'high' : 'moderate',
      confidencePercent: isHigh ? 85 : 65,
      insightMessage: 'Based on your photos, there are clear indicators of damage that may qualify for additional coverage.',
      reassurance: 'Your documentation gives us a strong starting point. A detailed review helps ensure nothing is missed.',
    };
  }

  private uploadToBackend(): void {
    let completed = 0;
    const total = this.photos.length + (this.scanFile ? 1 : 0);

    const checkDone = () => {
      completed++;
      if (completed >= total) {
        this.onUploadComplete();
      }
    };

    for (const photo of this.photos) {
      this.estimatingService.uploadPhoto(this.projectId!, photo.file, 'damage')
        .subscribe({
          next: (event) => {
            if (event.type === HttpEventType.UploadProgress && event.total) {
              photo.progress = Math.round((event.loaded / event.total) * 100);
            } else if (event.type === HttpEventType.Response) {
              photo.uploaded = true;
              checkDone();
            }
          },
          error: () => {
            photo.progress = 0;
            checkDone();
          },
        });
    }

    if (this.scanFile) {
      this.estimatingService.uploadPhoto(this.projectId!, this.scanFile.file, '3d_scan')
        .subscribe({
          next: (event) => {
            if (event.type === HttpEventType.UploadProgress && event.total) {
              this.scanFile!.progress = Math.round((event.loaded / event.total) * 100);
            } else if (event.type === HttpEventType.Response) {
              this.scanFile!.uploaded = true;
              checkDone();
            }
          },
          error: () => checkDone(),
        });
    }
  }

  // ── Navigation ─────────────────────────────────────────────────

  showNextSteps(): void {
    this.showInsightPanel = false;
    this.showAdvisorPanel = true;

    // Track: viewed insights but hasn't requested review yet
    this.followUpEngine.trackState(this.clientId, 'insights_viewed_no_review', {
      name: '', phone: '', email: '',
    });
  }

  requestClaimReview(): void {
    // Track: requested review — follow-up continues in claim-specialist
    this.followUpEngine.trackState(this.clientId, 'review_requested_no_schedule', {
      name: '', phone: '', email: '',
    });
    this.router.navigate(['/app/claim-specialist']);
  }

  goToClaim(): void {
    // User completed the flow (chose dashboard)
    this.followUpEngine.cancelSequencesForClient(this.clientId);
    this.router.navigate(['/app/client-portal'], {
      queryParams: { status: 'processing' },
    });
  }
}
