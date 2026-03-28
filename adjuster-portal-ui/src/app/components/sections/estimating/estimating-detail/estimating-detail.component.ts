import { Component, OnInit, OnDestroy, HostListener, ElementRef, NgZone } from "@angular/core";
import { FormBuilder, FormGroup, FormArray, FormControl, Validators, AbstractControl } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { MatSnackBar } from "@angular/material/snack-bar";
import { HttpEventType } from "@angular/common/http";
import { of, Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged, switchMap } from "rxjs/operators";
import { EstimatingService } from "src/app/services/estimating.service";
import { TabService } from "src/app/services/tab.service";
import { DialogService } from "src/app/services/dialog.service";
import { UserService } from "src/app/services/user.service";
import { ClaimService } from "src/app/services/claim.service";
import { FireClaimService } from "src/app/services/fire-claim.service";
import { PolicyDocumentService } from "src/app/services/policy-document.service";
import { PolicyDocument, PolicyClause, PolicyIntelligence } from "src/app/models/policy-document.model";
import { EstimateMode, EstimateModeConfig, EstimatePhoto, LinkedFireClaim } from "src/app/models/estimating.model";
import { ESTIMATE_MODES, ESTIMATE_MODE_MAP, CATEGORY_METADATA } from "src/app/constants/estimate-mode.config";
import { DefenseTemplate, getTemplatesByCategory } from "src/app/constants/defense-template.config";
import {
  CarrierEstimate, CarrierPreviewResult, ComparisonResult, ComparisonRoom,
  CategoryBreakdown, TopUnderpaidItem,
  SupplementDefensePackage, DefenseNotes,
  createEmptyDefenseNotes, defenseNotesFromPayload, defenseNotesToPayload,
} from "src/app/models/carrier-comparison.model";
import { ClaimFinancialEngineService } from "src/app/shared/services/claim-financial-engine.service";
import { LineItemDialogComponent } from "src/app/components/dialogs/line-item-dialog/line-item-dialog.component";
import { CarrierPasteDialogComponent } from "src/app/components/dialogs/carrier-paste-dialog/carrier-paste-dialog.component";
import {
  CarrierPreviewDialogComponent,
  CarrierPreviewDialogData,
  CarrierPreviewDialogResult,
} from "src/app/components/dialogs/carrier-preview-dialog/carrier-preview-dialog.component";
import {
  SupplementEmailDialogComponent,
  SupplementEmailDialogData,
  SupplementEmailDialogResult,
} from "src/app/components/dialogs/supplement-email-dialog/supplement-email-dialog.component";
import { MatDialog } from "@angular/material/dialog";
import { environment } from "src/environments/environment";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

@Component({
  selector: "app-estimating-detail",
  templateUrl: "./estimating-detail.component.html",
  styleUrls: ["./estimating-detail.component.scss"],
  standalone: false,
})
export class EstimatingDetailComponent implements OnInit, OnDestroy {
  projectForm: FormGroup;
  estimateId: string | null = null;
  isEditMode = false;
  saving = false;

  // Mode selection
  selectedMode: EstimateMode | null = null;
  modeSelected = false;
  currentModeConfig: EstimateModeConfig | null = null;
  estimateModes = ESTIMATE_MODES;

  // Validation
  validationErrors: { field: string; message: string; elementId: string }[] = [];
  showValidation = false;
  recentlyValidFields: Set<string> = new Set();

  // Suggest from photos
  suggesting = false;
  showSuggestedOnly = false;

  // O&P (combined) — kept for backward compat with save payload
  opPercent = 20;
  opStandard = false;
  opShowMinWarning = false;

  // Separate overhead & profit
  overheadPercent = 10;
  profitPercent = 10;

  // 3-Panel workspace
  selectedRoomIndex = 0;
  leftPanelCollapsed = false;
  rightPanelCollapsed = false;

  // Resizable dividers
  leftPanelWidth = 240;
  rightPanelWidth = 300;
  private draggingDivider: 'left' | 'right' | null = null;
  private dragStartX = 0;
  private dragStartWidth = 0;
  isDragging = false;

  private readonly LEFT_MIN = 180;
  private readonly LEFT_MAX = 400;
  private readonly RIGHT_MIN = 220;
  private readonly RIGHT_MAX = 500;

  // ACI Adjuster Intelligence
  aiAnalysisResults: any = null;
  showAIPanel = false;
  aiAnalyzing = false;
  aciPanelSource: 'scope' | 'photos' = 'scope';

  // ACI Damage Analysis
  photoAnalyzing = false;
  selectedPhotoIds: Set<string> = new Set();

  // Measurement import
  showMeasurementImport: Map<number, boolean> = new Map();

  statusOptions = ["draft", "in_progress", "review", "approved", "completed"];
  roomTypeOptions = [
    "kitchen",
    "bathroom",
    "bedroom",
    "living_room",
    "dining_room",
    "garage",
    "basement",
    "attic",
    "hallway",
    "exterior",
    "other",
  ];
  unitOptions = ["SF", "LF", "SY", "EA", "HR", "CF", "GAL"];

  // Category list — populated dynamically from mode config
  activeCategoryList: { key: string; label: string; icon: string }[] = [
    { key: 'walls', label: 'Walls', icon: 'wall' },
    { key: 'ceiling', label: 'Ceiling', icon: 'roofing' },
    { key: 'floor', label: 'Floor', icon: 'grid_on' },
    { key: 'trim', label: 'Trim', icon: 'border_style' },
    { key: 'doors', label: 'Doors', icon: 'door_front' },
    { key: 'windows', label: 'Windows', icon: 'window' },
    { key: 'cabinets', label: 'Cabinets', icon: 'kitchen' },
    { key: 'fixtures', label: 'Fixtures', icon: 'light' },
    { key: 'misc_items', label: 'Misc Items', icon: 'category' },
  ];
  categoryCollapsed: Map<string, boolean> = new Map();

  // Quick Add Library
  showQuickAdd = false;
  quickAddCategory = 'walls';
  readonly QUICK_ADD_LIBRARY: Record<string, { description: string; unit: string }[]> = {
    walls: [
      { description: 'Remove drywall', unit: 'SF' },
      { description: 'Install drywall', unit: 'SF' },
      { description: 'Tape and finish drywall', unit: 'SF' },
      { description: 'Prime walls', unit: 'SF' },
      { description: 'Paint walls', unit: 'SF' },
      { description: 'Seal smoke damage', unit: 'SF' },
    ],
    ceiling: [
      { description: 'Remove ceiling drywall', unit: 'SF' },
      { description: 'Install ceiling drywall', unit: 'SF' },
      { description: 'Prime ceiling', unit: 'SF' },
      { description: 'Paint ceiling', unit: 'SF' },
      { description: 'Smoke seal ceiling', unit: 'SF' },
    ],
    floor: [
      { description: 'Remove carpet', unit: 'SY' },
      { description: 'Install carpet', unit: 'SY' },
      { description: 'Remove laminate', unit: 'SF' },
      { description: 'Install laminate', unit: 'SF' },
      { description: 'Remove hardwood', unit: 'SF' },
      { description: 'Install hardwood', unit: 'SF' },
      { description: 'Sand and finish hardwood', unit: 'SF' },
    ],
    trim: [
      { description: 'Remove baseboard', unit: 'LF' },
      { description: 'Install baseboard', unit: 'LF' },
      { description: 'Paint trim', unit: 'LF' },
    ],
    doors: [
      { description: 'Remove door', unit: 'EA' },
      { description: 'Install door', unit: 'EA' },
      { description: 'Paint door', unit: 'EA' },
    ],
    windows: [
      { description: 'Remove window', unit: 'EA' },
      { description: 'Install window', unit: 'EA' },
      { description: 'Window trim repair', unit: 'LF' },
    ],
    cabinets: [
      { description: 'Remove cabinets', unit: 'LF' },
      { description: 'Install cabinets', unit: 'LF' },
      { description: 'Cabinet refinishing', unit: 'LF' },
    ],
    fixtures: [
      { description: 'Remove light fixture', unit: 'EA' },
      { description: 'Install light fixture', unit: 'EA' },
      { description: 'Remove vanity', unit: 'EA' },
      { description: 'Install vanity', unit: 'EA' },
    ],
    misc_items: [
      { description: 'Debris removal', unit: 'HR' },
      { description: 'Contents manipulation', unit: 'HR' },
      { description: 'Detach and reset', unit: 'EA' },
      { description: 'Clean and deodorize', unit: 'SF' },
    ],
  };

  // Pricing search state
  pricingResults: Map<string, any[]> = new Map();
  pricingSearchSubject = new Subject<{ key: string; query: string }>();
  pricingSearching: Map<string, boolean> = new Map();
  private pricingSub: Subscription;

  // Linked fire claim
  linkedClaim: LinkedFireClaim | null = null;

  // Pricing version info
  pricingVersionLabel: string | null = null;
  pricingRegion: string | null = null;

  // Photo state
  projectPhotos: EstimatePhoto[] = [];
  roomPhotos: Map<string, EstimatePhoto[]> = new Map();
  photoUploading: Map<string, boolean> = new Map();
  photoUploadProgress: Map<string, number> = new Map();
  selectedPhotoForPreview: EstimatePhoto | null = null;
  photoTypeOptions = ["overview", "damage", "before", "after", "detail", "measurement", "other"];

  // Current user info (for PDF cover letter / supplement email)
  adjusterFullName = '';
  adjusterEmail = '';
  adjusterPhone = '';

  // Carrier Comparison
  activeView: 'original' | 'carrier' | 'blackout' | 'supplement' | 'defense' = 'original';
  private _pendingView: string | null = null;
  carrierEstimates: CarrierEstimate[] = [];
  selectedCarrierEstimate: CarrierEstimate | null = null;
  comparisonResult: ComparisonResult | null = null;
  comparisonLoading = false;
  carrierUploading = false;
  priceThreshold = 5.0;
  supplementGenerating = false;
  supplementReportGenerated = false;
  supplementArgumentGenerating = false;
  generatedSupplementArgument = '';
  supplementArgumentHasPolicySupport = false;
  pendingSupplementArgument = '';

  // Blackout View Filters
  blackoutRoomFilter = '';
  blackoutStatusFilter = '';
  blackoutSortBy: 'default' | 'largest_diff' = 'default';

  // AI Claim Strategy
  claimStrategy: string | null = null;
  strategyGenerating = false;

  // Supplement Defense Package
  defensePackage: SupplementDefensePackage | null = null;
  defenseNotes: DefenseNotes = createEmptyDefenseNotes();
  defenseNotesLoaded = false;
  defenseNotesSaving = false;
  defenseNotesSaved = false;
  private defenseNotesSaveSubject = new Subject<void>();
  private defenseNotesSaveSub: Subscription;

  // AI draft generation state (per-section)
  defenseGenerating: Record<string, boolean> = {};
  defenseGenerated: Record<string, boolean> = {};

  isDevMode = !environment.production;
  devToolsExpanded = false;

  // Policy Intelligence
  policyDoc: PolicyDocument | null = null;
  policyLoading = false;
  policyUploading = false;
  policyAnalyzing = false;
  policyError: string | null = null;
  policyNotesExpanded = false;
  expandedProvisions: Set<string> = new Set();

  // Claim File → Policy Import
  claimFilePDFs: any[] = [];
  claimFilesLoading = false;
  importingClaimFile = false;
  estimateClaimId: string | null = null;

  // Policy Argument Engine
  argumentType = 'loss_settlement';
  argumentGenerating = false;
  generatedArgument = '';
  argumentTypes = [
    { value: 'loss_settlement', label: 'Loss Settlement' },
    { value: 'ordinance_or_law', label: 'Ordinance or Law' },
    { value: 'replacement_cost', label: 'Replacement Cost / RCV' },
    { value: 'duties_after_loss', label: 'Duties After Loss' },
    { value: 'additional_coverages', label: 'Additional Coverages' },
    { value: 'general_coverage', label: 'General Coverage Support' },
  ];

  // Carrier Payments
  carrierPayments: any[] = [];
  paymentAmount: number | null = null;
  paymentDate: string = new Date().toISOString().split('T')[0];
  paymentType = 'ACV Payment';
  paymentNote = '';
  addingPayment = false;
  totalRecovered = 0;
  remainingRecoverable = 0;
  recoveryPct = 0;
  paymentTypes = [
    'ACV Payment',
    'RCV Holdback',
    'ALE Payment',
    'Ordinance & Law',
    'Contents Payment',
    'Supplemental Payment',
  ];

  get hasAciLineItems(): boolean {
    for (let i = 0; i < this.rooms.length; i++) {
      if (this.getLineItems(i).length > 0) return true;
    }
    return false;
  }

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private estimatingService: EstimatingService,
    private tabService: TabService,
    private dialogService: DialogService,
    private ngZone: NgZone,
    private elRef: ElementRef,
    private matDialog: MatDialog,
    private userService: UserService,
    private claimService: ClaimService,
    private fireClaimService: FireClaimService,
    private policyDocService: PolicyDocumentService,
    private financialEngine: ClaimFinancialEngineService,
  ) {}

  ngOnInit() {
    this.initForm();
    this.initPricingSearch();
    this.initDefenseNotesAutoSave();

    // Load current user info for supplement letter / email
    this.userService.currentUser.subscribe((user: any) => {
      if (user?.first_name) {
        this.adjusterFullName = `${user.first_name} ${user.last_name || ''}`.trim();
      }
      if (user?.email) {
        this.adjusterEmail = user.email;
      }
      if (user?.user_meta?.phone_number) {
        this.adjusterPhone = user.user_meta.phone_number;
      }
    });

    this.estimateId = this.route.snapshot.paramMap.get("id");
    if (this.estimateId) {
      this.isEditMode = true;
      this.tabService.setSideTitle("Edit Estimate");
      this.loadEstimate(this.estimateId);

      // Support query param to auto-switch view (e.g. ?view=blackout)
      const requestedView = this.route.snapshot.queryParamMap.get("view");
      if (requestedView === "blackout" || requestedView === "carrier" || requestedView === "supplement" || requestedView === "defense") {
        this._pendingView = requestedView;
      }
    } else {
      this.tabService.setSideTitle("New Estimate");
      // For new estimates, don't show form until mode is selected
      this.modeSelected = false;
    }
  }

  selectMode(mode: EstimateMode) {
    this.selectedMode = mode;
    this.currentModeConfig = ESTIMATE_MODE_MAP[mode];
    this.modeSelected = true;

    // Update dynamic lists from mode config
    this.roomTypeOptions = [...this.currentModeConfig.room_types];
    this.unitOptions = [...this.currentModeConfig.unit_options];
    this.activeCategoryList = this.buildCategoryList(this.currentModeConfig.line_item_categories);

    // If supplement mode, default to blackout view
    if (this.currentModeConfig.default_view && this.isEditMode) {
      this.activeView = this.currentModeConfig.default_view as any;
    }
  }

  private buildCategoryList(keys: string[]): { key: string; label: string; icon: string }[] {
    return keys.map(key => {
      const meta = CATEGORY_METADATA[key];
      return meta
        ? { key, label: meta.label, icon: meta.icon }
        : { key, label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), icon: 'category' };
    });
  }

  ngOnDestroy() {
    if (this.pricingSub) {
      this.pricingSub.unsubscribe();
    }
    if (this.defenseNotesSaveSub) {
      this.defenseNotesSaveSub.unsubscribe();
    }
  }

  // --- Resizable dividers ---

  onDividerMouseDown(event: MouseEvent, side: 'left' | 'right') {
    event.preventDefault();
    this.draggingDivider = side;
    this.dragStartX = event.clientX;
    this.dragStartWidth = side === 'left' ? this.leftPanelWidth : this.rightPanelWidth;
    this.isDragging = true;
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.draggingDivider) return;
    event.preventDefault();
    const delta = event.clientX - this.dragStartX;

    if (this.draggingDivider === 'left') {
      this.leftPanelWidth = Math.max(this.LEFT_MIN, Math.min(this.LEFT_MAX, this.dragStartWidth + delta));
    } else {
      // Right divider: dragging right shrinks the panel, dragging left grows it
      this.rightPanelWidth = Math.max(this.RIGHT_MIN, Math.min(this.RIGHT_MAX, this.dragStartWidth - delta));
    }
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    if (this.draggingDivider) {
      this.draggingDivider = null;
      this.isDragging = false;
    }
  }

  getPanelGridColumns(): string {
    if (this.leftPanelCollapsed && this.rightPanelCollapsed) {
      return '48px 6px 1fr 6px 48px';
    }
    if (this.leftPanelCollapsed) {
      return `48px 6px 1fr 6px ${this.rightPanelWidth}px`;
    }
    if (this.rightPanelCollapsed) {
      return `${this.leftPanelWidth}px 6px 1fr 6px 48px`;
    }
    return `${this.leftPanelWidth}px 6px 1fr 6px ${this.rightPanelWidth}px`;
  }

  initPricingSearch() {
    this.pricingSub = this.pricingSearchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged((prev, curr) => prev.key === curr.key && prev.query === curr.query),
        switchMap(({ key, query }) => {
          this.pricingSearching.set(key, true);
          return this.estimatingService.searchPricing(query).pipe(
            switchMap((results) => {
              this.pricingResults.set(key, results);
              this.pricingSearching.set(key, false);
              return [];
            })
          );
        })
      )
      .subscribe({
        error: () => {
          this.pricingSearching.clear();
        },
      });
  }

  loadEstimate(id: string) {
    this.saving = true;
    this.estimatingService.getEstimate(id).subscribe({
      next: (project: any) => {
        this.projectForm.patchValue({
          name: project.name,
          status: project.status,
          notes: project.notes,
        });

        // Clear existing rooms and rebuild from response
        this.rooms.clear();
        if (project.rooms) {
          for (const room of project.rooms) {
            const roomGroup = this.fb.group({
              id: [room.id],
              name: [room.name, Validators.required],
              room_type: [room.room_type || "", Validators.required],
              notes: [room.notes || ""],
              line_items: this.fb.array([]),
            });

            const lineItems = roomGroup.get("line_items") as FormArray;
            if (room.line_items) {
              for (const item of room.line_items) {
                lineItems.push(
                  this.fb.group({
                    id: [item.id],
                    description: [item.description, Validators.required],
                    length: [null],
                    width: [null],
                    height: [null],
                    quantity: [item.quantity || 1],
                    unit: [item.unit || "SF"],
                    material_cost: [item.unit_cost || 0],
                    labor_cost: [0],
                    status: [item.status || "approved"],
                    source: [item.source || "user"],
                    confidence: [item.confidence || null],
                    category: [item.category || "misc_items"],
                  })
                );
              }
            }
            this.rooms.push(roomGroup);

            // Load room photos
            if (room.photos && room.id) {
              this.roomPhotos.set(room.id, room.photos);
            }
          }
        }

        // Set mode from loaded project
        this.selectMode(project.estimate_mode || 'residential');

        // Store claim_id for claim file lookup
        if (project.claim_id) {
          this.estimateClaimId = project.claim_id;
        }

        // Load linked fire claim
        if (project.fire_claim) {
          this.linkedClaim = project.fire_claim;
          this.loadPolicy();
        }

        // Load pricing version info
        this.pricingRegion = project.pricing_region || null;
        if (project.pricing_version_id) {
          this.estimatingService.getPricingVersion(project.pricing_version_id).subscribe({
            next: (v) => { this.pricingVersionLabel = v.version_label; },
            error: () => { this.pricingVersionLabel = null; },
          });
        }

        // Load project-level photos
        if (project.photos) {
          this.projectPhotos = project.photos;
        }

        // Load carrier comparison data
        this.loadCarrierData();

        this.saving = false;
      },
      error: () => {
        this.snackBar.open("Failed to load estimate.", "Close", { duration: 3000 });
        this.saving = false;
        this.router.navigate(["/app/estimating"]);
      },
    });
  }

  initForm() {
    this.projectForm = this.fb.group({
      name: ["", Validators.required],
      status: ["draft"],
      notes: [""],
      rooms: this.fb.array([]),
    });
  }

  // --- Room helpers ---

  get rooms(): FormArray {
    return this.projectForm.get("rooms") as FormArray;
  }

  selectRoom(index: number) {
    if (index >= 0 && index < this.rooms.length) {
      this.selectedRoomIndex = index;
    }
  }

  get selectedRoom(): FormGroup | null {
    if (this.rooms.length === 0) return null;
    const idx = Math.min(this.selectedRoomIndex, this.rooms.length - 1);
    return this.rooms.at(idx) as FormGroup;
  }

  addRoom() {
    const roomGroup = this.fb.group({
      name: ["", Validators.required],
      room_type: ["", Validators.required],
      notes: [""],
      line_items: this.fb.array([]),
    });
    this.rooms.push(roomGroup);
    this.selectedRoomIndex = this.rooms.length - 1;
  }

  removeRoom(index: number) {
    this.rooms.removeAt(index);
    if (this.selectedRoomIndex >= this.rooms.length) {
      this.selectedRoomIndex = Math.max(0, this.rooms.length - 1);
    }
  }

  // Room rename
  renamingRoomIndex: number | null = null;

  getRoomName(index: number): string {
    const name = this.rooms.at(index).get("name")?.value;
    return name || "Room " + (index + 1);
  }

  startRenameRoom(index: number) {
    this.renamingRoomIndex = index;
    setTimeout(() => {
      const input = document.getElementById('room-rename-' + index) as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 50);
  }

  finishRenameRoom(index: number, value: string) {
    const trimmed = value.trim();
    if (trimmed) {
      this.rooms.at(index).get("name")?.setValue(trimmed);
    }
    this.renamingRoomIndex = null;
  }

  // --- Line item helpers ---

  getLineItems(roomIndex: number): FormArray {
    return this.rooms.at(roomIndex).get("line_items") as FormArray;
  }

  addLineItem(roomIndex: number, category: string = 'misc_items') {
    const lineItemGroup = this.fb.group({
      description: ["", Validators.required],
      length: [null],
      width: [null],
      height: [null],
      quantity: [1],
      unit: ["SF"],
      material_cost: [0],
      labor_cost: [0],
      status: ["approved"],
      source: ["user"],
      confidence: [null],
      category: [category],
    });
    this.getLineItems(roomIndex).push(lineItemGroup);
  }

  removeLineItem(roomIndex: number, itemIndex: number) {
    this.getLineItems(roomIndex).removeAt(itemIndex);
  }

  // --- Line item dialog methods ---

  openAddLineItemDialog(roomIndex: number, categoryKey: string, categoryLabel: string) {
    this.dialogService
      .openDialog(LineItemDialogComponent, {
        type: "add",
        category: categoryKey,
        categoryLabel: categoryLabel,
      }, { width: "520px", disableClose: false })
      .subscribe((result: any) => {
        if (!result) return;
        const lineItemGroup = this.fb.group({
          description: [result.description, Validators.required],
          length: [null],
          width: [null],
          height: [null],
          quantity: [result.quantity],
          unit: [result.unit],
          material_cost: [result.unitPrice],
          labor_cost: [0],
          status: ["approved"],
          source: ["user"],
          confidence: [null],
          category: [categoryKey],
        });
        this.getLineItems(roomIndex).push(lineItemGroup);
      });
  }

  openEditLineItemDialog(roomIndex: number, itemIndex: number) {
    const item = this.getLineItems(roomIndex).at(itemIndex);
    const category = item.get("category")?.value || "misc_items";
    const catDef = this.activeCategoryList.find((c) => c.key === category);
    const categoryLabel = catDef ? catDef.label : "Misc Items";

    this.dialogService
      .openDialog(LineItemDialogComponent, {
        type: "edit",
        category: category,
        categoryLabel: categoryLabel,
        item: {
          description: item.get("description")?.value || "",
          quantity: item.get("quantity")?.value || 1,
          unit: item.get("unit")?.value || "SF",
          unitPrice: item.get("material_cost")?.value || 0,
        },
      }, { width: "520px", disableClose: false })
      .subscribe((result: any) => {
        if (!result) return;
        item.patchValue({
          description: result.description,
          quantity: result.quantity,
          unit: result.unit,
          material_cost: result.unitPrice,
        });
      });
  }

  // --- Quick Add Library ---

  quickAddItem(categoryKey: string, item: { description: string; unit: string }) {
    const catDef = this.activeCategoryList.find(c => c.key === categoryKey);
    const categoryLabel = catDef ? catDef.label : 'Misc Items';

    this.dialogService
      .openDialog(LineItemDialogComponent, {
        type: "add",
        category: categoryKey,
        categoryLabel: categoryLabel,
        item: {
          description: item.description,
          quantity: 1,
          unit: item.unit,
          unitPrice: 0,
        },
      }, { width: "520px", disableClose: false })
      .subscribe((result: any) => {
        if (!result) return;
        const lineItemGroup = this.fb.group({
          description: [result.description, Validators.required],
          length: [null],
          width: [null],
          height: [null],
          quantity: [result.quantity],
          unit: [result.unit],
          material_cost: [result.unitPrice],
          labor_cost: [0],
          status: ["approved"],
          source: ["user"],
          confidence: [null],
          category: [categoryKey],
        });
        this.getLineItems(this.selectedRoomIndex).push(lineItemGroup);
      });
  }

  // --- Category helpers ---

  getLineItemsForCategory(roomIndex: number, category: string): { control: any; index: number }[] {
    const items = this.getLineItems(roomIndex);
    const result: { control: any; index: number }[] = [];
    for (let i = 0; i < items.length; i++) {
      const cat = items.at(i).get("category")?.value || "misc_items";
      if (cat === category) {
        result.push({ control: items.at(i), index: i });
      }
    }
    return result;
  }

  getCategorySubtotal(roomIndex: number, category: string): number {
    const catItems = this.getLineItemsForCategory(roomIndex, category);
    let total = 0;
    for (const ci of catItems) {
      total += this.getLineItemTotal(roomIndex, ci.index);
    }
    return total;
  }

  getCategoryItemCount(roomIndex: number, category: string): number {
    return this.getLineItemsForCategory(roomIndex, category).length;
  }

  private getCategoryCollapseKey(roomIndex: number, category: string): string {
    return `${roomIndex}-${category}`;
  }

  toggleCategoryCollapsed(roomIndex: number, category: string) {
    const key = this.getCategoryCollapseKey(roomIndex, category);
    this.categoryCollapsed.set(key, !this.isCategoryCollapsed(roomIndex, category));
  }

  isCategoryCollapsed(roomIndex: number, category: string): boolean {
    return this.categoryCollapsed.get(this.getCategoryCollapseKey(roomIndex, category)) || false;
  }

  setUnitPrice(roomIndex: number, itemIndex: number, value: number) {
    const item = this.getLineItems(roomIndex).at(itemIndex);
    item.patchValue({ material_cost: value, labor_cost: 0 });
  }

  // --- Measurement auto-calc ---

  autoCalcQuantity(roomIndex: number, itemIndex: number) {
    const item = this.getLineItems(roomIndex).at(itemIndex);
    const l = item.get("length")?.value;
    const w = item.get("width")?.value;
    const h = item.get("height")?.value;
    const unit = item.get("unit")?.value;

    if (!l || l <= 0) return;

    let qty: number | null = null;

    switch (unit) {
      case "SF":
        if (w && w > 0) qty = l * w;
        break;
      case "SY":
        if (w && w > 0) qty = (l * w) / 9;
        break;
      case "LF":
        qty = l;
        break;
      case "CF":
        if (w && w > 0 && h && h > 0) qty = l * w * h;
        break;
    }

    if (qty !== null) {
      item.patchValue({ quantity: Math.round(qty * 100) / 100 });
    }
  }

  onUnitChange(roomIndex: number, itemIndex: number) {
    this.autoCalcQuantity(roomIndex, itemIndex);
  }

  // --- Pricing search ---

  private getPricingKey(roomIndex: number, itemIndex: number): string {
    return `${roomIndex}-${itemIndex}`;
  }

  searchPricing(roomIndex: number, itemIndex: number, query: string) {
    const key = this.getPricingKey(roomIndex, itemIndex);
    if (query.length < 3) {
      this.pricingResults.delete(key);
      return;
    }
    this.pricingSearchSubject.next({ key, query });
  }

  getPricingResults(roomIndex: number, itemIndex: number): any[] {
    return this.pricingResults.get(this.getPricingKey(roomIndex, itemIndex)) || [];
  }

  isPricingSearching(roomIndex: number, itemIndex: number): boolean {
    return this.pricingSearching.get(this.getPricingKey(roomIndex, itemIndex)) || false;
  }

  selectPricingItem(roomIndex: number, itemIndex: number, item: any) {
    const lineItem = this.getLineItems(roomIndex).at(itemIndex);
    lineItem.patchValue({
      description: item.description || item.code,
      unit: item.unit || "EA",
      material_cost: item.material_cost || 0,
      labor_cost: item.labor_cost || 0,
      pricing_item_id: item.id,
      pricing_code: item.code,
      pricing_version_id: item.version_id,
    });
    this.pricingResults.delete(this.getPricingKey(roomIndex, itemIndex));
  }

  clearPricingResults(roomIndex: number, itemIndex: number) {
    this.pricingResults.delete(this.getPricingKey(roomIndex, itemIndex));
  }

  // --- Computed totals ---

  getLineItemTotal(roomIndex: number, itemIndex: number): number {
    const item = this.getLineItems(roomIndex).at(itemIndex);
    const qty = item.get("quantity")?.value || 0;
    const mat = item.get("material_cost")?.value || 0;
    const lab = item.get("labor_cost")?.value || 0;
    return (mat + lab) * qty;
  }

  getRoomSubtotal(roomIndex: number): number {
    const items = this.getLineItems(roomIndex);
    let total = 0;
    for (let i = 0; i < items.length; i++) {
      total += this.getLineItemTotal(roomIndex, i);
    }
    return total;
  }

  getMaterialTotal(): number {
    let total = 0;
    for (let r = 0; r < this.rooms.length; r++) {
      const items = this.getLineItems(r);
      for (let i = 0; i < items.length; i++) {
        const item = items.at(i);
        const qty = item.get("quantity")?.value || 0;
        const mat = item.get("material_cost")?.value || 0;
        total += mat * qty;
      }
    }
    return total;
  }

  getLaborTotal(): number {
    let total = 0;
    for (let r = 0; r < this.rooms.length; r++) {
      const items = this.getLineItems(r);
      for (let i = 0; i < items.length; i++) {
        const item = items.at(i);
        const qty = item.get("quantity")?.value || 0;
        const lab = item.get("labor_cost")?.value || 0;
        total += lab * qty;
      }
    }
    return total;
  }

  getGrandTotal(): number {
    return this.getMaterialTotal() + this.getLaborTotal();
  }

  // --- O&P ---

  setOP(percent: number) {
    this.opPercent = percent;
  }

  toggleStandardOP(checked: boolean) {
    this.opStandard = checked;
    if (checked) {
      this.overheadPercent = 10;
      this.profitPercent = 10;
    }
    this.syncOPPercent();
    this.opShowMinWarning = false;
  }

  onOverheadChange() {
    if (this.overheadPercent == null || this.overheadPercent < 0) this.overheadPercent = 0;
    this.syncOPPercent();
  }

  onProfitChange() {
    if (this.profitPercent == null || this.profitPercent < 0) this.profitPercent = 0;
    this.syncOPPercent();
  }

  private syncOPPercent() {
    this.opPercent = (this.overheadPercent || 0) + (this.profitPercent || 0);
    this.opShowMinWarning = this.opPercent < 20;
  }

  onOPChange() {
    if (this.opPercent < 20 || this.opPercent == null) {
      this.opShowMinWarning = true;
    } else {
      this.opShowMinWarning = false;
    }
  }

  onOPBlur() {
    if (this.opPercent < 20 || this.opPercent == null) {
      this.opPercent = 20;
      this.opShowMinWarning = true;
      setTimeout(() => { this.opShowMinWarning = false; }, 2000);
    }
  }

  getOverheadAmount(): number {
    return this.getGrandTotal() * (this.overheadPercent || 0) / 100;
  }

  getProfitAmount(): number {
    return this.getGrandTotal() * (this.profitPercent || 0) / 100;
  }

  getOPAmount(): number {
    return this.getOverheadAmount() + this.getProfitAmount();
  }

  getAdjustedTotal(): number {
    return this.getGrandTotal() + this.getOPAmount();
  }

  // --- Measurement import ---

  toggleMeasurementImport(roomIndex: number) {
    const current = this.showMeasurementImport.get(roomIndex) || false;
    this.showMeasurementImport.set(roomIndex, !current);
  }

  importMeasurements(roomIndex: number, jsonText: string) {
    try {
      const data = JSON.parse(jsonText);
      const l = data.length || 0;
      const w = data.width || 0;
      const h = data.height || 0;

      if (!l || !w) {
        this.snackBar.open("JSON must include length and width.", "Close", { duration: 3000 });
        return;
      }

      const sqft = l * w;

      // Add a line item with the calculated dimensions
      const lineItemGroup = this.fb.group({
        description: [`Room dimensions (${l}' x ${w}' x ${h}')`, Validators.required],
        length: [l],
        width: [w],
        height: [h],
        quantity: [sqft],
        unit: ["SF"],
        material_cost: [0],
        labor_cost: [0],
        status: ["approved"],
        source: ["user"],
        confidence: [null],
        category: ["floor"],
      });
      this.getLineItems(roomIndex).push(lineItemGroup);

      // If walls array present, add wall line items
      if (data.walls && Array.isArray(data.walls)) {
        for (const wall of data.walls) {
          const wl = wall.length || 0;
          const wh = wall.height || h || 0;
          if (wl > 0 && wh > 0) {
            const wallGroup = this.fb.group({
              description: [wall.name || `Wall (${wl}' x ${wh}')`, Validators.required],
              length: [wl],
              width: [wh],
              height: [null],
              quantity: [wl * wh],
              unit: ["SF"],
              material_cost: [0],
              labor_cost: [0],
              status: ["approved"],
              source: ["user"],
              confidence: [null],
              category: ["walls"],
            });
            this.getLineItems(roomIndex).push(wallGroup);
          }
        }
      }

      this.showMeasurementImport.set(roomIndex, false);
      this.snackBar.open(`Imported measurements: ${sqft} SF floor area.`, "Close", { duration: 3000 });
    } catch (e) {
      this.snackBar.open("Invalid JSON. Please check the format.", "Close", { duration: 3000 });
    }
  }

  // --- Photo methods ---

  onPhotoSelected(event: Event, roomId?: string) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !this.estimateId) return;

    const files = Array.from(input.files);
    const uploadKey = roomId || "project";
    this.photoUploading.set(uploadKey, true);
    this.photoUploadProgress.set(uploadKey, 0);

    let completed = 0;
    for (const file of files) {
      // Validate image type
      if (!["image/jpeg", "image/png"].includes(file.type)) {
        this.snackBar.open(`"${file.name}" is not a valid image (JPEG/PNG only).`, "Close", { duration: 3000 });
        completed++;
        if (completed === files.length) {
          this.photoUploading.set(uploadKey, false);
        }
        continue;
      }

      this.estimatingService
        .uploadPhoto(this.estimateId, file, undefined, undefined, roomId)
        .subscribe({
          next: (event) => {
            if (event.type === HttpEventType.UploadProgress && event.total) {
              const progress = Math.round((event.loaded / event.total) * 100);
              this.photoUploadProgress.set(uploadKey, progress);
            } else if (event.type === HttpEventType.Response && event.body) {
              const photo = event.body as EstimatePhoto;
              if (roomId) {
                const existing = this.roomPhotos.get(roomId) || [];
                this.roomPhotos.set(roomId, [...existing, photo]);
              } else {
                this.projectPhotos = [...this.projectPhotos, photo];
              }
              completed++;
              if (completed === files.length) {
                this.photoUploading.set(uploadKey, false);
                this.snackBar.open("Photo(s) uploaded.", "Close", { duration: 2000 });
              }
            }
          },
          error: () => {
            completed++;
            if (completed === files.length) {
              this.photoUploading.set(uploadKey, false);
            }
            this.snackBar.open("Failed to upload photo.", "Close", { duration: 3000 });
          },
        });
    }
    // Reset input so same file can be re-selected
    input.value = "";
  }

  updatePhotoCaption(photo: EstimatePhoto, caption: string) {
    if (!photo.id || photo.caption === caption) return;
    this.estimatingService.updatePhoto(photo.id, { caption }).subscribe({
      next: (updated) => {
        photo.caption = updated.caption;
      },
      error: () => {
        this.snackBar.open("Failed to update caption.", "Close", { duration: 3000 });
      },
    });
  }

  updatePhotoType(photo: EstimatePhoto, photoType: string) {
    if (!photo.id) return;
    this.estimatingService.updatePhoto(photo.id, { photo_type: photoType }).subscribe({
      next: (updated) => {
        photo.photo_type = updated.photo_type;
      },
      error: () => {
        this.snackBar.open("Failed to update photo type.", "Close", { duration: 3000 });
      },
    });
  }

  deletePhoto(photo: EstimatePhoto) {
    if (!photo.id) return;
    this.estimatingService.deletePhoto(photo.id).subscribe({
      next: () => {
        if (photo.room_id) {
          const existing = this.roomPhotos.get(photo.room_id) || [];
          this.roomPhotos.set(
            photo.room_id,
            existing.filter((p) => p.id !== photo.id)
          );
        } else {
          this.projectPhotos = this.projectPhotos.filter((p) => p.id !== photo.id);
        }
        this.snackBar.open("Photo deleted.", "Close", { duration: 2000 });
      },
      error: () => {
        this.snackBar.open("Failed to delete photo.", "Close", { duration: 3000 });
      },
    });
  }

  getRoomPhotos(roomIndex: number): EstimatePhoto[] {
    const roomId = this.rooms.at(roomIndex)?.get("id")?.value;
    if (!roomId) return [];
    return this.roomPhotos.get(roomId) || [];
  }

  getRoomId(roomIndex: number): string | undefined {
    return this.rooms.at(roomIndex)?.get("id")?.value;
  }

  openPhotoPreview(photo: EstimatePhoto) {
    this.selectedPhotoForPreview = photo;
  }

  closePhotoPreview() {
    this.selectedPhotoForPreview = null;
  }

  isPhotoUploading(key: string): boolean {
    return this.photoUploading.get(key) || false;
  }

  getPhotoUploadProgress(key: string): number {
    return this.photoUploadProgress.get(key) || 0;
  }

  // --- PDF Export ---

  exportPDF() {
    const doc = new jsPDF("p", "pt", "letter");
    const formValue = this.projectForm.value;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 40;

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Property Damage Estimate", 40, y);
    y += 24;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Name: ${formValue.name || "Untitled"}`, 40, y);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - 180, y);
    y += 14;
    doc.text(`Status: ${(formValue.status || "draft").replace(/_/g, " ")}`, 40, y);
    y += 10;

    if (formValue.notes) {
      doc.text(`Notes: ${this.stripMarkdown(formValue.notes)}`, 40, y);
      y += 10;
    }
    y += 10;

    // Rooms
    for (let r = 0; r < (formValue.rooms || []).length; r++) {
      const room = formValue.rooms[r];

      // Room header
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      const roomLabel = room.name ? `Room: ${room.name}` : `Room ${r + 1}`;
      doc.text(roomLabel, 40, y);
      y += 6;

      if ((room.line_items || []).length > 0) {
        // Group items by category
        for (const cat of this.activeCategoryList) {
          const catItems = this.getLineItemsForCategory(r, cat.key);
          if (catItems.length === 0) continue;

          // Category sub-header
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.text(`${cat.label}`, 50, y);
          y += 4;

          const tableData = catItems.map((ci) => {
            const item = ci.control;
            const qty = item.get("quantity")?.value || 0;
            const mat = item.get("material_cost")?.value || 0;
            const lab = item.get("labor_cost")?.value || 0;
            const unitPrice = mat + lab;
            const total = unitPrice * qty;
            return [
              this.stripMarkdown(item.get("description")?.value || ""),
              qty.toString(),
              item.get("unit")?.value || "SF",
              `$${unitPrice.toFixed(2)}`,
              `$${total.toFixed(2)}`,
            ];
          });

          const catSubtotal = this.getCategorySubtotal(r, cat.key);
          tableData.push(["", "", "", `${cat.label} Subtotal:`, `$${catSubtotal.toFixed(2)}`]);

          autoTable(doc, {
            startY: y,
            head: [["Description", "Qty", "Unit", "Unit Price", "Total"]],
            body: tableData,
            margin: { left: 50, right: 40 },
            styles: { fontSize: 8 },
            headStyles: { fillColor: [66, 133, 244] },
            didParseCell: (data: any) => {
              if (data.row.index === tableData.length - 1) {
                data.cell.styles.fontStyle = "bold";
              }
            },
          });

          y = (doc as any).lastAutoTable.finalY + 8;
        }

        // Room subtotal
        const roomSubtotal = this.getRoomSubtotal(r);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Room Subtotal: $${roomSubtotal.toFixed(2)}`, pageWidth - 200, y);
        y += 16;
      } else {
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.text("No line items", 50, y);
        y += 16;
      }
    }

    // Summary
    y += 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 40, y);
    y += 18;

    const summaryData: string[][] = [
      ["Material Total", `$${this.getMaterialTotal().toFixed(2)}`],
      ["Labor Total", `$${this.getLaborTotal().toFixed(2)}`],
      ["Subtotal", `$${this.getGrandTotal().toFixed(2)}`],
    ];

    if (this.opPercent > 0) {
      summaryData.push([`Overhead & Profit (${this.opPercent}%)`, `$${this.getOPAmount().toFixed(2)}`]);
    }

    summaryData.push(["Grand Total", `$${this.getAdjustedTotal().toFixed(2)}`]);

    autoTable(doc, {
      startY: y,
      body: summaryData,
      margin: { left: 40, right: 40 },
      styles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 200 },
        1: { halign: "right", cellWidth: 120 },
      },
      didParseCell: (data: any) => {
        if (data.row.index === summaryData.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fontSize = 12;
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 20;

    // Photo Appendix
    const allPhotos: { caption: string; url: string; context: string }[] = [];
    for (const photo of this.projectPhotos) {
      allPhotos.push({
        caption: photo.caption || "(no caption)",
        url: photo.image_url || "",
        context: "Project",
      });
    }
    for (let r = 0; r < (formValue.rooms || []).length; r++) {
      const roomId = this.getRoomId(r);
      const roomName = formValue.rooms[r].name || `Room ${r + 1}`;
      if (roomId) {
        const photos = this.roomPhotos.get(roomId) || [];
        for (const photo of photos) {
          allPhotos.push({
            caption: photo.caption || "(no caption)",
            url: photo.image_url || "",
            context: roomName,
          });
        }
      }
    }

    if (allPhotos.length > 0) {
      // Check if we need a new page
      const pageHeight = doc.internal.pageSize.getHeight();
      if (y > pageHeight - 100) {
        doc.addPage();
        y = 40;
      }

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Photo Appendix", 40, y);
      y += 6;

      const photoTableData = allPhotos.map((p) => [p.context, p.caption, p.url]);

      autoTable(doc, {
        startY: y,
        head: [["Location", "Caption", "URL"]],
        body: photoTableData,
        margin: { left: 40, right: 40 },
        styles: { fontSize: 8 },
        headStyles: { fillColor: [25, 118, 210] },
        columnStyles: {
          2: { cellWidth: 200 },
        },
      });

      y = (doc as any).lastAutoTable.finalY + 20;
    }

    // Footer on all pages
    const totalPages = doc.getNumberOfPages();
    const preparedDate = new Date().toLocaleDateString();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.text(
        `Property Damage Estimate | Prepared ${preparedDate} | Page ${p} of ${totalPages}`,
        40,
        doc.internal.pageSize.getHeight() - 30
      );
      doc.setFont("helvetica", "normal");
      doc.text(
        "Prepared using the ACI Adjuster Intelligence\u2122 Claims Analysis Engine.",
        40,
        doc.internal.pageSize.getHeight() - 20
      );
    }

    // Save
    const safeName = (formValue.name || "Estimate").replace(/[^a-zA-Z0-9]/g, "_");
    const dateStr = new Date().toISOString().split("T")[0];
    doc.save(`Estimate-${safeName}-${dateStr}.pdf`);
  }

  // --- Suggest from Photos ---

  suggestEstimate() {
    if (!this.estimateId) return;
    this.suggesting = true;
    this.estimatingService.suggestFromPhotos(this.estimateId).subscribe({
      next: () => {
        this.loadEstimate(this.estimateId!);
        this.suggesting = false;
        this.snackBar.open("Suggested line items generated.", "Close", { duration: 3000 });
      },
      error: () => {
        this.suggesting = false;
        this.snackBar.open("Failed to generate suggestions.", "Close", { duration: 3000 });
      },
    });
  }

  approveLineItem(roomIndex: number, itemIndex: number) {
    const item = this.getLineItems(roomIndex).at(itemIndex);
    const itemId = item.get("id")?.value;
    if (!itemId) return;

    this.estimatingService.approveLineItem(itemId).subscribe({
      next: () => {
        item.patchValue({ status: "approved" });
        this.snackBar.open("Line item approved.", "Close", { duration: 2000 });
      },
      error: () => {
        this.snackBar.open("Failed to approve line item.", "Close", { duration: 3000 });
      },
    });
  }

  rejectLineItem(roomIndex: number, itemIndex: number) {
    const item = this.getLineItems(roomIndex).at(itemIndex);
    const itemId = item.get("id")?.value;
    if (!itemId) return;

    this.estimatingService.rejectLineItem(itemId).subscribe({
      next: () => {
        this.getLineItems(roomIndex).removeAt(itemIndex);
        this.snackBar.open("Suggested item rejected.", "Close", { duration: 2000 });
      },
      error: () => {
        this.snackBar.open("Failed to reject line item.", "Close", { duration: 3000 });
      },
    });
  }

  approveAllInRoom(roomIndex: number) {
    const lineItems = this.getLineItems(roomIndex);
    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems.at(i);
      if (item.get("status")?.value === "suggested") {
        const itemId = item.get("id")?.value;
        if (itemId) {
          this.estimatingService.approveLineItem(itemId).subscribe({
            next: () => {
              item.patchValue({ status: "approved" });
            },
          });
        }
      }
    }
    this.snackBar.open("Approving all suggested items in room...", "Close", { duration: 2000 });
  }

  getLineItemStatus(roomIndex: number, itemIndex: number): string {
    return this.getLineItems(roomIndex).at(itemIndex).get("status")?.value || "approved";
  }

  getLineItemSource(roomIndex: number, itemIndex: number): string {
    return this.getLineItems(roomIndex).at(itemIndex).get("source")?.value || "user";
  }

  isSuggested(roomIndex: number, itemIndex: number): boolean {
    return this.getLineItemStatus(roomIndex, itemIndex) === "suggested";
  }

  hasSuggestedItems(roomIndex: number): boolean {
    const lineItems = this.getLineItems(roomIndex);
    for (let i = 0; i < lineItems.length; i++) {
      if (lineItems.at(i).get("status")?.value === "suggested") return true;
    }
    return false;
  }

  countSuggested(): number {
    let count = 0;
    for (let r = 0; r < this.rooms.length; r++) {
      const items = this.getLineItems(r);
      for (let i = 0; i < items.length; i++) {
        if (items.at(i).get("status")?.value === "suggested") count++;
      }
    }
    return count;
  }

  shouldShowLineItem(roomIndex: number, itemIndex: number): boolean {
    if (!this.showSuggestedOnly) return true;
    return this.isSuggested(roomIndex, itemIndex);
  }

  // --- Validation helpers ---

  markFormGroupTouched(group: AbstractControl) {
    if (group instanceof FormControl) {
      group.markAsTouched();
      group.markAsDirty();
    } else if (group instanceof FormGroup) {
      Object.values(group.controls).forEach((c) => this.markFormGroupTouched(c));
    } else if (group instanceof FormArray) {
      group.controls.forEach((c) => this.markFormGroupTouched(c));
    }
  }

  collectValidationErrors(): { field: string; message: string; elementId: string }[] {
    const errors: { field: string; message: string; elementId: string }[] = [];

    if (this.projectForm.get("name")?.hasError("required")) {
      errors.push({
        field: "name",
        message: "Estimate Name is required (e.g. Smith Residence Fire Damage)",
        elementId: "project-name",
      });
    }

    for (let ri = 0; ri < this.rooms.length; ri++) {
      const room = this.rooms.at(ri) as FormGroup;
      const roomLabel = room.get("name")?.value || `Room ${ri + 1}`;

      if (room.get("name")?.hasError("required")) {
        errors.push({
          field: `room-${ri}-name`,
          message: `Room ${ri + 1}: Room Name is required (e.g. Kitchen)`,
          elementId: `room-${ri}-name`,
        });
      }

      if (room.get("room_type")?.hasError("required")) {
        errors.push({
          field: `room-${ri}-type`,
          message: `Room ${ri + 1}: Select a Room Type (Kitchen, Living Room, Bedroom…)`,
          elementId: `room-${ri}-type`,
        });
      }

      const lineItems = this.getLineItems(ri);
      for (let ii = 0; ii < lineItems.length; ii++) {
        const item = lineItems.at(ii);
        if (item.get("description")?.hasError("required")) {
          errors.push({
            field: `room-${ri}-item-${ii}-desc`,
            message: `${roomLabel}, Item ${ii + 1}: Description is required`,
            elementId: `room-${ri}-item-${ii}-desc`,
          });
        }
      }
    }

    return errors;
  }

  scrollToFirstError() {
    if (this.validationErrors.length === 0) return;
    this.navigateToErrorElement(this.validationErrors[0]);
  }

  jumpToError(error: { field: string; message: string; elementId: string }) {
    this.navigateToErrorElement(error);
  }

  private navigateToErrorElement(error: { elementId: string }) {
    // Parse room index from elementId pattern "room-{ri}-*"
    const match = error.elementId.match(/^room-(\d+)/);
    if (match) {
      const roomIdx = parseInt(match[1], 10);
      if (roomIdx !== this.selectedRoomIndex && roomIdx < this.rooms.length) {
        this.selectedRoomIndex = roomIdx;
      }
    }
    setTimeout(() => {
      const el = document.getElementById(error.elementId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
      }
    }, 150);
  }

  getSuggestButtonTooltip(): string {
    if (!this.estimateId) return "Save the estimate first to enable ACI Scope Generator";
    if (this.rooms.length === 0) return "Add at least one room to enable ACI Scope Generator";
    return "Generate scope items for all rooms using ACI Adjuster Intelligence";
  }

  getTotalPhotoCount(): number {
    let count = this.projectPhotos.length;
    this.roomPhotos.forEach((photos) => (count += photos.length));
    return count;
  }

  togglePhotoSelection(photoId: string) {
    if (this.selectedPhotoIds.has(photoId)) {
      this.selectedPhotoIds.delete(photoId);
    } else {
      this.selectedPhotoIds.add(photoId);
    }
  }

  isPhotoSelected(photoId: string): boolean {
    return this.selectedPhotoIds.has(photoId);
  }

  selectAllPhotos() {
    for (const p of this.projectPhotos) {
      if (p.id) this.selectedPhotoIds.add(p.id);
    }
    this.roomPhotos.forEach((photos) => {
      for (const p of photos) {
        if (p.id) this.selectedPhotoIds.add(p.id);
      }
    });
  }

  deselectAllPhotos() {
    this.selectedPhotoIds.clear();
  }

  // --- ACI Adjuster Intelligence ---

  generateAIScope() {
    if (!this.estimateId) return;
    this.aciPanelSource = 'scope';
    this.aiAnalyzing = true;
    this.showAIPanel = true;
    this.estimatingService.analyzeForScope(this.estimateId).subscribe({
      next: (results: any) => {
        this.aiAnalysisResults = results;
        this.aiAnalyzing = false;
      },
      error: () => {
        this.aiAnalyzing = false;
        this.showAIPanel = false;
        this.snackBar.open("ACI Scope Generator failed. Please try again.", "Close", { duration: 3000 });
      },
    });
  }

  analyzePhotos() {
    if (!this.estimateId) return;
    this.aciPanelSource = 'photos';
    this.photoAnalyzing = true;
    this.showAIPanel = true;
    this.estimatingService.analyzePhotos(this.estimateId).subscribe({
      next: (results: any) => {
        this.aiAnalysisResults = results;
        this.photoAnalyzing = false;
      },
      error: () => {
        this.photoAnalyzing = false;
        this.showAIPanel = false;
        this.snackBar.open("ACI Damage Analysis failed. Please try again.", "Close", { duration: 3000 });
      },
    });
  }

  getPhotoAnalysisTooltip(): string {
    if (!this.estimateId) return "Save the estimate first";
    const total = this.getTotalPhotoCount();
    if (total === 0) return "Upload photos first";
    return `Analyze ${total} photo(s) with ACI Damage Analysis`;
  }

  private stripMarkdown(text: string): string {
    if (!text) return text;
    text = text.replace(/#{1,6}\s*/g, '');
    text = text.replace(/\*\*(.*?)\*\*/g, '$1');
    text = text.replace(/__(.*?)__/g, '$1');
    text = text.replace(/(?<!\w)\*(.*?)\*(?!\w)/g, '$1');
    text = text.replace(/^\s*[-*+]\s+/gm, '');
    text = text.replace(/^\s*\d+\.\s+/gm, '');
    return text.trim();
  }

  approveAISuggestion(roomIdx: number, sugIdx: number) {
    const room = this.aiAnalysisResults.rooms[roomIdx];
    const sug = room.suggestions[sugIdx];

    // Find matching form room by name or create line item in first matching room
    let targetRoomIndex = -1;
    for (let i = 0; i < this.rooms.length; i++) {
      const roomName = this.rooms.at(i).get("name")?.value?.toLowerCase();
      if (roomName === room.room_name?.toLowerCase()) {
        targetRoomIndex = i;
        break;
      }
    }
    if (targetRoomIndex === -1 && this.rooms.length > 0) {
      targetRoomIndex = 0;
    }
    if (targetRoomIndex === -1) return;

    const lineItemGroup = this.fb.group({
      description: [sug.description, Validators.required],
      length: [null],
      width: [null],
      height: [null],
      quantity: [sug.quantity],
      unit: [sug.unit],
      material_cost: [sug.unit_price],
      labor_cost: [0],
      status: ["approved"],
      source: ["ai"],
      confidence: [sug.confidence || null],
      category: [sug.category || "misc_items"],
    });
    this.getLineItems(targetRoomIndex).push(lineItemGroup);

    // Remove from AI results
    room.suggestions.splice(sugIdx, 1);
    this.recalcAITotal();
    this.snackBar.open("Item added to estimate.", "Close", { duration: 2000 });
  }

  editAISuggestion(roomIdx: number, sugIdx: number) {
    const room = this.aiAnalysisResults.rooms[roomIdx];
    const sug = room.suggestions[sugIdx];
    const catDef = this.activeCategoryList.find((c) => c.key === (sug.category || "misc_items"));
    const categoryLabel = catDef ? catDef.label : "Misc Items";

    this.dialogService
      .openDialog(LineItemDialogComponent, {
        type: "edit",
        category: sug.category || "misc_items",
        categoryLabel: categoryLabel,
        item: {
          description: sug.description,
          quantity: sug.quantity,
          unit: sug.unit,
          unitPrice: sug.unit_price,
        },
      }, { width: "520px", disableClose: false })
      .subscribe((result: any) => {
        if (!result) return;

        // Find matching form room
        let targetRoomIndex = -1;
        for (let i = 0; i < this.rooms.length; i++) {
          const roomName = this.rooms.at(i).get("name")?.value?.toLowerCase();
          if (roomName === room.room_name?.toLowerCase()) {
            targetRoomIndex = i;
            break;
          }
        }
        if (targetRoomIndex === -1 && this.rooms.length > 0) {
          targetRoomIndex = 0;
        }
        if (targetRoomIndex === -1) return;

        const lineItemGroup = this.fb.group({
          description: [result.description, Validators.required],
          length: [null],
          width: [null],
          height: [null],
          quantity: [result.quantity],
          unit: [result.unit],
          material_cost: [result.unitPrice],
          labor_cost: [0],
          status: ["approved"],
          source: ["ai"],
          confidence: [null],
          category: [sug.category || "misc_items"],
        });
        this.getLineItems(targetRoomIndex).push(lineItemGroup);

        // Remove from AI results
        room.suggestions.splice(sugIdx, 1);
        this.recalcAITotal();
        this.snackBar.open("Edited item added to estimate.", "Close", { duration: 2000 });
      });
  }

  dismissAISuggestion(roomIdx: number, sugIdx: number) {
    this.aiAnalysisResults.rooms[roomIdx].suggestions.splice(sugIdx, 1);
    this.recalcAITotal();
  }

  approveAllAIForRoom(roomIdx: number) {
    const room = this.aiAnalysisResults.rooms[roomIdx];
    while (room.suggestions.length > 0) {
      this.approveAISuggestion(roomIdx, 0);
    }
  }

  approveAllAI() {
    if (!this.aiAnalysisResults) return;
    for (let r = 0; r < this.aiAnalysisResults.rooms.length; r++) {
      this.approveAllAIForRoom(r);
    }
    this.closeAIPanel();
    this.snackBar.open("All ACI suggestions added to estimate.", "Close", { duration: 3000 });
  }

  closeAIPanel() {
    this.showAIPanel = false;
    this.aiAnalysisResults = null;
  }

  getAISuggestionsByCategory(roomIdx: number): { category: string; label: string; icon: string; suggestions: { sug: any; originalIndex: number }[] }[] {
    const room = this.aiAnalysisResults?.rooms?.[roomIdx];
    if (!room || !room.suggestions) return [];
    const grouped: Record<string, { sug: any; originalIndex: number }[]> = {};
    room.suggestions.forEach((sug: any, idx: number) => {
      const cat = sug.category || 'misc_items';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({ sug, originalIndex: idx });
    });
    return this.activeCategoryList
      .filter(c => grouped[c.key] && grouped[c.key].length > 0)
      .map(c => ({ category: c.key, label: c.label, icon: c.icon, suggestions: grouped[c.key] }));
  }

  getAICategorySubtotal(roomIdx: number, categoryKey: string): number {
    const room = this.aiAnalysisResults?.rooms?.[roomIdx];
    if (!room) return 0;
    return (room.suggestions || [])
      .filter((s: any) => (s.category || 'misc_items') === categoryKey)
      .reduce((sum: number, s: any) => sum + (s.total || 0), 0);
  }

  private recalcAITotal() {
    if (!this.aiAnalysisResults) return;
    let total = 0;
    for (const room of this.aiAnalysisResults.rooms) {
      for (const sug of room.suggestions) {
        total += sug.total || 0;
      }
    }
    this.aiAnalysisResults.total_estimated = total;
  }

  getDamageTypeLabel(key: string): string {
    const labels: Record<string, string> = {
      fire_damage: "Fire",
      smoke_damage: "Smoke",
      water_damage: "Water",
      mold_damage: "Mold",
      structural_damage: "Structural",
      roof_damage: "Roof",
      content_damage: "Content",
    };
    return labels[key] || key;
  }

  getDamageTypeIcon(key: string): string {
    const icons: Record<string, string> = {
      fire_damage: "local_fire_department",
      smoke_damage: "cloud",
      water_damage: "water_drop",
      mold_damage: "biotech",
      structural_damage: "foundation",
      roof_damage: "roofing",
      content_damage: "inventory_2",
    };
    return icons[key] || "help_outline";
  }

  getRemainingAISuggestionCount(): number {
    if (!this.aiAnalysisResults) return 0;
    let count = 0;
    for (const room of this.aiAnalysisResults.rooms) {
      count += room.suggestions.length;
    }
    return count;
  }

  // --- Save ---

  saveEstimate() {
    this.markFormGroupTouched(this.projectForm);
    this.validationErrors = this.collectValidationErrors();
    this.showValidation = true;

    if (this.validationErrors.length > 0) {
      this.snackBar.open(
        `${this.validationErrors.length} issue(s) found — see highlighted fields`,
        "Close",
        { duration: 4000 }
      );
      this.scrollToFirstError();
      return;
    }

    this.showValidation = false;

    this.saving = true;
    const formValue = this.projectForm.value;

    const payload = {
      name: formValue.name,
      status: formValue.status,
      estimate_mode: this.selectedMode || 'residential',
      notes: formValue.notes,
      rooms: formValue.rooms.map((room: any) => ({
        name: room.name,
        room_type: room.room_type,
        notes: room.notes,
        line_items: room.line_items.map((item: any) => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          material_cost: item.material_cost,
          labor_cost: item.labor_cost,
          unit_cost: (item.material_cost || 0) + (item.labor_cost || 0),
          total_cost:
            ((item.material_cost || 0) + (item.labor_cost || 0)) *
            (item.quantity || 0),
          status: item.status || "approved",
          source: item.source || "user",
          confidence: item.confidence || null,
          category: item.category || "misc_items",
        })),
      })),
      total_cost: this.getAdjustedTotal(),
      overhead_profit_percent: this.opPercent,
    };

    if (this.isEditMode && this.estimateId) {
      this.estimatingService.updateEstimate(this.estimateId, payload).subscribe({
        next: () => {
          this.snackBar.open("Estimate updated.", "Close", { duration: 3000 });
          this.saving = false;
        },
        error: () => {
          this.snackBar.open("Failed to update estimate.", "Close", {
            duration: 3000,
          });
          this.saving = false;
        },
      });
    } else {
      this.estimatingService.createEstimate(payload).subscribe({
        next: () => {
          this.snackBar.open("Estimate created.", "Close", { duration: 3000 });
          this.saving = false;
          this.router.navigate(["/app/estimating"]);
        },
        error: () => {
          this.snackBar.open("Failed to create estimate.", "Close", {
            duration: 3000,
          });
          this.saving = false;
        },
      });
    }
  }

  // --- Carrier Comparison ---

  loadCarrierData() {
    if (!this.estimateId) return;

    this.estimatingService.getCarrierEstimates(this.estimateId).subscribe({
      next: (estimates) => {
        this.carrierEstimates = estimates;
        if (estimates.length > 0 && !this.selectedCarrierEstimate) {
          this.selectedCarrierEstimate = estimates[0];
        }
      },
    });

    this.estimatingService.getComparison(this.estimateId).subscribe({
      next: (result) => {
        if (result) {
          this.comparisonResult = result;
          // Auto-switch view if requested via query param
          if (this._pendingView && (this._pendingView === 'blackout' || this._pendingView === 'supplement' || this._pendingView === 'defense')) {
            if (this._pendingView === 'defense') {
              this.openDefenseView();
            } else {
              this.activeView = this._pendingView as any;
            }
            this._pendingView = null;
          }
        }
      },
    });

    this.loadCarrierPayments();
    this.loadDefenseNotes();
  }

  loadCarrierPayments() {
    if (!this.estimateId) return;
    this.estimatingService.getCarrierPayments(this.estimateId).subscribe({
      next: (payments) => {
        this.carrierPayments = payments;
        this.totalRecovered = payments.reduce((sum: number, p: any) => sum + (p.payment_amount || 0), 0);
        const recoverable = this.comparisonResult?.supplement_total || 0;
        this.recoveryPct = recoverable > 0 ? (this.totalRecovered / recoverable) * 100 : 0;
        this.remainingRecoverable = Math.max(0, recoverable - this.totalRecovered);
      },
    });
  }

  addPayment() {
    if (!this.estimateId || !this.paymentAmount || this.addingPayment) return;
    this.addingPayment = true;
    this.estimatingService.createCarrierPayment(this.estimateId, {
      payment_amount: this.paymentAmount,
      payment_date: this.paymentDate,
      payment_type: this.paymentType,
      note: this.paymentNote || undefined,
    }).subscribe({
      next: () => {
        this.snackBar.open('Payment recorded.', 'Close', { duration: 3000 });
        this.cancelPayment();
        this.addingPayment = false;
        this.loadCarrierPayments();
      },
      error: () => {
        this.snackBar.open('Failed to record payment.', 'Close', { duration: 3000 });
        this.addingPayment = false;
      },
    });
  }

  cancelPayment() {
    this.paymentAmount = null;
    this.paymentDate = new Date().toISOString().split('T')[0];
    this.paymentType = 'ACV Payment';
    this.paymentNote = '';
  }

  deletePayment(paymentId: string) {
    if (!this.estimateId) return;
    this.estimatingService.deleteCarrierPayment(this.estimateId, paymentId).subscribe({
      next: () => {
        this.snackBar.open('Payment deleted.', 'Close', { duration: 3000 });
        this.loadCarrierPayments();
      },
      error: () => {
        this.snackBar.open('Failed to delete payment.', 'Close', { duration: 3000 });
      },
    });
  }

  onCarrierFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || !this.estimateId) return;

    const file = input.files[0];
    const carrierName = prompt("Enter carrier name (e.g. State Farm):");
    if (!carrierName) return;

    this.carrierUploading = true;
    this.estimatingService.previewCarrierEstimate(this.estimateId, file).subscribe({
      next: (event: any) => {
        if (event.type === HttpEventType.Response) {
          this.carrierUploading = false;
          const preview: CarrierPreviewResult = event.body;
          this._openPreviewDialog({
            preview,
            carrierName,
            fileName: file.name,
            uploadType: "pdf",
          });
        }
      },
      error: () => {
        this.carrierUploading = false;
        this.snackBar.open("Failed to parse carrier estimate.", "Close", { duration: 3000 });
      },
    });
    input.value = "";
  }

  showCarrierPasteDialog() {
    const dialogRef = this.matDialog.open(CarrierPasteDialogComponent, {
      width: "600px",
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (!result || !this.estimateId) return;
      this.carrierUploading = true;
      this.estimatingService
        .previewPasteCarrierEstimate(this.estimateId, result.carrier_name, result.pasted_text)
        .subscribe({
          next: (preview) => {
            this.carrierUploading = false;
            this._openPreviewDialog({
              preview,
              carrierName: result.carrier_name,
              uploadType: "paste",
              pastedText: result.pasted_text,
            });
          },
          error: () => {
            this.carrierUploading = false;
            this.snackBar.open("Failed to parse carrier estimate.", "Close", { duration: 3000 });
          },
        });
    });
  }

  private _openPreviewDialog(data: CarrierPreviewDialogData) {
    const dialogRef = this.matDialog.open(CarrierPreviewDialogComponent, {
      width: "95vw",
      maxWidth: "1100px",
      maxHeight: "90vh",
      data,
    });

    dialogRef.afterClosed().subscribe((result: CarrierPreviewDialogResult | null) => {
      if (!result?.confirmed || !this.estimateId) return;

      this.carrierUploading = true;
      this.estimatingService
        .confirmCarrierEstimate(this.estimateId, {
          carrier_name: result.carrierName,
          file_key: result.fileKey,
          file_name: result.fileName,
          upload_type: result.uploadType,
          parser_type: result.parserType,
          parse_confidence: result.parseConfidence,
          pasted_text: result.pastedText,
          items: result.items,
        })
        .subscribe({
          next: (estimate) => {
            this.carrierUploading = false;
            this.carrierEstimates.unshift(estimate);
            this.selectedCarrierEstimate = estimate;

            // Auto-run comparison if ACI line items exist
            if (this.hasAciLineItems && estimate.id) {
              this.autoRunComparison(estimate);
            } else {
              this.snackBar.open(
                `Carrier estimate saved: ${estimate.line_items?.length || 0} line items`,
                "Close",
                { duration: 5000 }
              );
            }
          },
          error: () => {
            this.carrierUploading = false;
            this.snackBar.open("Failed to save carrier estimate.", "Close", { duration: 3000 });
          },
        });
    });
  }

  private autoRunComparison(estimate: CarrierEstimate): void {
    if (!this.estimateId || !estimate.id) return;
    this.comparisonLoading = true;
    this.estimatingService
      .runComparison(this.estimateId, estimate.id, this.priceThreshold)
      .subscribe({
        next: (result) => {
          this.comparisonResult = result;
          this.comparisonLoading = false;
          this.activeView = 'blackout';
          this.snackBar.open(
            'Carrier estimate saved & comparison auto-completed',
            'Close',
            { duration: 5000 }
          );
        },
        error: () => {
          this.comparisonLoading = false;
          this.snackBar.open(
            `Carrier estimate saved: ${estimate.line_items?.length || 0} line items (auto-comparison failed)`,
            'Close',
            { duration: 5000 }
          );
        },
      });
  }

  selectCarrierEstimate(ce: CarrierEstimate) {
    this.selectedCarrierEstimate = ce;
  }

  deleteCarrierEstimate(ce: CarrierEstimate) {
    if (!ce.id) return;
    if (!confirm(`Delete carrier estimate from "${ce.carrier_name}"?`)) return;

    this.estimatingService.deleteCarrierEstimate(ce.id).subscribe({
      next: () => {
        this.carrierEstimates = this.carrierEstimates.filter((e) => e.id !== ce.id);
        if (this.selectedCarrierEstimate?.id === ce.id) {
          this.selectedCarrierEstimate = this.carrierEstimates[0] || null;
        }
        this.snackBar.open("Carrier estimate deleted.", "Close", { duration: 3000 });
      },
    });
  }

  runComparison() {
    if (!this.estimateId || !this.selectedCarrierEstimate?.id) return;
    if (!this.hasAciLineItems) {
      this.snackBar.open("Create an ACI estimate first before comparing with a carrier estimate.", "Close", { duration: 4000 });
      return;
    }

    // If comparison already exists for this carrier estimate, show it instead of re-calling
    if (
      this.comparisonResult &&
      this.comparisonResult.carrier_estimate_id === this.selectedCarrierEstimate.id
    ) {
      this.activeView = "blackout";
      this.snackBar.open("Comparison already completed — showing results.", "Close", { duration: 3000 });
      return;
    }

    this.comparisonLoading = true;
    this.estimatingService
      .runComparison(this.estimateId, this.selectedCarrierEstimate.id, this.priceThreshold)
      .subscribe({
        next: (result) => {
          this.comparisonResult = result;
          this.comparisonLoading = false;
          this.activeView = "blackout";
          this.snackBar.open("Comparison complete!", "Close", { duration: 3000 });
        },
        error: (err) => {
          this.comparisonLoading = false;
          const detail = err?.error?.detail || err?.message || "Unknown error";
          this.snackBar.open(`Comparison failed: ${detail}`, "Close", { duration: 5000 });
        },
      });
  }

  getComparisonRowClass(status: string): string {
    return "comparison-row-" + status;
  }

  getSupplementRooms(): ComparisonRoom[] {
    if (!this.comparisonResult) return [];
    return this.comparisonResult.rooms
      .map((room) => ({
        ...room,
        items: room.items.filter(
          (i) => i.status === "aci_only" || i.status === "price_diff"
        ),
      }))
      .filter((room) => room.items.length > 0);
  }

  getSupplementRoomsByStatus(status: string): { room_name: string; items: any[] }[] {
    if (!this.comparisonResult) return [];
    return this.comparisonResult.rooms
      .map((room) => ({
        room_name: room.room_name,
        items: room.items.filter((i) => i.status === status),
      }))
      .filter((room) => room.items.length > 0);
  }

  getSupplementRoomTotal(room: any): number {
    return room.items.reduce(
      (sum: number, i: any) => sum + (i.difference || i.aci_total || 0),
      0
    );
  }

  getMissingItemsTotal(): number {
    if (!this.comparisonResult) return 0;
    return this.comparisonResult.rooms.reduce((sum: number, room: any) =>
      sum + room.items
        .filter((i: any) => i.status === 'aci_only')
        .reduce((s: number, i: any) => s + (i.aci_total || 0), 0), 0);
  }

  getUnderpaidItemsTotal(): number {
    if (!this.comparisonResult) return 0;
    return this.comparisonResult.rooms.reduce((sum: number, room: any) =>
      sum + room.items
        .filter((i: any) => i.status === 'price_diff' && (i.difference || 0) > 0)
        .reduce((s: number, i: any) => s + (i.difference || 0), 0), 0);
  }

  // --- Blackout View Filtering ---

  getBlackoutRoomNames(): string[] {
    if (!this.comparisonResult) return [];
    return this.comparisonResult.rooms.map(r => r.room_name);
  }

  getFilteredBlackoutRooms(): ComparisonRoom[] {
    if (!this.comparisonResult) return [];
    let rooms = this.comparisonResult.rooms;

    // Room filter
    if (this.blackoutRoomFilter) {
      rooms = rooms.filter(r => r.room_name === this.blackoutRoomFilter);
    }

    // Status filter — filter items within rooms
    if (this.blackoutStatusFilter) {
      rooms = rooms
        .map(r => ({
          ...r,
          items: r.items.filter((i: any) => i.status === this.blackoutStatusFilter),
        }))
        .filter(r => r.items.length > 0);
    }

    // Sort by largest difference
    if (this.blackoutSortBy === 'largest_diff') {
      rooms = rooms.map(r => ({
        ...r,
        items: [...r.items].sort((a: any, b: any) => Math.abs(b.difference || 0) - Math.abs(a.difference || 0)),
      }));
    }

    return rooms;
  }

  getFilteredItemCount(): number {
    return this.getFilteredBlackoutRooms().reduce((sum, r) => sum + r.items.length, 0);
  }

  clearBlackoutFilters(): void {
    this.blackoutRoomFilter = '';
    this.blackoutStatusFilter = '';
    this.blackoutSortBy = 'default';
  }

  hasActiveBlackoutFilters(): boolean {
    return !!this.blackoutRoomFilter || !!this.blackoutStatusFilter || this.blackoutSortBy !== 'default';
  }

  exportBlackoutPDF(): void {
    if (!this.comparisonResult) return;
    this.supplementGenerating = true;
    const blob = this.generateSupplementPDFBlob();
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "blackout-estimate-report.pdf";
      a.click();
      URL.revokeObjectURL(url);
    }
    this.supplementGenerating = false;
  }

  blackoutIntoEmail(): void {
    if (!this.comparisonResult) return;
    const body = this.buildDefaultEmailBody();
    this.copySupplementEmail(body);
    this.snackBar.open('Blackout estimate email copied to clipboard', 'Close', { duration: 3000 });
  }

  blackoutIntoReport(): void {
    if (!this.comparisonResult) return;
    this.exportSupplementPDF();
  }

  private fmtCurrency(value: number): string {
    return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  getCarrierStatusClass(ce: CarrierEstimate): string {
    if (!ce.status) return 'status-parsed';
    const s = ce.status.toLowerCase();
    if (s === 'error') return 'status-error';
    if (s === 'compared') return 'status-compared';
    if (this.comparisonResult && this.comparisonResult.carrier_estimate_id === ce.id) return 'status-compared';
    return 'status-parsed';
  }

  getCarrierStatusLabel(ce: CarrierEstimate): string {
    if (!ce.status) return 'Parsed';
    const s = ce.status.toLowerCase();
    if (s === 'error') return 'Error';
    if (s === 'compared') return 'Compared';
    if (this.comparisonResult && this.comparisonResult.carrier_estimate_id === ce.id) return 'Compared';
    return 'Ready';
  }

  loadMockComparisonData() {
    const mockCarrier: CarrierEstimate = {
      id: 'mock-carrier-001',
      carrier_name: 'State Farm Insurance',
      upload_type: 'paste',
      status: 'compared',
      parser_type: 'paste',
      parse_confidence: 'high',
      total_cost: 8750.00,
      created_at: new Date().toISOString(),
      line_items: [
        { description: 'Remove drywall', quantity: 320, unit: 'SF', unit_cost: 1.25, total_cost: 400.00, room_name: 'Kitchen', category: 'walls', sort_order: 1 },
        { description: 'Install drywall', quantity: 320, unit: 'SF', unit_cost: 2.50, total_cost: 800.00, room_name: 'Kitchen', category: 'walls', sort_order: 2 },
        { description: 'Paint walls', quantity: 320, unit: 'SF', unit_cost: 1.75, total_cost: 560.00, room_name: 'Kitchen', category: 'walls', sort_order: 3 },
        { description: 'Remove carpet', quantity: 30, unit: 'SY', unit_cost: 1.50, total_cost: 45.00, room_name: 'Living Room', category: 'floor', sort_order: 4 },
        { description: 'Install carpet', quantity: 30, unit: 'SY', unit_cost: 28.00, total_cost: 840.00, room_name: 'Living Room', category: 'floor', sort_order: 5 },
        { description: 'Remove baseboard', quantity: 60, unit: 'LF', unit_cost: 1.00, total_cost: 60.00, room_name: 'Living Room', category: 'trim', sort_order: 6 },
        { description: 'Install baseboard', quantity: 60, unit: 'LF', unit_cost: 4.50, total_cost: 270.00, room_name: 'Living Room', category: 'trim', sort_order: 7 },
        { description: 'Remove ceiling drywall', quantity: 150, unit: 'SF', unit_cost: 1.25, total_cost: 187.50, room_name: 'Bathroom', category: 'ceiling', sort_order: 8 },
        { description: 'Install ceiling drywall', quantity: 150, unit: 'SF', unit_cost: 2.50, total_cost: 375.00, room_name: 'Bathroom', category: 'ceiling', sort_order: 9 },
        { description: 'Remove vanity', quantity: 1, unit: 'EA', unit_cost: 85.00, total_cost: 85.00, room_name: 'Bathroom', category: 'fixtures', sort_order: 10 },
        { description: 'Install vanity', quantity: 1, unit: 'EA', unit_cost: 450.00, total_cost: 450.00, room_name: 'Bathroom', category: 'fixtures', sort_order: 11 },
        { description: 'Debris removal', quantity: 8, unit: 'HR', unit_cost: 45.00, total_cost: 360.00, room_name: 'Kitchen', category: 'misc_items', sort_order: 12 },
      ],
    };

    this.carrierEstimates = [mockCarrier];
    this.selectedCarrierEstimate = mockCarrier;

    const mockResult: ComparisonResult = {
      project_id: this.estimateId || undefined,
      carrier_estimate_id: 'mock-carrier-001',
      price_threshold: 5.0,
      aci_total: 14250.00,
      carrier_total: 8750.00,
      supplement_total: 5500.00,
      match_count: 4,
      price_diff_count: 3,
      aci_only_count: 5,
      carrier_only_count: 2,
      rooms: [
        {
          room_name: 'Kitchen',
          aci_subtotal: 4860.00,
          carrier_subtotal: 1760.00,
          difference: 3100.00,
          items: [
            { description: 'Remove drywall', aci_quantity: 320, aci_total: 400.00, carrier_quantity: 320, carrier_total: 400.00, difference: 0, status: 'match', category: 'walls' },
            { description: 'Install drywall', aci_quantity: 320, aci_total: 960.00, carrier_quantity: 320, carrier_total: 800.00, difference: 160.00, status: 'price_diff', category: 'walls' },
            { description: 'Tape and finish drywall', aci_quantity: 320, aci_total: 640.00, status: 'aci_only', category: 'walls' },
            { description: 'Prime walls', aci_quantity: 320, aci_total: 480.00, status: 'aci_only', category: 'walls' },
            { description: 'Paint walls', aci_quantity: 320, aci_total: 640.00, carrier_quantity: 320, carrier_total: 560.00, difference: 80.00, status: 'price_diff', category: 'walls' },
            { description: 'Seal smoke damage', aci_quantity: 320, aci_total: 384.00, status: 'aci_only', category: 'walls' },
            { description: 'Debris removal', aci_quantity: 8, aci_total: 360.00, carrier_quantity: 8, carrier_total: 360.00, difference: 0, status: 'match', category: 'misc_items' },
          ],
        },
        {
          room_name: 'Living Room',
          aci_subtotal: 3420.00,
          carrier_subtotal: 1215.00,
          difference: 2205.00,
          items: [
            { description: 'Remove carpet', aci_quantity: 30, aci_total: 45.00, carrier_quantity: 30, carrier_total: 45.00, difference: 0, status: 'match', category: 'floor' },
            { description: 'Install carpet', aci_quantity: 30, aci_total: 1050.00, carrier_quantity: 30, carrier_total: 840.00, difference: 210.00, status: 'price_diff', category: 'floor' },
            { description: 'Remove baseboard', aci_quantity: 60, aci_total: 60.00, carrier_quantity: 60, carrier_total: 60.00, difference: 0, status: 'match', category: 'trim' },
            { description: 'Install baseboard', aci_quantity: 60, aci_total: 330.00, carrier_quantity: 60, carrier_total: 270.00, difference: 60.00, status: 'price_diff' as const, category: 'trim' },
            { description: 'Paint walls', aci_quantity: 400, aci_total: 720.00, status: 'aci_only', category: 'walls' },
            { description: 'Paint ceiling', aci_quantity: 200, aci_total: 300.00, status: 'aci_only', category: 'ceiling' },
            { description: 'Window screen replacement', carrier_quantity: 4, carrier_total: 180.00, status: 'carrier_only', category: 'windows' },
            { description: 'Exterior caulking', carrier_quantity: 1, carrier_total: 95.00, status: 'carrier_only', category: 'misc_items' },
          ],
        },
        {
          room_name: 'Bathroom',
          aci_subtotal: 2970.00,
          carrier_subtotal: 1097.50,
          difference: 1872.50,
          items: [
            { description: 'Remove ceiling drywall', aci_quantity: 150, aci_total: 187.50, carrier_quantity: 150, carrier_total: 187.50, difference: 0, status: 'match' as const, category: 'ceiling' },
            { description: 'Install ceiling drywall', aci_quantity: 150, aci_total: 450.00, carrier_quantity: 150, carrier_total: 375.00, difference: 75.00, status: 'price_diff' as const, category: 'ceiling' },
            { description: 'Remove vanity', aci_quantity: 1, aci_total: 85.00, carrier_quantity: 1, carrier_total: 85.00, difference: 0, status: 'match' as const, category: 'fixtures' },
            { description: 'Install vanity', aci_quantity: 1, aci_total: 550.00, carrier_quantity: 1, carrier_total: 450.00, difference: 100.00, status: 'price_diff' as const, category: 'fixtures' },
            { description: 'Tile floor removal', aci_quantity: 75, aci_total: 225.00, status: 'aci_only', category: 'floor' },
            { description: 'Install tile floor', aci_quantity: 75, aci_total: 975.00, status: 'aci_only', category: 'floor' },
            { description: 'Paint ceiling', aci_quantity: 150, aci_total: 225.00, status: 'aci_only', category: 'ceiling' },
          ],
        },
      ],
    };

    this.comparisonResult = mockResult;
    this.activeView = 'blackout';
    this.snackBar.open('Mock comparison data loaded (dev only)', 'Close', { duration: 3000 });
  }

  getCarrierItemsByRoom(): Map<string, any[]> {
    const map = new Map<string, any[]>();
    if (!this.selectedCarrierEstimate?.line_items) return map;

    for (const item of this.selectedCarrierEstimate.line_items) {
      const room = item.room_name || "Unassigned";
      if (!map.has(room)) map.set(room, []);
      map.get(room)!.push(item);
    }
    return map;
  }

  generateSupplementPDFBlob(): Blob | null {
    if (!this.comparisonResult) return null;

    const doc = new jsPDF("p", "pt", "letter");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const projectName = this.projectForm.get("name")?.value || "Unnamed Project";
    const carrierName = this.selectedCarrierEstimate?.carrier_name || "Carrier";
    const adjuster = this.adjusterFullName || "Adjuster";
    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
    const margin = 60;

    // ═══════════════════════════════════════════════════════════════
    // PAGE 1 — Cover Letter
    // ═══════════════════════════════════════════════════════════════
    let y = 50;

    // ACI branding
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 75, 150);
    doc.text("ACI Adjuster Intelligence\u2122", margin, y);
    doc.setTextColor(0, 0, 0);
    y += 30;

    // Date
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(dateStr, margin, y);
    y += 14;

    // RE line
    doc.setFont("helvetica", "bold");
    doc.text(`RE: Supplement Demand \u2014 ${projectName}`, margin, y);
    doc.setFont("helvetica", "normal");
    y += 30;

    // Salutation
    doc.text(`Dear ${adjuster},`, margin, y);
    y += 22;

    // Body paragraphs
    const bodyLines = [
      `Please find attached a supplement demand based on our scope and pricing analysis`,
      `of the carrier estimate for the above-referenced claim.`,
      ``,
      `Our review identified omitted scope items and underpaid line items necessary to`,
      `restore the property to its pre-loss condition.`,
    ];
    for (const line of bodyLines) {
      if (line === "") { y += 10; continue; }
      doc.text(line, margin, y);
      y += 14;
    }
    y += 10;

    // Summary block
    doc.setFont("helvetica", "bold");
    doc.text("Summary:", margin, y);
    doc.setFont("helvetica", "normal");
    y += 18;

    const summaryLines = [
      [`Carrier Estimate Total:`, this.fmtCurrency(this.comparisonResult.carrier_total)],
      [`ACI Estimate Total:`, this.fmtCurrency(this.comparisonResult.aci_total)],
      [`Missing Items (${this.comparisonResult.aci_only_count}):`, this.fmtCurrency(this.getMissingItemsTotal())],
      [`Underpaid Items (${this.comparisonResult.price_diff_count}):`, this.fmtCurrency(this.getUnderpaidItemsTotal())],
      [`Additional Amount Owed:`, this.fmtCurrency(this.comparisonResult.supplement_total)],
    ];
    for (let i = 0; i < summaryLines.length; i++) {
      const [label, value] = summaryLines[i];
      const isTotal = i === 4;
      doc.setFont("helvetica", isTotal ? "bold" : "normal");
      if (isTotal) doc.setTextColor(220, 53, 69);
      doc.text(label, margin + 20, y);
      doc.text(value, margin + 220, y);
      if (isTotal) doc.setTextColor(0, 0, 0);
      y += 16;
    }
    y += 14;

    // Closing
    const closingLines = [
      `A detailed breakdown is included in the attached Supplement Demand Report.`,
      ``,
      `Please review and advise regarding approval of the additional scope and pricing.`,
    ];
    for (const line of closingLines) {
      if (line === "") { y += 10; continue; }
      doc.text(line, margin, y);
      y += 14;
    }
    y += 26;

    // Sign-off
    doc.text("Respectfully,", margin, y);
    y += 22;
    doc.setFont("helvetica", "bold");
    doc.text(adjuster, margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 75, 150);
    doc.text("ACI Adjuster Intelligence\u2122", margin, y);
    doc.setTextColor(0, 0, 0);

    // ═══════════════════════════════════════════════════════════════
    // PAGE 2+ — Detailed Breakdown
    // ═══════════════════════════════════════════════════════════════
    doc.addPage();
    y = 40;

    // --- ACI Header ---
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 75, 150);
    doc.text("ACI Adjuster Intelligence\u2122", 40, y);
    doc.setTextColor(0, 0, 0);
    y += 20;

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Supplement Demand Report", 40, y);
    y += 6;

    // Accent line
    doc.setDrawColor(0, 75, 150);
    doc.setLineWidth(2);
    doc.line(40, y, pageWidth - 40, y);
    doc.setDrawColor(0, 0, 0);
    y += 18;

    // --- Project Info ---
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const infoLeft = 40;
    const infoRight = pageWidth / 2 + 20;

    doc.setFont("helvetica", "bold");
    doc.text("Project:", infoLeft, y);
    doc.setFont("helvetica", "normal");
    doc.text(projectName, infoLeft + 52, y);

    doc.setFont("helvetica", "bold");
    doc.text("Date:", infoRight, y);
    doc.setFont("helvetica", "normal");
    doc.text(new Date().toLocaleDateString(), infoRight + 35, y);
    y += 14;

    doc.setFont("helvetica", "bold");
    doc.text("Carrier:", infoLeft, y);
    doc.setFont("helvetica", "normal");
    doc.text(carrierName, infoLeft + 52, y);

    doc.setFont("helvetica", "bold");
    doc.text("Threshold:", infoRight, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${this.comparisonResult.price_threshold}%`, infoRight + 62, y);
    y += 22;

    // --- Summary Table ---
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 40, y);
    y += 14;

    const summaryData = [
      ["Carrier Estimate Total", this.fmtCurrency(this.comparisonResult.carrier_total)],
      ["ACI Estimate Total", this.fmtCurrency(this.comparisonResult.aci_total)],
      [`Missing Items (${this.comparisonResult.aci_only_count})`, this.fmtCurrency(this.getMissingItemsTotal())],
      [`Underpaid Items (${this.comparisonResult.price_diff_count})`, this.fmtCurrency(this.getUnderpaidItemsTotal())],
      ["Additional Amount Owed", this.fmtCurrency(this.comparisonResult.supplement_total)],
    ];

    autoTable(doc, {
      startY: y,
      body: summaryData,
      margin: { left: 40, right: 40 },
      styles: { fontSize: 10 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 240 },
        1: { halign: "right", fontStyle: "bold" },
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      didParseCell: (data: any) => {
        if (data.row.index === 4) {
          data.cell.styles.textColor = [220, 53, 69];
          data.cell.styles.fontSize = 11;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Stats row
    const statsData = [
      [
        `Matching: ${this.comparisonResult.match_count}`,
        `Underpaid: ${this.comparisonResult.price_diff_count}`,
        `Omitted: ${this.comparisonResult.aci_only_count}`,
        `Carrier Only: ${this.comparisonResult.carrier_only_count}`,
      ],
    ];
    autoTable(doc, {
      startY: y,
      body: statsData,
      margin: { left: 40, right: 40 },
      styles: { fontSize: 8, halign: "center", fillColor: [240, 240, 240] },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Explanation line
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(140, 140, 140);
    doc.text(
      "Additional Amount Owed reflects omitted scope plus underpaid pricing differences identified in the carrier estimate review.",
      40, y
    );
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    y += 18;

    // --- Executive Summary Box ---
    const pctDiff = this.getPercentDifference();
    const missingCount = this.comparisonResult.aci_only_count;
    const underpaidCount = this.comparisonResult.price_diff_count;
    const boxH = 48;
    if (y + boxH > pageHeight - 60) { doc.addPage(); y = 50; }
    doc.setFillColor(0, 75, 150);
    doc.roundedRect(40, y, pageWidth - 80, boxH, 4, 4, 'F');
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(
      `The carrier estimate is underpaid by ${Math.abs(pctDiff).toFixed(1)}% (${this.fmtCurrency(this.comparisonResult.supplement_total)}).`,
      pageWidth / 2, y + 18, { align: "center" }
    );
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${missingCount} item${missingCount !== 1 ? 's are' : ' is'} missing and ${underpaidCount} item${underpaidCount !== 1 ? 's are' : ' is'} underpaid.`,
      pageWidth / 2, y + 34, { align: "center" }
    );
    doc.setTextColor(0, 0, 0);
    y += boxH + 16;

    // --- Visual Comparison Bar ---
    if (this.comparisonResult.aci_total > 0) {
      const barW = pageWidth - 80;
      const barH = 14;
      if (y + barH + 20 > pageHeight - 60) { doc.addPage(); y = 50; }
      const ratio = Math.min(this.comparisonResult.carrier_total / this.comparisonResult.aci_total, 1.0);
      const carrierBarW = barW * ratio;
      // Full bar (ACI total)
      doc.setFillColor(76, 175, 80);
      doc.roundedRect(40, y, barW, barH, 2, 2, 'F');
      // Carrier portion overlay
      doc.setFillColor(244, 67, 54);
      doc.roundedRect(40, y, carrierBarW, barH, 2, 2, 'F');
      // Labels
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      if (carrierBarW > 80) {
        doc.text(`Carrier: ${this.fmtCurrency(this.comparisonResult.carrier_total)}`, 44, y + 10);
      }
      doc.setTextColor(255, 255, 255);
      if (barW - carrierBarW > 80) {
        doc.text(`Gap: ${this.fmtCurrency(this.comparisonResult.supplement_total)}`, carrierBarW + 44, y + 10);
      }
      doc.setTextColor(0, 0, 0);
      y += barH + 6;
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("Red = Carrier Paid | Green = Additional Owed (ACI Total)", 40, y);
      y += 16;
    }

    // --- Claim Info (from linked fire claim if available) ---
    if (this.linkedClaim) {
      if (y + 40 > pageHeight - 60) { doc.addPage(); y = 50; }
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Claim Information", 40, y);
      y += 12;
      doc.setFont("helvetica", "normal");
      const claimInfoLines: string[] = [];
      if (this.linkedClaim.address_line1) claimInfoLines.push(`Address: ${this.linkedClaim.address_line1}`);
      if ((this.linkedClaim as any).carrier_name) claimInfoLines.push(`Carrier: ${(this.linkedClaim as any).carrier_name}`);
      if ((this.linkedClaim as any).policy_number) claimInfoLines.push(`Policy #: ${(this.linkedClaim as any).policy_number}`);
      if ((this.linkedClaim as any).claim_number) claimInfoLines.push(`Claim #: ${(this.linkedClaim as any).claim_number}`);
      for (const cl of claimInfoLines) {
        doc.text(cl, 50, y);
        y += 12;
      }
      y += 6;
    }

    // --- Category Breakdown Table ---
    if (this.comparisonResult.category_breakdown && this.comparisonResult.category_breakdown.length > 0) {
      if (y + 40 > pageHeight - 60) { doc.addPage(); y = 50; }
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Category Breakdown", 40, y);
      y += 14;

      const catData = this.comparisonResult.category_breakdown.map(cb => [
        cb.category,
        `${cb.item_count}`,
        this.fmtCurrency(cb.carrier_total),
        this.fmtCurrency(cb.aci_total),
        this.fmtCurrency(cb.difference),
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Category", "Items", "Carrier Total", "ACI Total", "Difference"]],
        body: catData,
        margin: { left: 40, right: 40 },
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 75, 150], textColor: [255, 255, 255] },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 4) {
            const val = parseFloat(data.cell.raw?.toString().replace(/[$,]/g, '') || '0');
            if (val > 0) data.cell.styles.textColor = [220, 53, 69];
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 14;
    }

    // --- Top 10 Underpaid Items ---
    if (this.comparisonResult.top_underpaid_items && this.comparisonResult.top_underpaid_items.length > 0) {
      if (y + 40 > pageHeight - 60) { doc.addPage(); y = 50; }
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Top Underpaid / Missing Items", 40, y);
      y += 14;

      const topData = this.comparisonResult.top_underpaid_items.map((ti, idx) => [
        `${idx + 1}`,
        ti.description,
        ti.room_name || '-',
        ti.status === 'aci_only' ? 'Missing' : 'Underpaid',
        this.fmtCurrency(ti.carrier_total),
        this.fmtCurrency(ti.aci_total),
        this.fmtCurrency(ti.difference),
      ]);

      autoTable(doc, {
        startY: y,
        head: [["#", "Description", "Room", "Status", "Carrier", "ACI", "Difference"]],
        body: topData,
        margin: { left: 40, right: 40 },
        styles: { fontSize: 7 },
        headStyles: { fillColor: [220, 53, 69], textColor: [255, 255, 255] },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center' },
          3: { cellWidth: 45 },
        },
      });
      y = (doc as any).lastAutoTable.finalY + 14;
    }

    // --- Per-Room Recovery Summary ---
    if (this.comparisonResult.rooms.length > 0) {
      if (y + 40 > pageHeight - 60) { doc.addPage(); y = 50; }
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Per-Room Recovery Summary", 40, y);
      y += 14;

      const roomData = this.comparisonResult.rooms.map(r => [
        r.room_name,
        this.fmtCurrency(r.carrier_subtotal),
        this.fmtCurrency(r.aci_subtotal),
        this.fmtCurrency(r.difference),
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Room", "Carrier Subtotal", "ACI Subtotal", "Recovery Potential"]],
        body: roomData,
        margin: { left: 40, right: 40 },
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 75, 150], textColor: [255, 255, 255] },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 3) {
            const val = parseFloat(data.cell.raw?.toString().replace(/[$,]/g, '') || '0');
            if (val > 0) data.cell.styles.textColor = [220, 53, 69];
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 14;
    }

    // --- Omitted Items ---
    const omittedRooms = this.comparisonResult.rooms
      .map((r) => ({
        ...r,
        items: r.items.filter((i) => i.status === "aci_only"),
      }))
      .filter((r) => r.items.length > 0);

    if (omittedRooms.length > 0) {
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Omitted Items (Not in Carrier Estimate)", 40, y);
      y += 12;

      for (const room of omittedRooms) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(room.room_name, 40, y);
        y += 4;

        const tableData = room.items.map((item) => [
          item.description || "",
          `${item.aci_quantity || 0}`,
          this.fmtCurrency(item.aci_total || 0),
        ]);

        autoTable(doc, {
          startY: y,
          head: [["Description", "Qty", "ACI Amount"]],
          body: tableData,
          margin: { left: 40, right: 40 },
          styles: { fontSize: 8 },
          headStyles: { fillColor: [220, 53, 69], textColor: [255, 255, 255] },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }
      y += 6;
    }

    // --- Underpaid Items ---
    const underpaidRooms = this.comparisonResult.rooms
      .map((r) => ({
        ...r,
        items: r.items.filter((i) => i.status === "price_diff"),
      }))
      .filter((r) => r.items.length > 0);

    if (underpaidRooms.length > 0) {
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Underpaid Items", 40, y);
      y += 12;

      for (const room of underpaidRooms) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(room.room_name, 40, y);
        y += 4;

        const tableData = room.items.map((item) => [
          item.description || "",
          this.fmtCurrency(item.carrier_total || 0),
          this.fmtCurrency(item.aci_total || 0),
          this.fmtCurrency(item.difference || 0),
        ]);

        autoTable(doc, {
          startY: y,
          head: [["Description", "Carrier Paid", "ACI Amount", "Difference"]],
          body: tableData,
          margin: { left: 40, right: 40 },
          styles: { fontSize: 8 },
          headStyles: { fillColor: [240, 173, 78], textColor: [51, 51, 51] },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }
      y += 6;
    }

    // --- Policy and Estimate Support (supplement argument, if pending) ---
    if (this.pendingSupplementArgument) {
      y += 10;
      if (y > pageHeight - 120) { doc.addPage(); y = 50; }
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 75, 150);
      doc.text("Policy and Estimate Support", 40, y);
      doc.setTextColor(0, 0, 0);
      y += 4;
      doc.setDrawColor(0, 75, 150);
      doc.setLineWidth(0.5);
      doc.line(40, y, pageWidth - 40, y);
      y += 14;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const suppArgLines = doc.splitTextToSize(this.pendingSupplementArgument, pageWidth - 80);
      for (const line of suppArgLines) {
        if (y > pageHeight - 50) { doc.addPage(); y = 50; }
        doc.text(line, 40, y);
        y += 12;
      }
      y += 6;
    }

    // --- Policy Support Argument (if pending) ---
    if (this.pendingPolicyArgument) {
      y += 10;
      if (y > pageHeight - 120) { doc.addPage(); y = 50; }
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 75, 150);
      doc.text("Policy Support Argument", 40, y);
      doc.setTextColor(0, 0, 0);
      y += 4;
      doc.setDrawColor(0, 75, 150);
      doc.setLineWidth(0.5);
      doc.line(40, y, pageWidth - 40, y);
      y += 14;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const argLines = doc.splitTextToSize(this.pendingPolicyArgument, pageWidth - 80);
      for (const line of argLines) {
        if (y > pageHeight - 50) { doc.addPage(); y = 50; }
        doc.text(line, 40, y);
        y += 12;
      }
      y += 6;
    }

    // --- Grand Total ---
    y += 4;
    if (y > pageHeight - 60) { doc.addPage(); y = 50; }
    doc.setDrawColor(0, 75, 150);
    doc.setLineWidth(1);
    doc.line(40, y, pageWidth - 40, y);
    y += 16;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Additional Amount Owed:", 40, y);
    doc.setTextColor(220, 53, 69);
    doc.text(
      this.fmtCurrency(this.comparisonResult.supplement_total),
      pageWidth - 40,
      y,
      { align: "right" }
    );
    doc.setTextColor(0, 0, 0);

    // --- Footer on every page ---
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(140, 140, 140);
      doc.text(
        "Prepared using the ACI Adjuster Intelligence\u2122 Claims Analysis Engine.",
        pageWidth / 2,
        pageHeight - 24,
        { align: "center" }
      );
      doc.text(
        `Page ${p} of ${totalPages}`,
        pageWidth - 40,
        pageHeight - 24,
        { align: "right" }
      );
      doc.setTextColor(0, 0, 0);
    }

    return doc.output("blob");
  }

  exportSupplementPDF() {
    if (!this.comparisonResult) return;
    this.supplementGenerating = true;
    const blob = this.generateSupplementPDFBlob();
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "supplement-demand-report.pdf";
      a.click();
      URL.revokeObjectURL(url);
      this.supplementReportGenerated = true;
    }
    this.supplementGenerating = false;
  }

  // ═══════════════════════════════════════════════════════════════
  // Supplement Email
  // ═══════════════════════════════════════════════════════════════

  openSupplementEmailPreview() {
    const propertyParts = [
      this.linkedClaim?.address_line1,
      this.linkedClaim?.city,
      this.linkedClaim?.state,
      this.linkedClaim?.zip,
    ].filter(Boolean);

    // Auto-detect carrier adjuster email from available sources
    const { email: detectedEmail, source: emailSource } = this.detectCarrierEmail();

    const dialogData: SupplementEmailDialogData = {
      senderName: this.adjusterFullName || 'Adjuster',
      senderEmail: this.adjusterEmail,
      senderPhone: this.adjusterPhone,
      carrierName: this.linkedClaim?.carrier_name || this.selectedCarrierEstimate?.carrier_name || '',
      claimNumber: this.linkedClaim?.claim_number || '',
      insuredName: this.linkedClaim?.insured_name || '',
      propertyAddress: propertyParts.join(', '),
      policyNumber: this.linkedClaim?.policy_number || '',
      projectName: this.projectForm.get('name')?.value || 'Unnamed Project',
      carrierTotal: this.comparisonResult?.carrier_total || 0,
      aciTotal: this.comparisonResult?.aci_total || 0,
      supplementTotal: this.comparisonResult?.supplement_total || 0,
      detectedEmail,
      emailSource,
    };

    const dialogRef = this.matDialog.open(SupplementEmailDialogComponent, {
      width: '660px',
      data: dialogData,
      disableClose: false,
    });

    dialogRef.afterClosed().subscribe((result: SupplementEmailDialogResult | null) => {
      if (!result) return;

      // Save the email back to the claim record for future supplements
      if (result.to && this.linkedClaim?.id && result.to !== this.linkedClaim.carrier_adjuster_email) {
        this.saveCarrierAdjusterEmail(result.to);
      }

      if (result.action === 'copy') {
        this.copySupplementEmail(result.body);
      } else if (result.action === 'send') {
        this.sendSupplementEmail(result);
      }
    });
  }

  private detectCarrierEmail(): { email: string; source: string } {
    // 1. Claim record → carrier_adjuster_email
    if (this.linkedClaim?.carrier_adjuster_email) {
      return { email: this.linkedClaim.carrier_adjuster_email, source: 'claim record' };
    }

    // 2. Carrier estimate notes (may contain email from parsed PDF)
    if (this.selectedCarrierEstimate?.notes) {
      const emailMatch = this.selectedCarrierEstimate.notes.match(
        /[\w.+-]+@[\w-]+\.[\w.-]+/
      );
      if (emailMatch) {
        return { email: emailMatch[0], source: 'carrier estimate' };
      }
    }

    // No email found
    return { email: '', source: '' };
  }

  private saveCarrierAdjusterEmail(email: string) {
    if (!this.linkedClaim?.id) return;
    this.fireClaimService.update(this.linkedClaim.id, { carrier_adjuster_email: email }).subscribe({
      next: () => {
        // Update local state so re-opening the dialog auto-fills
        if (this.linkedClaim) {
          this.linkedClaim.carrier_adjuster_email = email;
        }
        console.log('[activity] carrier_adjuster_email_saved', { claimId: this.linkedClaim?.id, email });
      },
      error: (err: any) => {
        console.error('Failed to save carrier adjuster email', err);
      },
    });
  }

  copySupplementEmail(body?: string) {
    const text = body || this.buildDefaultEmailBody();
    navigator.clipboard.writeText(text).then(() => {
      this.snackBar.open('Supplement email copied to clipboard.', 'Close', { duration: 3000 });
      console.log('[activity] supplement_email_copied', { projectId: this.estimateId });
    });
  }

  sendSupplementEmail(result: SupplementEmailDialogResult) {
    if (!result.to) {
      this.snackBar.open('Please enter a recipient email address.', 'Close', { duration: 3000 });
      return;
    }

    const pdfBlob = this.generateSupplementPDFBlob();
    if (!pdfBlob) {
      this.snackBar.open('Failed to generate supplement PDF.', 'Close', { duration: 3000 });
      return;
    }

    const formData = new FormData();
    formData.append('to', result.to);
    formData.append('subject', result.subject);
    formData.append('body', result.body);
    formData.append('file', pdfBlob, 'supplement-demand-report.pdf');

    this.snackBar.open('Sending supplement email...', '', { duration: 0 });

    this.estimatingService.sendSupplementEmail(this.estimateId!, formData).subscribe({
      next: () => {
        this.snackBar.open('Supplement email sent successfully!', 'Close', { duration: 4000 });
        console.log('[activity] supplement_email_sent', { projectId: this.estimateId, to: result.to });
      },
      error: (err: any) => {
        console.error('Failed to send supplement email', err);
        this.snackBar.open('Failed to send supplement email. Please try again.', 'Close', { duration: 4000 });
      },
    });
  }

  buildDefaultEmailBody(): string {
    const carrierName = this.linkedClaim?.carrier_name || this.selectedCarrierEstimate?.carrier_name || '';
    const adjusterName = carrierName ? `${carrierName} Claims Team` : 'Claims Team';
    const senderName = this.adjusterFullName || 'Adjuster';
    const companyName = 'ACI Adjuster Intelligence\u2122';
    const phone = this.adjusterPhone || '';
    const email = this.adjusterEmail || '';

    return `Dear ${adjusterName},

Please find attached a supplement request based on our scope and pricing analysis.

After reviewing the carrier estimate and comparing it to our detailed scope, we identified several items that were either underpaid or omitted.

The attached supplement report outlines the differences and the additional amounts required to properly indemnify the insured under the policy.

Please review and advise regarding next steps.

Thank you,

${senderName}
${companyName}${phone ? '\n' + phone : ''}${email ? '\n' + email : ''}`;
  }

  // --- Policy Intelligence ---

  loadPolicy(): void {
    if (!this.linkedClaim) {
      console.log('[PolicyIntel] loadPolicy skipped — no linkedClaim');
      this.policyLoading = false;
      return;
    }
    this.policyLoading = true;
    this.policyError = null;
    const fcId = this.linkedClaim.id;
    console.log('[PolicyIntel] loadPolicy — fetching by fire_claim_id:', fcId);
    this.policyDocService.getByEntity({ fire_claim_id: fcId }).pipe(
      switchMap((docs) => {
        console.log('[PolicyIntel] loadPolicy — getByEntity returned', docs.length, 'docs');
        if (docs.length > 0) {
          // Fetch full detail (with clauses, intelligence, ai_summary)
          return this.policyDocService.get(docs[0].id);
        }
        return of(null);
      }),
    ).subscribe({
      next: (doc) => {
        this.policyDoc = doc;
        this.policyLoading = false;
        if (!this.policyDoc && this.estimateClaimId) {
          this.loadClaimFilePDFs();
        }
      },
      error: (err) => {
        console.error('[PolicyIntel] loadPolicy — getByEntity failed:', err);
        this.policyLoading = false;
        this.policyDoc = null;
      },
    });
  }

  loadClaimFilePDFs(): void {
    if (!this.estimateClaimId) return;
    this.claimFilesLoading = true;
    this.claimService.getClaimFiles(this.estimateClaimId, 1, 100).subscribe({
      next: (res: any) => {
        const items = res?.items || res?.data || res || [];
        this.claimFilePDFs = items.filter(
          (f: any) => f.type === 'application/pdf'
        );
        this.claimFilesLoading = false;
      },
      error: () => {
        this.claimFilePDFs = [];
        this.claimFilesLoading = false;
      },
    });
  }

  importClaimFileAsPolicy(claimFile: any): void {
    if (!this.linkedClaim) return;
    this.importingClaimFile = true;
    this.policyError = null;
    this.policyDocService
      .importFromClaimFile(claimFile.id, this.linkedClaim.id)
      .pipe(
        switchMap((doc) => this.policyDocService.get(doc.id))
      )
      .subscribe({
        next: (doc) => {
          this.policyDoc = doc;
          this.importingClaimFile = false;
          this.claimFilePDFs = [];
          this.snackBar.open('Policy imported from claim file', 'Close', { duration: 4000 });
        },
        error: (err) => {
          this.importingClaimFile = false;
          this.policyError = 'Failed to import claim file as policy.';
          this.snackBar.open(this.policyError, 'Close', { duration: 5000 });
        },
      });
  }

  get canUploadPolicy(): boolean {
    return !!this.linkedClaim;
  }

  onPolicyFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    if (!this.linkedClaim) {
      this.policyError = 'No fire claim linked. Open this estimate from a fire claim first.';
      this.snackBar.open(this.policyError, 'Close', { duration: 5000 });
      return;
    }

    const fireClaimId = this.linkedClaim.id;
    this.policyUploading = true;
    this.policyError = null;

    console.log('[PolicyIntel] Starting upload, fire_claim_id:', fireClaimId, 'file:', file.name);

    // Upload with fire_claim_id — backend sets the FK directly, no separate attach needed
    this.policyDocService.upload(file, { fire_claim_id: fireClaimId }).pipe(
      // Re-fetch to get full doc with clauses/intelligence populated
      switchMap((uploaded) => {
        console.log('[PolicyIntel] Upload returned doc id:', uploaded.id, 'fire_claim_id:', uploaded.fire_claim_id);
        return this.policyDocService.get(uploaded.id);
      })
    ).subscribe({
      next: (doc) => {
        console.log('[PolicyIntel] Final doc loaded:', doc.id, doc.file_name, 'fire_claim_id:', doc.fire_claim_id);
        this.policyDoc = doc;
        this.policyUploading = false;
        this.snackBar.open('Policy uploaded and linked to claim', 'Close', { duration: 3000 });
      },
      error: (err) => {
        console.error('[PolicyIntel] Upload failed:', err);
        this.policyUploading = false;
        this.policyError = 'Upload failed — ' + (err?.error?.detail || err?.message || 'Please try again.');
        this.snackBar.open(this.policyError, 'Close', { duration: 5000 });
      },
    });
  }

  onPolicyReplaceSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.policyDoc) return;
    input.value = '';

    this.policyUploading = true;
    this.policyError = null;

    this.policyDocService.uploadNewVersion(this.policyDoc.id, file).pipe(
      // Re-fetch to confirm persistence
      switchMap((doc) => this.policyDocService.get(doc.id))
    ).subscribe({
      next: (doc) => {
        this.policyDoc = doc;
        this.policyUploading = false;
        this.expandedProvisions.clear();
        this.policyNotesExpanded = false;
        this.generatedArgument = '';
        this.snackBar.open('Policy replaced', 'Close', { duration: 3000 });
      },
      error: (err) => {
        console.error('Policy replace failed:', err);
        this.policyUploading = false;
        this.policyError = 'Replace failed. Please try again.';
        this.snackBar.open('Policy replace failed', 'Close', { duration: 5000 });
      },
    });
  }

  analyzePolicy(): void {
    if (!this.policyDoc) return;
    const docId = this.policyDoc.id;
    this.policyAnalyzing = true;
    this.policyError = null;

    this.policyDocService.extractMetadata(docId).pipe(
      switchMap(() => this.policyDocService.extractClauses(docId)),
      switchMap(() => this.policyDocService.summarize(docId)),
      switchMap(() => this.policyDocService.get(docId))
    ).subscribe({
      next: (doc) => {
        this.policyDoc = doc;
        this.policyAnalyzing = false;
        this.snackBar.open('Policy analysis complete', 'Close', { duration: 3000 });
      },
      error: (err) => {
        console.error('Policy analysis failed:', err);
        this.policyAnalyzing = false;
        this.policyError = 'Policy analysis failed. Please try again.';
        this.snackBar.open('Policy analysis failed', 'Close', { duration: 5000 });
      },
    });
  }

  get policyIntel(): PolicyIntelligence | null {
    return this.policyDoc?.intelligence ?? null;
  }

  get policyClauses(): PolicyClause[] {
    return this.policyDoc?.clauses ?? [];
  }

  get policyAnalysisStatus(): 'not_analyzed' | 'analyzing' | 'complete' | 'failed' {
    if (this.policyAnalyzing) return 'analyzing';
    if (!this.policyDoc) return 'not_analyzed';
    const status = this.policyDoc.extraction_status;
    if ((status === 'complete' || status === 'completed' || status === 'clauses_extracted') && (this.policyClauses.length > 0 || this.policyIntel)) return 'complete';
    if (status === 'failed') return 'failed';
    return 'not_analyzed';
  }

  togglePolicyNotes(): void {
    this.policyNotesExpanded = !this.policyNotesExpanded;
  }

  toggleProvision(key: string): void {
    if (this.expandedProvisions.has(key)) {
      this.expandedProvisions.delete(key);
    } else {
      this.expandedProvisions.add(key);
    }
  }

  isProvisionExpanded(key: string): boolean {
    return this.expandedProvisions.has(key);
  }

  formatPolicyCurrency(val?: number): string {
    if (val === undefined || val === null) return 'Not detected';
    return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  formatPolicyPercent(val?: number): string {
    if (val === undefined || val === null) return 'Not detected';
    return val + '%';
  }

  // --- Policy Argument Engine ---

  generatePolicyArgument(): void {
    if (!this.estimateId) return;
    this.argumentGenerating = true;
    this.generatedArgument = '';

    this.estimatingService
      .generatePolicyArgument(
        this.estimateId,
        this.argumentType,
        this.selectedCarrierEstimate?.id
      )
      .subscribe({
        next: (res) => {
          this.generatedArgument = res.argument_text;
          this.argumentGenerating = false;
        },
        error: (err) => {
          this.argumentGenerating = false;
          const detail = err?.error?.detail || 'Policy argument generation failed';
          this.snackBar.open(detail, 'Close', { duration: 5000 });
        },
      });
  }

  copyArgument(): void {
    if (!this.generatedArgument) return;
    navigator.clipboard.writeText(this.generatedArgument).then(() => {
      this.snackBar.open('Argument copied to clipboard', 'Close', { duration: 3000 });
    });
  }

  insertArgumentIntoEmail(): void {
    if (!this.generatedArgument) return;
    const existingBody = this.buildDefaultEmailBody();
    const combined = existingBody + '\n\n---\n\n' + this.generatedArgument;
    this.copySupplementEmail(combined);
    this.snackBar.open('Argument inserted into supplement email and copied', 'Close', { duration: 3000 });
  }

  insertArgumentIntoReport(): void {
    if (!this.generatedArgument || !this.comparisonResult) return;
    // Store the argument so exportSupplementPDF can include it
    this.pendingPolicyArgument = this.generatedArgument;
    this.exportSupplementPDF();
    this.pendingPolicyArgument = '';
  }

  pendingPolicyArgument = '';

  // --- Supplement Argument Engine ---

  generateSupplementArgument(): void {
    if (!this.estimateId || !this.comparisonResult) return;
    this.supplementArgumentGenerating = true;
    this.generatedSupplementArgument = '';

    this.estimatingService
      .generateSupplementArgument(
        this.estimateId,
        this.selectedCarrierEstimate?.id
      )
      .subscribe({
        next: (res) => {
          this.generatedSupplementArgument = res.argument_text;
          this.supplementArgumentHasPolicySupport = res.has_policy_support;
          this.supplementArgumentGenerating = false;
        },
        error: (err) => {
          this.supplementArgumentGenerating = false;
          const detail = err?.error?.detail || 'Supplement argument generation failed';
          this.snackBar.open(detail, 'Close', { duration: 5000 });
        },
      });
  }

  copySupplementArgument(): void {
    if (!this.generatedSupplementArgument) return;
    navigator.clipboard.writeText(this.generatedSupplementArgument).then(() => {
      this.snackBar.open('Supplement argument copied to clipboard', 'Close', { duration: 3000 });
    });
  }

  insertSupplementArgumentIntoEmail(): void {
    if (!this.generatedSupplementArgument) return;
    const existingBody = this.buildDefaultEmailBody();
    const combined = existingBody + '\n\n---\n\n' + this.generatedSupplementArgument;
    this.copySupplementEmail(combined);
    this.snackBar.open('Supplement argument inserted into email and copied', 'Close', { duration: 3000 });
  }

  insertSupplementArgumentIntoReport(): void {
    if (!this.generatedSupplementArgument || !this.comparisonResult) return;
    this.pendingSupplementArgument = this.generatedSupplementArgument;
    this.exportSupplementPDF();
    this.pendingSupplementArgument = '';
  }

  // ═══════════════════════════════════════════════════════════════
  // Supplement Defense Package
  // ═══════════════════════════════════════════════════════════════

  /** Percent difference between ACI and carrier totals. */
  getPercentDifference(): number {
    if (!this.comparisonResult || this.comparisonResult.carrier_total === 0) return 0;
    return ((this.comparisonResult.aci_total - this.comparisonResult.carrier_total)
      / this.comparisonResult.carrier_total) * 100;
  }

  /** Items where ACI and carrier quantities differ (scope mismatch). */
  getScopeMismatchItems(): { room: string; item: any }[] {
    if (!this.comparisonResult) return [];
    const items: { room: string; item: any }[] = [];
    for (const room of this.comparisonResult.rooms) {
      for (const item of room.items) {
        if (item.status === 'price_diff' &&
            item.aci_quantity != null && item.carrier_quantity != null &&
            item.aci_quantity !== item.carrier_quantity) {
          items.push({ room: room.room_name, item });
        }
      }
    }
    return items;
  }

  /** Get pricing-only variance items (same qty, different price). */
  getPricingVarianceItems(): { room: string; item: any }[] {
    if (!this.comparisonResult) return [];
    const items: { room: string; item: any }[] = [];
    for (const room of this.comparisonResult.rooms) {
      for (const item of room.items) {
        if (item.status === 'price_diff' &&
            item.aci_quantity === item.carrier_quantity) {
          items.push({ room: room.room_name, item });
        }
      }
    }
    return items;
  }

  /** Build the full supplement defense package from current comparison data. */
  buildDefensePackage(): SupplementDefensePackage | null {
    if (!this.comparisonResult) return null;

    const cr = this.comparisonResult;
    const propertyParts = [
      this.linkedClaim?.address_line1, this.linkedClaim?.city,
      this.linkedClaim?.state, this.linkedClaim?.zip,
    ].filter(Boolean);

    // Use shared financial engine for supplement opportunity check
    const financialSnapshot = this.financialEngine.compute({
      aci_estimate_total: cr.aci_total,
      carrier_estimate_total: cr.carrier_total,
      total_paid: this.totalRecovered,
    });

    // Underpaid items
    const underpaidItems: any[] = [];
    for (const room of cr.rooms) {
      for (const item of room.items) {
        if (item.status === 'price_diff' && (item.difference || 0) > 0) {
          underpaidItems.push({
            room: room.room_name, description: item.description,
            aciAmount: item.aci_total || 0, carrierAmount: item.carrier_total || 0,
            difference: item.difference || 0,
          });
        }
      }
    }

    // Omitted items
    const omittedItems: any[] = [];
    for (const room of cr.rooms) {
      for (const item of room.items) {
        if (item.status === 'aci_only') {
          omittedItems.push({
            room: room.room_name, description: item.description,
            aciAmount: item.aci_total || 0, carrierAmount: 0,
            difference: item.aci_total || 0,
          });
        }
      }
    }

    // Pricing variance items
    const varianceItems: any[] = [];
    for (const room of cr.rooms) {
      for (const item of room.items) {
        if (item.status === 'price_diff') {
          const hasQtyDiff = item.aci_quantity !== item.carrier_quantity;
          const hasPriceDiff = item.aci_unit_cost !== item.carrier_unit_cost;
          varianceItems.push({
            room: room.room_name, description: item.description,
            aciUnitPrice: item.aci_unit_cost || 0,
            carrierUnitPrice: item.carrier_unit_cost || 0,
            aciQuantity: item.aci_quantity || 0,
            carrierQuantity: item.carrier_quantity || 0,
            totalDifference: item.difference || 0,
            varianceType: hasQtyDiff && hasPriceDiff ? 'both' : hasQtyDiff ? 'quantity' : 'price',
          });
        }
      }
    }

    // Recommended next action based on comparison state
    const nextAction = this.inferRecommendedNextAction(cr, financialSnapshot);

    return {
      claimSummary: {
        projectName: this.projectForm.get('name')?.value || '',
        carrierName: this.selectedCarrierEstimate?.carrier_name || '',
        claimNumber: this.linkedClaim?.claim_number || '',
        insuredName: this.linkedClaim?.insured_name || '',
        propertyAddress: propertyParts.join(', '),
        aciTotal: cr.aci_total,
        carrierTotal: cr.carrier_total,
        supplementTotal: cr.supplement_total,
        percentDifference: this.getPercentDifference(),
      },
      underpaymentSummary: {
        totalUnderpaidAmount: this.getUnderpaidItemsTotal(),
        underpaidItemCount: underpaidItems.length,
        items: underpaidItems,
      },
      omittedScopeSummary: {
        totalOmittedAmount: this.getMissingItemsTotal(),
        omittedItemCount: omittedItems.length,
        items: omittedItems,
      },
      pricingVarianceSummary: {
        totalVarianceAmount: varianceItems.reduce((s: number, i: any) => s + i.totalDifference, 0),
        varianceItemCount: varianceItems.length,
        items: varianceItems,
      },
      defenseNotes: { ...this.defenseNotes },
      recommendedNextAction: nextAction,
      generatedAt: new Date().toISOString(),
    };
  }

  /** Infer the recommended next action based on claim/comparison state. */
  private inferRecommendedNextAction(cr: ComparisonResult, fin: any): string {
    if (fin.recoveryPercent >= 100) {
      return 'Claim fully recovered. Close supplement workflow.';
    }
    if (cr.aci_only_count > 0 && cr.price_diff_count > 0) {
      return 'Send supplement demand with omitted scope and pricing corrections. Include defense documentation.';
    }
    if (cr.aci_only_count > 0) {
      return 'Send supplement demand focusing on omitted scope items with supporting photos and measurements.';
    }
    if (cr.price_diff_count > 0) {
      return 'Send supplement demand with pricing variance documentation and local market rate support.';
    }
    if (cr.supplement_total > 0) {
      return 'Review comparison and prepare supplement demand.';
    }
    return 'No supplement action needed — carrier estimate aligns with ACI scope.';
  }

  /** Navigate to defense view and build the package. */
  openDefenseView(): void {
    if (!this.comparisonResult) {
      this.snackBar.open('Run a carrier comparison first.', 'Close', { duration: 3000 });
      return;
    }
    this.defensePackage = this.buildDefensePackage();
    this.activeView = 'defense';
  }

  /** Copy defense notes to clipboard as formatted text. */
  copyDefensePackage(): void {
    if (!this.defensePackage) return;
    const dp = this.defensePackage;
    const lines = [
      `SUPPLEMENT DEFENSE PACKAGE`,
      `Generated: ${new Date(dp.generatedAt).toLocaleDateString()}`,
      ``,
      `── CLAIM SUMMARY ──`,
      `Carrier: ${dp.claimSummary.carrierName}`,
      `Claim #: ${dp.claimSummary.claimNumber}`,
      `Insured: ${dp.claimSummary.insuredName}`,
      `Property: ${dp.claimSummary.propertyAddress}`,
      `ACI Total: ${this.fmtCurrency(dp.claimSummary.aciTotal)}`,
      `Carrier Total: ${this.fmtCurrency(dp.claimSummary.carrierTotal)}`,
      `Supplement Amount: ${this.fmtCurrency(dp.claimSummary.supplementTotal)}`,
      `Variance: ${dp.claimSummary.percentDifference.toFixed(1)}%`,
      ``,
      `── CARRIER UNDERPAYMENT (${dp.underpaymentSummary.underpaidItemCount} items) ──`,
      `Total: ${this.fmtCurrency(dp.underpaymentSummary.totalUnderpaidAmount)}`,
      ...dp.underpaymentSummary.items.map(i =>
        `  • ${i.room} — ${i.description}: Carrier ${this.fmtCurrency(i.carrierAmount)} → ACI ${this.fmtCurrency(i.aciAmount)} (${this.fmtCurrency(i.difference)} owed)`
      ),
      ``,
      `── OMITTED SCOPE (${dp.omittedScopeSummary.omittedItemCount} items) ──`,
      `Total: ${this.fmtCurrency(dp.omittedScopeSummary.totalOmittedAmount)}`,
      ...dp.omittedScopeSummary.items.map(i =>
        `  • ${i.room} — ${i.description}: ${this.fmtCurrency(i.aciAmount)}`
      ),
      ``,
      `── PRICING VARIANCE (${dp.pricingVarianceSummary.varianceItemCount} items) ──`,
      `Total: ${this.fmtCurrency(dp.pricingVarianceSummary.totalVarianceAmount)}`,
      ...dp.pricingVarianceSummary.items.map(i =>
        `  • ${i.room} — ${i.description}: ${i.varianceType} variance, diff ${this.fmtCurrency(i.totalDifference)}`
      ),
    ];

    // Include defense notes if any are filled in
    const notes = this.defenseNotes;
    if (this.hasAnyDefenseNotes()) {
      lines.push(``, `── DEFENSE NOTES ──`);
      if (notes.pricingDefense) lines.push(``, `Pricing Defense:`, notes.pricingDefense);
      if (notes.omittedScopeDefense) lines.push(``, `Omitted Scope Defense:`, notes.omittedScopeDefense);
      if (notes.matchingContinuityDefense) lines.push(``, `Matching / Continuity:`, notes.matchingContinuityDefense);
      if (notes.quantityScopeDefense) lines.push(``, `Quantity / Scope Correction:`, notes.quantityScopeDefense);
      if (notes.codeStandardSupport) lines.push(``, `Code & Standard Support:`, notes.codeStandardSupport);
      if (notes.recommendedActionNotes) lines.push(``, `Adjuster Notes on Next Steps:`, notes.recommendedActionNotes);
    }

    lines.push(``, `── RECOMMENDED NEXT ACTION ──`, dp.recommendedNextAction);

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      this.snackBar.open('Defense package copied to clipboard.', 'Close', { duration: 3000 });
    });
  }

  /** Export defense PDF with structured defense sections rendered directly. */
  exportDefensePDF(): void {
    if (!this.comparisonResult) return;
    // Build structured defense narrative and inject into the supplement PDF
    const defenseText = this.buildDefenseNarrativeText();
    if (defenseText) {
      this.pendingSupplementArgument = defenseText;
    }
    this.exportSupplementPDF();
    this.pendingSupplementArgument = '';
  }

  /** Build a structured defense narrative with labeled sections for PDF output. */
  private buildDefenseNarrativeText(): string {
    const sections: string[] = [];
    const n = this.defenseNotes;

    if (n.pricingDefense) {
      sections.push(`PRICING DEFENSE\n${'─'.repeat(40)}\n${n.pricingDefense}`);
    }
    if (n.omittedScopeDefense) {
      sections.push(`OMITTED SCOPE DEFENSE\n${'─'.repeat(40)}\n${n.omittedScopeDefense}`);
    }
    if (n.matchingContinuityDefense) {
      sections.push(`MATCHING / CONTINUITY RATIONALE\n${'─'.repeat(40)}\n${n.matchingContinuityDefense}`);
    }
    if (n.quantityScopeDefense) {
      sections.push(`QUANTITY / SCOPE CORRECTION\n${'─'.repeat(40)}\n${n.quantityScopeDefense}`);
    }
    if (n.codeStandardSupport) {
      sections.push(`CODE & STANDARD SUPPORT\n${'─'.repeat(40)}\n${n.codeStandardSupport}`);
    }
    if (n.recommendedActionNotes) {
      sections.push(`RECOMMENDED NEXT ACTION\n${'─'.repeat(40)}\n${n.recommendedActionNotes}`);
    }

    return sections.join('\n\n');
  }

  // ═══════════════════════════════════════════════════════════════
  // Defense Notes Persistence
  // ═══════════════════════════════════════════════════════════════

  /** Initialize the debounced auto-save for defense notes. */
  private initDefenseNotesAutoSave(): void {
    this.defenseNotesSaveSub = this.defenseNotesSaveSubject.pipe(
      debounceTime(1500),
      distinctUntilChanged(),
    ).subscribe(() => {
      this.persistDefenseNotes();
    });
  }

  /** Called from template on any defense note field change. */
  onDefenseNoteChanged(): void {
    this.defenseNotesSaved = false;
    this.defenseNotesSaveSubject.next();
  }

  /** Load defense notes from backend for the current estimate project. */
  private loadDefenseNotes(): void {
    if (!this.estimateId) return;
    this.estimatingService.getDefenseNotes(this.estimateId).subscribe({
      next: (payload) => {
        if (payload) {
          this.defenseNotes = defenseNotesFromPayload(payload);
        }
        this.defenseNotesLoaded = true;
      },
      error: () => {
        // Endpoint may not exist yet — use defaults silently
        this.defenseNotes = createEmptyDefenseNotes();
        this.defenseNotesLoaded = true;
      },
    });
  }

  /** Persist defense notes to the backend. */
  private persistDefenseNotes(): void {
    if (!this.estimateId) return;
    this.defenseNotesSaving = true;
    const payload = defenseNotesToPayload(this.defenseNotes);
    this.estimatingService.saveDefenseNotes(this.estimateId, payload).subscribe({
      next: () => {
        this.defenseNotesSaving = false;
        this.defenseNotesSaved = true;
      },
      error: () => {
        this.defenseNotesSaving = false;
        // Silently fail — notes stay in memory until next attempt
      },
    });
  }

  /** Manual save trigger from the defense view. */
  saveDefenseNotesNow(): void {
    this.persistDefenseNotes();
  }

  /** Check if any defense notes have content. */
  hasAnyDefenseNotes(): boolean {
    const n = this.defenseNotes;
    return !!(n.pricingDefense || n.omittedScopeDefense || n.matchingContinuityDefense
      || n.quantityScopeDefense || n.codeStandardSupport || n.recommendedActionNotes);
  }

  // ═══════════════════════════════════════════════════════════════
  // AI Defense Draft Generation
  // ═══════════════════════════════════════════════════════════════

  /** Map from API section key to the DefenseNotes property name. */
  private static readonly SECTION_TO_FIELD: Record<string, keyof DefenseNotes> = {
    pricing_defense: 'pricingDefense',
    omitted_scope_defense: 'omittedScopeDefense',
    matching_continuity_defense: 'matchingContinuityDefense',
    quantity_scope_defense: 'quantityScopeDefense',
    code_standard_support: 'codeStandardSupport',
    recommended_action_notes: 'recommendedActionNotes',
  };

  /** Generate an AI draft for a specific defense section.
   *  If the field already has content, prompts for confirmation before overwriting. */
  generateDefenseDraft(section: string): void {
    if (!this.estimateId || !this.comparisonResult) {
      this.snackBar.open('Run a carrier comparison first.', 'Close', { duration: 3000 });
      return;
    }

    const fieldKey = EstimatingDetailComponent.SECTION_TO_FIELD[section];
    if (!fieldKey) return;

    // Check if field already has content — confirm before overwriting
    const currentValue = this.defenseNotes[fieldKey];
    if (currentValue && currentValue.trim().length > 0) {
      if (!confirm('This section already has content. Replace it with an AI-generated draft?')) {
        return;
      }
    }

    this.defenseGenerating[section] = true;
    this.defenseGenerated[section] = false;

    this.estimatingService
      .generateDefenseNoteDraft(
        this.estimateId,
        section,
        this.selectedCarrierEstimate?.id
      )
      .subscribe({
        next: (res) => {
          (this.defenseNotes as any)[fieldKey] = res.draft_text;
          this.defenseGenerating[section] = false;
          this.defenseGenerated[section] = true;
          // Trigger auto-save
          this.onDefenseNoteChanged();
          this.snackBar.open('AI draft generated. Review and edit as needed.', 'Close', { duration: 3000 });
        },
        error: (err) => {
          this.defenseGenerating[section] = false;
          const detail = err?.error?.detail || 'AI draft generation failed';
          this.snackBar.open(detail, 'Close', { duration: 5000 });
        },
      });
  }

  // ═══════════════════════════════════════════════════════════════
  // Defense Template Library
  // ═══════════════════════════════════════════════════════════════

  /** Get available templates for a defense section. */
  getDefenseTemplates(category: string): DefenseTemplate[] {
    return getTemplatesByCategory(category);
  }

  /** Insert a template into the corresponding defense note field.
   *  Appends if content exists and user confirms, or replaces. */
  insertDefenseTemplate(section: string, template: DefenseTemplate): void {
    const fieldKey = EstimatingDetailComponent.SECTION_TO_FIELD[section];
    if (!fieldKey) return;

    const currentValue = (this.defenseNotes[fieldKey] || '').trim();

    if (currentValue.length > 0) {
      const action = confirm(
        'This section already has content.\n\nClick OK to append the template below your existing text.\nClick Cancel to keep your current text unchanged.'
      );
      if (!action) return;
      // Append with separator
      (this.defenseNotes as any)[fieldKey] = currentValue + '\n\n' + template.text;
    } else {
      (this.defenseNotes as any)[fieldKey] = template.text;
    }

    this.onDefenseNoteChanged();
    this.snackBar.open(`Template "${template.name}" inserted.`, 'Close', { duration: 3000 });
  }

  // ═══════════════════════════════════════════════════════════════
  // AI Claim Strategy Engine
  // ═══════════════════════════════════════════════════════════════

  generateClaimStrategy(): void {
    if (!this.estimateId || !this.comparisonResult) {
      this.snackBar.open('Run a carrier comparison first.', 'Close', { duration: 3000 });
      return;
    }

    this.strategyGenerating = true;
    this.claimStrategy = null;

    this.estimatingService
      .generateSupplementArgument(this.estimateId, this.selectedCarrierEstimate?.id)
      .subscribe({
        next: (res) => {
          // Build comprehensive strategy from comparison data + AI argument
          this.claimStrategy = this.buildClaimStrategy(res.argument_text, res.has_policy_support);
          this.strategyGenerating = false;
          this.snackBar.open('Claim strategy generated. Review and edit as needed.', 'Close', { duration: 3000 });
        },
        error: () => {
          // Fallback: build strategy from data without AI
          this.claimStrategy = this.buildClaimStrategy(null, false);
          this.strategyGenerating = false;
        },
      });
  }

  private buildClaimStrategy(aiArgument: string | null, hasPolicySupport: boolean): string {
    const cr = this.comparisonResult!;
    const snapshot = this.financialEngine.compute({
      aci_estimate_total: cr.aci_total,
      carrier_estimate_total: cr.carrier_total,
      total_paid: this.totalRecovered,
    });

    const lines: string[] = [];

    // Header
    lines.push('CLAIM STRATEGY ANALYSIS');
    lines.push('═'.repeat(50));
    lines.push('');

    // Financial Position
    lines.push('FINANCIAL POSITION');
    lines.push('─'.repeat(40));
    lines.push(`ACI Estimate:        ${this.fmtCurrency(cr.aci_total)}`);
    lines.push(`Carrier Estimate:    ${this.fmtCurrency(cr.carrier_total)}`);
    lines.push(`Underpaid Amount:    ${this.fmtCurrency(cr.supplement_total)}`);
    lines.push(`Payments Received:   ${this.fmtCurrency(this.totalRecovered)}`);
    lines.push(`Remaining Recovery:  ${this.fmtCurrency(Math.max(cr.aci_total - this.totalRecovered, 0))}`);
    lines.push(`Recovery Rate:       ${snapshot.recoveryPercent.toFixed(1)}%`);
    lines.push('');

    // Supplement Opportunities
    lines.push('SUPPLEMENT OPPORTUNITIES');
    lines.push('─'.repeat(40));
    if (cr.aci_only_count > 0) {
      lines.push(`${cr.aci_only_count} omitted scope items totaling ${this.fmtCurrency(this.getMissingItemsTotal())}`);
    }
    if (cr.price_diff_count > 0) {
      lines.push(`${cr.price_diff_count} underpaid items totaling ${this.fmtCurrency(this.getUnderpaidItemsTotal())}`);
    }
    const scopeMismatch = this.getScopeMismatchItems();
    if (scopeMismatch.length > 0) {
      lines.push(`${scopeMismatch.length} scope/quantity mismatches requiring correction`);
    }
    if (cr.aci_only_count === 0 && cr.price_diff_count === 0) {
      lines.push('No supplement opportunities identified — carrier estimate aligns with ACI scope.');
    }
    lines.push('');

    // Carrier Negotiation Points
    lines.push('CARRIER NEGOTIATION POINTS');
    lines.push('─'.repeat(40));
    if (cr.aci_only_count > 0) {
      lines.push(`• Omitted scope: ${cr.aci_only_count} items the carrier failed to include`);
    }
    if (cr.price_diff_count > 0) {
      const pricingVariance = this.getPricingVarianceItems();
      lines.push(`• Pricing variance: ${pricingVariance.length} items with price-only differences`);
      if (scopeMismatch.length > 0) {
        lines.push(`• Quantity disputes: ${scopeMismatch.length} items with measurement discrepancies`);
      }
    }
    if (snapshot.supplementOpportunity) {
      const pctDiff = cr.carrier_total > 0
        ? (((cr.aci_total - cr.carrier_total) / cr.carrier_total) * 100).toFixed(1)
        : '100';
      lines.push(`• Total carrier underpayment: ${pctDiff}% below ACI scope`);
    }
    if (hasPolicySupport) {
      lines.push('• Policy language available to support supplement demand');
    }
    lines.push('');

    // Missing Documentation
    lines.push('MISSING DOCUMENTATION');
    lines.push('─'.repeat(40));
    const missing: string[] = [];
    if (!hasPolicySupport) missing.push('• Policy document not uploaded — upload for stronger arguments');
    if (cr.aci_only_count > 0) missing.push('• Photos documenting omitted scope items');
    if (scopeMismatch.length > 0) missing.push('• Field measurements supporting quantity corrections');
    if (cr.price_diff_count > 0) missing.push('• Local market pricing documentation or contractor bids');
    if (missing.length === 0) {
      lines.push('All key documentation appears to be in place.');
    } else {
      lines.push(...missing);
    }
    lines.push('');

    // Recommended Next Step
    lines.push('RECOMMENDED NEXT STEP');
    lines.push('─'.repeat(40));
    if (snapshot.recoveryPercent >= 95) {
      lines.push('CLOSE: Claim is fully recovered. Finalize file and close.');
    } else if (this.totalRecovered > 0 && cr.supplement_total > 0) {
      lines.push('SUPPLEMENT: Submit supplement demand with updated scope and pricing documentation.');
      lines.push('Include defense notes for pricing, omitted scope, and code/standard support.');
    } else if (cr.supplement_total > cr.aci_total * 0.3) {
      lines.push('APPRAISAL: Consider invoking the appraisal clause.');
      lines.push(`The ${((cr.supplement_total / cr.carrier_total) * 100).toFixed(0)}% underpayment exceeds typical negotiation thresholds.`);
    } else if (cr.supplement_total > 0) {
      lines.push('NEGOTIATION: Submit supplement demand and negotiate with carrier adjuster.');
      lines.push('Request joint reinspection if carrier disputes scope items.');
    } else {
      lines.push('MONITOR: No supplement action needed at this time. Monitor for additional payments.');
    }

    // AI-Generated Argument
    if (aiArgument) {
      lines.push('');
      lines.push('AI-GENERATED SUPPLEMENT ARGUMENT');
      lines.push('─'.repeat(40));
      lines.push(aiArgument);
    }

    return lines.join('\n');
  }

  copyClaimStrategy(): void {
    if (!this.claimStrategy) return;
    navigator.clipboard.writeText(this.claimStrategy).then(() => {
      this.snackBar.open('Strategy copied to clipboard.', 'Close', { duration: 3000 });
    });
  }

  insertStrategyIntoReport(): void {
    if (!this.claimStrategy || !this.comparisonResult) return;
    this.pendingSupplementArgument = this.claimStrategy;
    this.exportSupplementPDF();
    this.pendingSupplementArgument = '';
  }
}
