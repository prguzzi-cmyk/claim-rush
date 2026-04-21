// Bootstrapping
import { BrowserModule } from "@angular/platform-browser";
import { LOCALE_ID, NgModule, CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { AppRoutingModule } from "./app-routing.module";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { AppComponent } from "./app.component";
import {
  NgbAlertModule,
  NgbDatepickerModule,
  NgbDateStruct,
} from "@ng-bootstrap/ng-bootstrap";
import { JsonPipe, NgOptimizedImage } from "@angular/common";
import { FileSizePipe } from "./filesize.pipe";
import { NgxMaskModule, IConfig } from "ngx-mask";
import { MatTableExporterModule } from "mat-table-exporter";

// Third party dependencies
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { JwtModule } from "@auth0/angular-jwt";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

import { MatPaginatorModule } from "@angular/material/paginator";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatFormFieldModule } from "@angular/material/form-field";

import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatStepperModule } from "@angular/material/stepper";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatChipsModule } from "@angular/material/chips";
import { MatNativeDateModule } from "@angular/material/core";
import { MatDatepickerModule } from "@angular/material/datepicker";
import { MatDialogModule } from "@angular/material/dialog";
import { MatDividerModule } from "@angular/material/divider";
import { MatExpansionModule } from "@angular/material/expansion";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatRadioModule } from "@angular/material/radio";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatSelectModule } from "@angular/material/select";
import { MatSidenavModule } from "@angular/material/sidenav";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatSnackBarModule } from "@angular/material/snack-bar";
import { MatAutocompleteModule } from "@angular/material/autocomplete";
import { MatButtonToggleModule } from "@angular/material/button-toggle";

import { MatTreeModule } from "@angular/material/tree";

import { MatBadgeModule } from "@angular/material/badge";

import {
  MatHeaderRowDef,
  MatRowDef,
  MatTableModule,
} from "@angular/material/table";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatGridListModule } from "@angular/material/grid-list";
import { MatListModule } from "@angular/material/list";
import { MatTabsModule } from "@angular/material/tabs";

import { LeafletModule } from "@asymmetrik/ngx-leaflet";
import { GoogleMapsModule } from "@angular/google-maps";
import { MomentModule } from "ngx-moment";
import { MatMomentDateModule } from "@angular/material-moment-adapter";
import { NgxSpinnerModule } from "ngx-spinner";
import { NgxTimelineModule } from "ngx-timeline";
import { UpdateService } from "./services/update.service";

import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
  ErrorStateMatcher,
  ShowOnDirtyErrorStateMatcher,
} from "@angular/material/core";

// Interceptors
import { ApiInterceptor } from "./interceptors/api-interceptor";
import { ErrorInterceptor } from "./interceptors/error.interceptor";
import { TwilioKillSwitchInterceptor } from "./interceptors/twilio-kill-switch.interceptor";

// Guards
import { AuthGuard } from "./guards/auth.guard";

// Permissions
import { NgxPermissionsModule } from "ngx-permissions";

// Services
import { AuthService } from "./services/auth.service";

// Components
import { ResourcesComponent } from "./components/sections/resources/resources.component";
import { ResourceComponent } from "./components/sections/resources/resource/resource.component";
import { AssistantComponent } from "./components/sections/resources/assistant/assistant.component";
import { LoginComponent } from "./components/login/login.component";
import { ApplicationComponent } from "./components/application.component";
import { SidebarComponent } from "./components/layout/sidebar/sidebar.component";
import { DashboardComponent } from "./components/sections/dashboard/dashboard.component";
import { CommandCenterIntroComponent } from "./components/sections/dashboard/command-center-intro/command-center-intro.component";
import { UsersComponent } from "./components/sections/users/users.component";
import { PasswordChangeDialogComponent } from "./components/dialogs/password-change-dialog/password-change-dialog.component";
import { UserDetailsDialogComponent } from "./components/dialogs/user-details-dialog/user-details-dialog.component";
import { RegistrationComponent } from "./components/sections/users/registration/registration.component";
import { ForgottenPasswordDialogComponent } from "./components/dialogs/forgotten-password-dialog/forgotten-password-dialog.component";
import { PasswordResetComponent } from "./components/sections/users/password-reset/password-reset.component";
import { RolesComponent } from "./components/sections/roles/roles.component";
import { HomeComponent } from "./components/home/home.component";
import { RoleDetailsDialogComponent } from "./components/dialogs/role-details-dialog/role-details-dialog.component";
import { ProfileComponent } from "./components/sections/profile/profile.component";
import { HeaderComponent } from "./components/layout/header/header.component";
import { FooterComponent } from "./components/layout/footer/footer.component";
import { NgbAccordionModule, NgbModule } from "@ng-bootstrap/ng-bootstrap";
import { AutocompleteOffDirective } from "./directives/autocomplete-off.directive";
import { ForgotPasswordComponent } from "./components/forgot-password/forgot-password.component";
import { Leads } from "./components/sections/leads/leads/leads.component";
import { CreateLeadComponent } from "./components/sections/leads/create-lead/create-lead.component";
import { LeadComponent } from "./components/sections/leads/lead/lead.component";
import { FollowupDialogComponent } from "./components/dialogs/followup-dialog/followup-dialog.component";
import { NgbPopoverModule } from "@ng-bootstrap/ng-bootstrap";
import { LeadDetailsDialogComponent } from "./components/dialogs/lead-details-dialog/lead-details-dialog.component";
import { ClientsComponent } from "./components/sections/clients/clients.component";
import { LeadDocumentsDialogComponent } from "./components/dialogs/lead-documents-dialog/lead-documents-dialog.component";
import { LeadTasksDialogComponent } from "./components/dialogs/lead-tasks-dialog/lead-tasks-dialog.component";
import { RecordResultDialogComponent } from "./components/dialogs/record-result-dialog/record-result-dialog.component";
import { ClientConversionDialogComponent } from "./components/dialogs/client-conversion-dialog/client-conversion-dialog.component";
import { TagsComponent } from "./components/sections/tags/tags.component";
import { ClientComponent } from "./components/sections/clients/client/client.component";
import { ClientDetailsDialogComponent } from "./components/dialogs/client-details-dialog/client-details-dialog.component";
import { LeadCommentsDialogComponent } from "./components/dialogs/lead-comments-dialog/lead-comments-dialog.component";
import { SourceItemCardComponent } from "./components/sections/resources/sources-agent/source-item-card/source-item-card.component";
import { SourceItemDialogComponent } from "./components/dialogs/source-item-dialog/source-item-dialog.component";
import { TasksService } from "./services/tasks.service";
import { SchedulesService } from "./services/schedules.service";
import { TaskListComponent } from "./components/sections/tasks/task-list/task-list.component";
import { CreateTaskComponent } from "./components/sections/tasks/create-task/create-task.component";
import { ScheduleListComponent } from "./components/sections/schedules/schedule-list/schedule-list.component";
import { CreateScheduleComponent } from "./components/sections/schedules/create-schedule/create-schedule.component";
import { ClientCommentsDialogComponent } from "./components/dialogs/client-comments-dialog/client-comments-dialog.component";
import { ClientTasksDialogComponent } from "./components/dialogs/client-tasks-dialog/client-tasks-dialog.component";
import { ClientFilesDialogComponent } from "./components/dialogs/client-files-dialog/client-files-dialog.component";
import { ClaimDialogComponent } from "./components/dialogs/client-claim-dialog/claim-dialog.component";
import { FileDialogComponent } from "./components/dialogs/file-dialog/file-dialog.component";
import { TagDialogComponent } from "./components/dialogs/tag-dialog/tag-dialog.component";
import { SelectComponent } from "./components/select/select.component";
import { SearchFieldComponent } from "./components/search-field/search-field.component";
import { SourcesAdminComponent } from "./components/sections/resources/sources-admin/sources-admin.component";
import { TasksComponent } from "./components/sections/tasks/tasks/tasks.component";
import { ImportLeadsDialogComponent } from "./components/dialogs/import-leads-dialog/import-leads-dialog.component";
import { SourcesAgentComponent } from "./components/sections/resources/sources-agent/sources-agent.component";
import { SourceItemPageComponent } from "./components/sections/resources/sources-agent/source-item-page/source-item-page.component";
import { LearnComponent } from "./components/sections/resources/learn/learn.component";
import { SignComponent } from "./components/sections/resources/sign/sign.component";
import { AdjustComponent } from "./components/sections/resources/adjust/adjust.component";
import { ImportantLinksComponent } from "./components/sections/resources/important-links/important-links.component";
import { BusinessDocsAdminComponent } from "./components/sections/business-docs-admin/business-docs-admin.component";
import { BusinessDocsComponent } from "./components/sections/resources/business-docs/business-docs.component";
import { ClaimComponent } from "./components/sections/claims/claim/claim.component";
import { UserTaskListComponent } from "./components/sections/user-task/user-task-list/user-task-list.component";
import { CreateuserTaskComponent } from "./components/sections/user-task/create-user-task/create-user-task.component";
import { ClaimsComponent } from "./components/sections/claims/claims/claims.component";
import { ClaimTasksDialogComponent } from "./components/dialogs/claim-tasks-dialog/claim-tasks-dialog.component";
import { ClaimFilesDialogComponent } from "./components/dialogs/claim-files-dialog/claim-files-dialog.component";
import { ClaimCommentsDialogComponent } from "./components/dialogs/claim-comments-dialog/claim-comments-dialog.component";
import { AgentDashboardComponent } from "./components/sections/agent-dashboard/agent-dashboard.component";
import { EarningsTabComponent } from "./components/sections/agent-dashboard/earnings-tab/earnings-tab.component";
import { FinancialDetailDialogComponent } from "./components/sections/agent-dashboard/earnings-tab/financial-detail-dialog/financial-detail-dialog.component";
import { CommissionStatementDialogComponent } from "./components/sections/agent-dashboard/earnings-tab/commission-statement-dialog/commission-statement-dialog.component";
import { CommissionsAdminViewComponent } from "./components/sections/commissions-admin-view/commissions-admin-view.component";
import { CreateClientTaskComponent } from "./components/sections/client-task/create-client-task/create-client-task.component";
import { UserClientListComponent } from "./components/sections/client-task/user-client-list/user-client-list.component";
import { AngularEditorModule } from "@kolkov/angular-editor";
import { DragDropModule } from "@angular/cdk/drag-drop";
import { NewslettersComponent } from "./components/sections/newsletters/newsletters.component";
import { NewsletterDialogComponent } from "./components/dialogs/newsletter-dialog/newsletter-dialog.component";
import { AnnouncementsComponent } from "./components/sections/announcements/announcements.component";
import { AnnouncementDialogComponent } from "./components/dialogs/announcement-dialog/announcement-dialog.component";
import { ClaimLedgerComponent } from "./components/sections/claims/claim-ledger/claim-ledger.component";
import { ClaimLedgerDialogComponent } from "./components/dialogs/claim-ledger-dialog/claim-ledger-dialog.component";
import { PermissionsComponent } from "./components/sections/permissions/permissions.component";
import { PermissionDialogComponent } from "./components/dialogs/permission-dialog/permission-dialog.component";
import { RolePermissionsComponent } from "./components/sections/role-permissions/role-permissions.component";
import { TerritoriesComponent } from "./components/sections/territories/territories.component";
import { TerritoryDetailsDialogComponent } from "./components/dialogs/territory-details-dialog/territory-details-dialog.component";
import { TerritoryAssignDialogComponent } from "./components/dialogs/territory-assign-dialog/territory-assign-dialog.component";
import { TerritoryMapComponent } from "./components/sections/territories/territory-map/territory-map.component";
import { PoliciesComponent } from "./components/sections/policies/policies.component";
import { PoliciesDialogComponent } from "./components/dialogs/policies-dialog/policies-dialog.component";
import { RolePermissionsDialogComponent } from "./components/dialogs/role-permissions-dialog/role-permissions-dialog.component";
import { AdvancedSearchComponent } from "./components/sections/advanced-search/advanced-search.component";
import { SearchComponent } from "./components/sections/search/search.component";
import { ImportClientsDialogComponent } from "./components/dialogs/import-clients-dialog/import-clients-dialog.component";
import { ImportClaimsDialogComponent } from "./components/dialogs/import-claims-dialog/import-claims-dialog.component";
import { ClaimBulkfilesDialogComponent } from "./components/dialogs/claim-bulkfiles-dialog/claim-bulkfiles-dialog.component";
import { NgxDocViewerModule } from "ngx-doc-viewer";
import { ViewDocumentDialogComponent } from "./components/dialogs/view-document-dialog/view-document-dialog.component";
import { ClientBulkFilesDialogComponent } from "./components/dialogs/client-bulk-files-dialog/client-bulk-files-dialog.component";
import { ClaimDetailsDialogComponent } from "./components/dialogs/claim-details-dialog/claim-details-dialog.component";
import { LeadsEditDialogComponent } from "./components/dialogs/leads-edit-dialog/leads-edit-dialog.component";
import { ReleaseNotesComponent } from "./components/sections/release-notes/release-notes.component";
import { TemplatesComponent } from "./components/sections/templates/templates.component";
import { TemplateDetailsDialogComponent } from "./components/dialogs/template-details-dialog/template-details-dialog.component";
import { TemplatesDialogComponent } from "./components/dialogs/templates-dialog/templates-dialog.component";
import { ClaimSearchComponent } from "./components/sections/claims/claim-search/claim-search.component";
import { ClientSearchComponent } from "./components/sections/clients/client-search/client-search.component";
import { LeadSearchComponent } from "./components/sections/leads/lead-search/lead-search.component";
import { PhoneNumberFormatPipe } from "./phone-number-format.pipe";
import { PaginatorComponent } from "./shared/paginator/paginator.component";
import { ClaimFilesShareDialogComponent } from "./components/dialogs/claim-files-share-dialog/claim-files-share-dialog.component";
import { SharedFilesComponent } from "./components/shared-files/shared-files.component";
import { MatSortModule } from "@angular/material/sort";
import { PortalFeatureComponent } from "./components/home/portal-feature/portal-feature.component";
import { RecruitsAdminComponent } from "./components/sections/recruits-admin/recruits-admin.component";
import { RecruitsHierarchyDialogComponent } from "./components/dialogs/recruits-hierarchy-dialog/recruits-hierarchy-dialog.component";
import { NgOrganizationChartComponent } from "./components/ng-organization-chart/ng-organization-chart.component";
import { NgOrganizationChartListComponent } from "./components/ng-organization-chart/ng-organization-chart-list/ng-organization-chart-list.component";
import { NgOrganizationChartNodeComponent } from "./components/ng-organization-chart/ng-organization-chart-node/ng-organization-chart-node.component";
import { CommissionSimulatorComponent } from "./components/sections/commission-simulator/commission-simulator.component";
import { CommissionBreakdownDialogComponent } from "./components/sections/commission-simulator/commission-breakdown-dialog/commission-breakdown-dialog.component";
import { CommissionResultPanelComponent } from "./components/sections/commission-simulator/commission-result-panel/commission-result-panel.component";
import { TeamStructureDialogComponent } from "./components/sections/commission-simulator/team-structure-dialog/team-structure-dialog.component";
import { BasicCommissionCalculatorComponent } from "./components/sections/basic-commission-calculator/basic-commission-calculator.component";
import { MyCommissionComponent } from "./components/sections/claims/my-commission/my-commission.component";
import { TitleChangeComponent } from "./components/sections/title-change/title-change.component";

import { UserDashboardComponent } from "./components/sections/dashboard/user-dashboard/user-dashboard.component";
import { ClaimPaymentReportComponent } from "./components/sections/claims/claim-payment-report/claim-payment-report.component";
import { ProductListComponent } from "./components/sections/shop-management/product-list/product-list.component";
import { OrderListComponent } from "./components/sections/shop-management/order-list/order-list.component";
import { CategoryListComponent } from "./components/sections/shop-management/category-list/category-list.component";
import { CartComponent } from "./components/sections/shop/cart/cart.component";
import { DigitalHubComponent } from "./components/sections/shop/digital-hub/digital-hub.component";
import { OrderHistoryComponent } from "./components/sections/shop/order-history/order-history.component";
import { CategoryDetailsDialogComponent } from "./components/dialogs/category-details-dialog/category-details-dialog.component";
import { ProductDetailsDialogComponent } from "./components/dialogs/product-details-dialog/product-details-dialog.component";
import { AccountListComponent } from "./components/sections/shop-management/account-list/account-list.component";
import { AccountDetailsDialogComponent } from "./components/dialogs/account-details-dialog/account-details-dialog.component";
import { OrderDetailsDialogComponent } from "./components/dialogs/order-details-dialog/order-details-dialog.component";
import { OrderDetailsManagementDialogComponent } from "./components/dialogs/order-details-management-dialog/order-details-management-dialog.component";


import { MyRecruitsComponent } from './components/sections/my-recruits/my-recruits.component';

import { ServiceWorkerModule } from "@angular/service-worker";
import { environment } from "../environments/environment";
import { TopbarComponent } from "./components/layout/topbar/topbar.component";
import { TaskBoardComponent } from "./components/sections/task-board/task-board.component";
import { ClaimTaskBoardComponent } from "./components/sections/claims/claim-task-board/claim-task-board.component";
import { CollaboratorsDialogComponent } from "./components/dialogs/collaborators-dialog/collaborators-dialog.component";
import { TeamMgrOverrideGraphComponentComponent } from './components/sections/recruits-admin/team-mgr-override-graph-component/team-mgr-override-graph-component.component';
import { ClientSidebarComponent } from './components/layout/client-sidebar/client-sidebar.component';
import { CustomerDashboardComponent } from './components/sections/customer-dashboard/customer-dashboard.component';
import { CustomerClaimsComponent } from './components/sections/claims/customer-claims/customer-claims.component';
import { CustomerClaimComponent } from "./components/sections/claims/customer-claim/customer-claim.component";
import { ClickOutsideDirective } from './directives/click-outside.directive';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { MyPersonalDocsDialogComponent } from './components/dialogs/user-personal-file-dialog/my-personal-docs-dialog.component';
import { FireIncidentsComponent } from './components/sections/fire-incidents/fire-incidents.component';
import { FireIncidentsListComponent } from './components/sections/fire-incidents/fire-incidents-list/fire-incidents-list.component';
import { FireIncidentsMapComponent } from './components/sections/fire-incidents/fire-incidents-map/fire-incidents-map.component';
import { FireAgenciesDialogComponent } from './components/sections/fire-incidents/fire-agencies-dialog/fire-agencies-dialog.component';
import { FireDataSourcesDialogComponent } from './components/sections/fire-incidents/fire-data-sources-dialog/fire-data-sources-dialog.component';
import { ConvertToLeadDialogComponent } from './components/sections/fire-incidents/convert-to-lead-dialog/convert-to-lead-dialog.component';
import { PropertyIntelligencePanelComponent } from './components/sections/fire-incidents/property-intelligence-panel/property-intelligence-panel.component';
import { ResponseDeskComponent } from './components/sections/response-desk/response-desk.component';
import { CommunicationsHubComponent } from './components/sections/communications-hub/communications-hub.component';
import { StormIntelligenceComponent } from './components/sections/storm-intelligence/storm-intelligence.component';
import { RoofIntelligenceComponent } from './components/sections/roof-intelligence/roof-intelligence.component';
import { PotentialClaimsComponent } from './components/sections/potential-claims/potential-claims.component';
import { CrimeClaimsIntelligenceComponent } from './components/sections/crime-claims-intelligence/crime-claims-intelligence.component';
import { EscalationAdminComponent } from './components/sections/escalation-admin/escalation-admin.component';
import { IntakeControlComponent } from './components/sections/intake-control/intake-control.component';
import { AgentSetupWizardComponent } from './components/sections/agent-setup-wizard/agent-setup-wizard.component';
import { IncidentIntelligenceComponent } from './components/sections/incident-intelligence/incident-intelligence.component';
import { TimeFilterComponent } from './components/sections/incident-intelligence/time-filter.component';
import { CallTypeConfigsComponent } from './components/sections/call-type-configs/call-type-configs.component';
import { CommandPaletteComponent } from './components/command-palette/command-palette.component';
import { EstimatingListComponent } from './components/sections/estimating/estimating-list/estimating-list.component';
import { EstimatingDetailComponent } from './components/sections/estimating/estimating-detail/estimating-detail.component';
import { PricingAdminComponent } from './components/sections/pricing-admin/pricing-admin.component';
import { PricingVersionDialogComponent } from './components/sections/pricing-admin/pricing-version-dialog/pricing-version-dialog.component';
import { PricingImportDialogComponent } from './components/sections/pricing-admin/pricing-import-dialog/pricing-import-dialog.component';
import { FireClaimsComponent } from './components/sections/fire-claims/fire-claims.component';
import { FireClaimListComponent } from './components/sections/fire-claims/fire-claim-list/fire-claim-list.component';
import { FireClaimFormComponent } from './components/sections/fire-claims/fire-claim-form/fire-claim-form.component';
import { FireClaimSummaryComponent } from './components/sections/fire-claims/fire-claim-summary/fire-claim-summary.component';

// Adjuster Assistant components
import { AdjusterCaseListComponent } from './components/sections/adjuster-assistant/adjuster-case-list/adjuster-case-list.component';
import { AdjusterCaseDetailComponent } from './components/sections/adjuster-assistant/adjuster-case-detail/adjuster-case-detail.component';

// Policy Vault components
import { PolicyVaultListComponent } from './components/sections/policy-vault/policy-vault-list/policy-vault-list.component';
import { PolicyVaultDetailComponent } from './components/sections/policy-vault/policy-vault-detail/policy-vault-detail.component';
import { PolicySectionInlineComponent } from './components/sections/policy-vault/policy-section-inline/policy-section-inline.component';
import { PolicyVaultAttachDialogComponent } from './components/dialogs/policy-vault-attach-dialog/policy-vault-attach-dialog.component';

// Advocacy components
import { ClaimFairnessComponent } from './components/sections/advocacy/claim-fairness/claim-fairness.component';
import { AdvocacyScriptsComponent } from './components/sections/advocacy/advocacy-scripts/advocacy-scripts.component';
import { DisasterResourcesComponent } from './components/sections/advocacy/disaster-resources/disaster-resources.component';

// Community Advocate components
import { CommunityAdvocateComponent } from './components/sections/community-advocate/community-advocate.component';
import { CaOverviewComponent } from './components/sections/community-advocate/ca-overview/ca-overview.component';
import { CaAdvocateProfilesComponent } from './components/sections/community-advocate/ca-advocate-profiles/ca-advocate-profiles.component';
import { CaTerritoryAudienceComponent } from './components/sections/community-advocate/ca-territory-audience/ca-territory-audience.component';
import { CaCampaignBuilderComponent } from './components/sections/community-advocate/ca-campaign-builder/ca-campaign-builder.component';
import { CaOutreachChannelsComponent } from './components/sections/community-advocate/ca-outreach-channels/ca-outreach-channels.component';
import { CaCommunityPagesComponent } from './components/sections/community-advocate/ca-community-pages/ca-community-pages.component';
import { CaPartnerOffersComponent } from './components/sections/community-advocate/ca-partner-offers/ca-partner-offers.component';
import { CaEducationLibraryComponent } from './components/sections/community-advocate/ca-education-library/ca-education-library.component';
import { CaSocialAdStudioComponent } from './components/sections/community-advocate/ca-social-ad-studio/ca-social-ad-studio.component';
import { CaAutomationsComponent } from './components/sections/community-advocate/ca-automations/ca-automations.component';
import { CaAnalyticsComponent } from './components/sections/community-advocate/ca-analytics/ca-analytics.component';
import { CaComplianceComponent } from './components/sections/community-advocate/ca-compliance/ca-compliance.component';

// Public pages
import { PublicLayoutComponent } from './components/public/public-layout/public-layout.component';
import { LandingPageComponent } from './components/public/landing-page/landing-page.component';
import { FeaturesPageComponent } from './components/public/features-page/features-page.component';
import { AppPreviewPageComponent } from './components/public/app-preview-page/app-preview-page.component';
import { RecruitmentMapComponent } from './components/public/recruitment-map/recruitment-map.component';
import { TerritoryApplyDialogComponent } from './components/public/territory-apply-dialog/territory-apply-dialog.component';
import { TerritoryControlPanelComponent } from './components/sections/territory-control-panel/territory-control-panel.component';
import { TerritoryControlEditDialogComponent } from './components/dialogs/territory-control-edit-dialog/territory-control-edit-dialog.component';
import { LeadDistributionComponent } from './components/sections/lead-distribution/lead-distribution.component';
import { LeadIntakeComponent } from './components/sections/lead-intake/lead-intake.component';
import { DistributeLeadDialogComponent } from './components/dialogs/distribute-lead-dialog/distribute-lead-dialog.component';
import { CommandBarComponent } from './components/layout/command-bar/command-bar.component';
import { LiveActivityPanelComponent } from './components/layout/live-activity-panel/live-activity-panel.component';
import { MagicLinkCallbackComponent } from './components/auth/magic-link-callback/magic-link-callback.component';
import { PasskeyRegisterDialogComponent } from './components/dialogs/passkey-register-dialog/passkey-register-dialog.component';
import { LineItemDialogComponent } from './components/dialogs/line-item-dialog/line-item-dialog.component';
import { CarrierPasteDialogComponent } from './components/dialogs/carrier-paste-dialog/carrier-paste-dialog.component';
import { CarrierPreviewDialogComponent } from './components/dialogs/carrier-preview-dialog/carrier-preview-dialog.component';
import { SupplementEmailDialogComponent } from './components/dialogs/supplement-email-dialog/supplement-email-dialog.component';
import { ClaimRecoveryComponent } from './components/sections/claim-recovery/claim-recovery.component';
import { ClaimWorkflowQueuesComponent } from './components/sections/claim-workflow-queues/claim-workflow-queues.component';
import { ClaimRecoveryTabComponent } from './components/sections/claims/claim-recovery-tab/claim-recovery-tab.component';

// Sales Rep components
import { SalesDashboardComponent } from './components/sections/sales-dashboard/sales-dashboard.component';
import { SalesClaimsComponent } from './components/sections/sales-claims/sales-claims.component';

// Rotation Lead Engine components
import { RotationLeadListComponent } from './components/sections/rotation-leads/rotation-lead-list/rotation-lead-list.component';
import { RotationLeadDetailComponent } from './components/sections/rotation-leads/rotation-lead-detail/rotation-lead-detail.component';
import { RotationConfigComponent } from './components/sections/rotation-leads/rotation-config/rotation-config.component';
import { RotationMetricsComponent } from './components/sections/rotation-leads/rotation-metrics/rotation-metrics.component';

// Skip Trace Wallet
import { SkipTraceWalletComponent } from './components/sections/skip-trace-wallet/skip-trace-wallet.component';

// Outreach Campaigns
import { OutreachCampaignsComponent } from './components/sections/outreach-campaigns/outreach-campaigns.component';
import { MessageTemplatesComponent } from './components/sections/message-templates/message-templates.component';

// Outreach Engine components
import { OutreachDashboardComponent } from './components/sections/outreach/outreach-dashboard/outreach-dashboard.component';
import { OutreachCampaignsComponent as OutreachCampaignsEngineComponent } from './components/sections/outreach/outreach-campaigns/outreach-campaigns.component';
import { OutreachTemplatesComponent } from './components/sections/outreach/outreach-templates/outreach-templates.component';
import { OutreachConversationsComponent } from './components/sections/outreach/outreach-conversations/outreach-conversations.component';
import { CampaignBuilderComponent } from './components/sections/outreach/campaign-builder/campaign-builder.component';

// UPA → ACI Outreach Funnel
import { OutreachProfilesComponent } from './components/sections/upa-outreach/outreach-profiles/outreach-profiles.component';
import { UpaCampaignManagerComponent } from './components/sections/upa-outreach/upa-campaign-manager/upa-campaign-manager.component';
import { OutreachComplianceComponent } from './components/sections/upa-outreach/outreach-compliance/outreach-compliance.component';

// Inspection Calendar & Performance
import { InspectionCalendarComponent } from './components/sections/inspection-calendar/inspection-calendar.component';
import { InspectionPerformanceComponent } from './components/sections/inspection-performance/inspection-performance.component';
import { RevenueIntelligenceComponent } from './components/sections/revenue-intelligence/revenue-intelligence.component';
import { AgentPerformanceComponent } from './components/sections/agent-performance/agent-performance.component';
import { ClaimFileManagerComponent } from './components/sections/claim-file-manager/claim-file-manager.component';
import { ClaimIntakeComponent } from './components/sections/claim-intake/claim-intake.component';
import { GlobalCommandCenterComponent } from './components/sections/global-command-center/global-command-center.component';
import { StormImpactTargetingComponent } from './components/sections/storm-impact-targeting/storm-impact-targeting.component';

// Voice Outreach components
import { VoiceOutreachDashboardComponent } from './components/sections/voice-outreach/voice-outreach-dashboard/voice-outreach-dashboard.component';
import { VoiceOutreachDetailComponent } from './components/sections/voice-outreach/voice-outreach-detail/voice-outreach-detail.component';
import { InitiateCallDialogComponent } from './components/sections/voice-outreach/initiate-call-dialog/initiate-call-dialog.component';
import { RecordOutcomeDialogComponent } from './components/sections/voice-outreach/record-outcome-dialog/record-outcome-dialog.component';

// Voice Campaign components
import { VoiceCampaignDashboardComponent } from './components/sections/voice-campaigns/voice-campaign-dashboard/voice-campaign-dashboard.component';
import { VoiceCampaignBuilderComponent } from './components/sections/voice-campaigns/voice-campaign-builder/voice-campaign-builder.component';
import { VoiceCallLogsComponent } from './components/sections/voice-campaigns/voice-call-logs/voice-call-logs.component';
import { VoiceTranscriptViewerComponent } from './components/sections/voice-campaigns/voice-transcript-viewer/voice-transcript-viewer.component';
import { VoiceUsageTrackerComponent } from './components/sections/voice-campaigns/voice-usage-tracker/voice-usage-tracker.component';
import { VoiceLeadSelectorDialogComponent } from './components/sections/voice-campaigns/voice-lead-selector-dialog/voice-lead-selector-dialog.component';
import { VoiceCampaignDetailComponent } from './components/sections/voice-campaigns/voice-campaign-detail/voice-campaign-detail.component';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog/confirm-dialog.component';
import { PhoneFormatPipe } from './shared/pipes/phone-format.pipe';
import { DurationFormatPipe } from './shared/pipes/duration-format.pipe';
import { ClaimOpportunityDashboardComponent } from './components/sections/claim-opportunity-dashboard/claim-opportunity-dashboard.component';
import { LeadIntelligenceComponent } from './components/sections/lead-intelligence/lead-intelligence.component';
import { SalesAiComponent } from './components/sections/sales-ai/sales-ai.component';
import { LeadRotationEngineComponent } from './components/sections/lead-rotation-engine/lead-rotation-engine.component';

// AI Intake Assistant components
import { AiIntakeChatComponent } from './components/sections/ai-intake/ai-intake-chat/ai-intake-chat.component';
import { AiIntakeDashboardComponent } from './components/sections/ai-intake/ai-intake-dashboard/ai-intake-dashboard.component';
import { NewlineToBreakPipe } from './shared/pipes/newline-to-break.pipe';

// AI Sales Agent components
import { SalesAgentDashboardComponent } from './components/sections/ai-sales-agent/sales-agent-dashboard/sales-agent-dashboard.component';
import { AiConversationEngineComponent } from './components/sections/ai-sales-agent/ai-conversation-engine/ai-conversation-engine.component';
import { AppointmentSchedulingComponent } from './components/sections/ai-sales-agent/appointment-scheduling/appointment-scheduling.component';
import { IntakeLauncherComponent } from './components/sections/ai-sales-agent/intake-launcher/intake-launcher.component';
import { SalesScriptManagerComponent } from './components/sections/ai-sales-agent/sales-script-manager/sales-script-manager.component';
import { SalesKpiDashboardComponent } from './components/sections/ai-sales-agent/sales-kpi-dashboard/sales-kpi-dashboard.component';

// Voice Outreach Agent components
import { VoiceCampaignManagerComponent } from './components/sections/voice-outreach-agent/voice-campaign-manager/voice-campaign-manager.component';
import { AiVoiceCallEngineComponent } from './components/sections/voice-outreach-agent/ai-voice-call-engine/ai-voice-call-engine.component';
import { CallResultClassifierComponent } from './components/sections/voice-outreach-agent/call-result-classifier/call-result-classifier.component';
import { AutoLeadRoutingComponent } from './components/sections/voice-outreach-agent/auto-lead-routing/auto-lead-routing.component';
import { VoiceCallDashboardComponent } from './components/sections/voice-outreach-agent/voice-call-dashboard/voice-call-dashboard.component';
import { CallTimelineViewerComponent } from './components/sections/voice-outreach-agent/call-timeline-viewer/call-timeline-viewer.component';

// Client Portal components
import { ClientPortalComponent } from './components/sections/client-portal/client-portal.component';
import { CpClaimOverviewComponent } from './components/sections/client-portal/cp-claim-overview/cp-claim-overview.component';
import { CpDocumentsComponent } from './components/sections/client-portal/cp-documents/cp-documents.component';
import { CpPaymentsComponent } from './components/sections/client-portal/cp-payments/cp-payments.component';
import { CpMessagesComponent } from './components/sections/client-portal/cp-messages/cp-messages.component';
import { CpReportsComponent } from './components/sections/client-portal/cp-reports/cp-reports.component';
import { CpNotificationsComponent } from './components/sections/client-portal/cp-notifications/cp-notifications.component';
import { RemoteInspectionCaptureComponent } from './components/sections/remote-inspection-capture/remote-inspection-capture.component';
import { ClaimSpecialistComponent } from './components/sections/claim-specialist/claim-specialist.component';
import { VoiceSecretarySettingsComponent } from './components/sections/voice-secretary-settings/voice-secretary-settings.component';
import { AgreementSigningComponent } from './components/sections/agreement-signing/agreement-signing.component';
import { AgreementDashboardComponent } from './components/sections/agreement-dashboard/agreement-dashboard.component';
import { RevenueDashboardComponent } from './components/sections/revenue-dashboard/revenue-dashboard.component';

// Client Portal (standalone)
import { ClientLandingComponent } from './components/my-claim/landing/client-landing.component';
import { MyClaimLoginComponent } from './components/my-claim/login/my-claim-login.component';
import { MyClaimShellComponent } from './components/my-claim/shell/my-claim-shell.component';
import { MyClaimDashboardComponent } from './components/my-claim/dashboard/my-claim-dashboard.component';

// ARIA Guide Assistant
import { AriaGuideWidgetComponent } from './components/aria-guide-widget/aria-guide-widget.component';


export function tokenGetter() {
  return localStorage.getItem('access_token'); // Adjust based on your token storage
}

@NgModule({
  declarations: [
    AppComponent,
    FileSizePipe,
    LoginComponent,
    SharedFilesComponent,
    DashboardComponent,
    CommandCenterIntroComponent,
    ApplicationComponent,
    SidebarComponent,
    UsersComponent,
    PasswordChangeDialogComponent,
    UserDetailsDialogComponent,
    RecruitsHierarchyDialogComponent,
    RegistrationComponent,
    ForgottenPasswordDialogComponent,
    PasswordResetComponent,
    RolesComponent,
    HomeComponent,
    RoleDetailsDialogComponent,
    ProfileComponent,
    HeaderComponent,
    FooterComponent,
    AutocompleteOffDirective,
    ForgotPasswordComponent,
    ResourcesComponent,
    ResourceComponent,
    AssistantComponent,
    TagsComponent,
    Leads,
    CreateLeadComponent,
    LeadComponent,
    FollowupDialogComponent,
    LeadDetailsDialogComponent,
    ClientsComponent,
    LeadDocumentsDialogComponent,
    LeadTasksDialogComponent,
    RecordResultDialogComponent,
    ClientConversionDialogComponent,
    ClientComponent,
    ClientDetailsDialogComponent,
    LeadCommentsDialogComponent,
    SourceItemCardComponent,
    SourceItemDialogComponent,
    ClientCommentsDialogComponent,
    ClientTasksDialogComponent,
    ClientFilesDialogComponent,
    ClaimDialogComponent,
    TaskListComponent,
    CreateTaskComponent,
    ScheduleListComponent,
    CreateScheduleComponent,
    FileDialogComponent,
    TagDialogComponent,
    SelectComponent,
    TasksComponent,
    ImportLeadsDialogComponent,
    SearchFieldComponent,
    SourcesAdminComponent,
    TasksComponent,
    SourcesAgentComponent,
    SourceItemPageComponent,
    LearnComponent,
    SignComponent,
    AdjustComponent,
    ImportantLinksComponent,
    BusinessDocsAdminComponent,
    BusinessDocsComponent,
    ClaimComponent,
    CreateuserTaskComponent,
    UserTaskListComponent,
    ClaimsComponent,
    ClaimTasksDialogComponent,
    ClaimFilesDialogComponent,
    ClaimCommentsDialogComponent,
    AgentDashboardComponent,
    EarningsTabComponent,
    FinancialDetailDialogComponent,
    CommissionStatementDialogComponent,
    CommissionsAdminViewComponent,
    CreateClientTaskComponent,
    UserClientListComponent,
    NewslettersComponent,
    NewsletterDialogComponent,
    AnnouncementsComponent,
    AnnouncementDialogComponent,
    ClaimLedgerComponent,
    ClaimLedgerDialogComponent,
    PermissionsComponent,
    PermissionDialogComponent,
    RolePermissionsComponent,
    TerritoriesComponent,
    TerritoryDetailsDialogComponent,
    TerritoryAssignDialogComponent,
    TerritoryMapComponent,
    PoliciesComponent,
    PoliciesDialogComponent,
    RolePermissionsDialogComponent,
    AdvancedSearchComponent,
    SearchComponent,
    ImportClientsDialogComponent,
    ImportClaimsDialogComponent,
    ClaimBulkfilesDialogComponent,
    ViewDocumentDialogComponent,
    ClientBulkFilesDialogComponent,
    ClaimDetailsDialogComponent,
    LeadsEditDialogComponent,
    ReleaseNotesComponent,
    TemplatesComponent,
    TemplateDetailsDialogComponent,
    TemplatesDialogComponent,
    ClaimSearchComponent,
    ClientSearchComponent,
    LeadSearchComponent,
    PhoneNumberFormatPipe,
    PaginatorComponent,
    ClaimFilesShareDialogComponent,
    PortalFeatureComponent,
    RecruitsAdminComponent,
    RecruitsHierarchyDialogComponent,
    NgOrganizationChartComponent,
    NgOrganizationChartListComponent,
    NgOrganizationChartNodeComponent,
    CommissionSimulatorComponent,
    CommissionBreakdownDialogComponent,
    CommissionResultPanelComponent,
    TeamStructureDialogComponent,
    BasicCommissionCalculatorComponent,
    MyCommissionComponent,
    TitleChangeComponent,
    ClaimFilesShareDialogComponent,
    CustomerClaimComponent,
    ProductListComponent,
    OrderListComponent,
    CategoryListComponent,
    CartComponent,
    DigitalHubComponent,
    OrderHistoryComponent,
    CategoryDetailsDialogComponent,
    ProductDetailsDialogComponent,
    AccountListComponent,
    AccountDetailsDialogComponent,
    OrderDetailsDialogComponent,
    OrderDetailsManagementDialogComponent,
    TopbarComponent,
    TaskBoardComponent,
    ClaimTaskBoardComponent,
    CollaboratorsDialogComponent,
    UserDashboardComponent,
    ClaimPaymentReportComponent,
    ClientSidebarComponent,
    CustomerDashboardComponent,
    CustomerClaimsComponent,
    MyRecruitsComponent,
    TeamMgrOverrideGraphComponentComponent,
    MyPersonalDocsDialogComponent,
    ClickOutsideDirective,
    FireIncidentsComponent,
    FireIncidentsListComponent,
    FireIncidentsMapComponent,
    FireAgenciesDialogComponent,
    FireDataSourcesDialogComponent,
    ConvertToLeadDialogComponent,
    PropertyIntelligencePanelComponent,
    ResponseDeskComponent,
    CommunicationsHubComponent,
    StormIntelligenceComponent,
    RoofIntelligenceComponent,
    PotentialClaimsComponent,
    CrimeClaimsIntelligenceComponent,
    IncidentIntelligenceComponent,
    CallTypeConfigsComponent,
    CommandPaletteComponent,
    EstimatingListComponent,
    EstimatingDetailComponent,
    PricingAdminComponent,
    PricingVersionDialogComponent,
    PricingImportDialogComponent,
    FireClaimsComponent,
    FireClaimListComponent,
    FireClaimFormComponent,
    FireClaimSummaryComponent,
    PublicLayoutComponent,
    LandingPageComponent,
    FeaturesPageComponent,
    AppPreviewPageComponent,
    RecruitmentMapComponent,
    TerritoryApplyDialogComponent,
    ClaimFairnessComponent,
    AdvocacyScriptsComponent,
    DisasterResourcesComponent,
    TerritoryControlPanelComponent,
    TerritoryControlEditDialogComponent,
    LeadDistributionComponent,
    LeadIntakeComponent,
    DistributeLeadDialogComponent,
    CommandBarComponent,
    LiveActivityPanelComponent,
    MagicLinkCallbackComponent,
    PasskeyRegisterDialogComponent,
    EscalationAdminComponent,
    IntakeControlComponent,
    AgentSetupWizardComponent,
    AdjusterCaseListComponent,
    AdjusterCaseDetailComponent,
    PolicyVaultListComponent,
    PolicyVaultDetailComponent,
    PolicySectionInlineComponent,
    PolicyVaultAttachDialogComponent,
    CommunityAdvocateComponent,
    CaOverviewComponent,
    CaAdvocateProfilesComponent,
    CaTerritoryAudienceComponent,
    CaCampaignBuilderComponent,
    CaOutreachChannelsComponent,
    CaCommunityPagesComponent,
    CaPartnerOffersComponent,
    CaEducationLibraryComponent,
    CaSocialAdStudioComponent,
    CaAutomationsComponent,
    CaAnalyticsComponent,
    CaComplianceComponent,
    LineItemDialogComponent,
    CarrierPasteDialogComponent,
    CarrierPreviewDialogComponent,
    SupplementEmailDialogComponent,
    ClaimRecoveryComponent,
    ClaimWorkflowQueuesComponent,
    ClaimRecoveryTabComponent,
    SalesDashboardComponent,
    SalesClaimsComponent,
    RotationLeadListComponent,
    RotationLeadDetailComponent,
    RotationConfigComponent,
    RotationMetricsComponent,
    SkipTraceWalletComponent,
    OutreachCampaignsComponent,
    MessageTemplatesComponent,
    OutreachDashboardComponent,
    OutreachCampaignsEngineComponent,
    OutreachTemplatesComponent,
    OutreachConversationsComponent,
    OutreachProfilesComponent,
    UpaCampaignManagerComponent,
    OutreachComplianceComponent,
    CampaignBuilderComponent,
    InspectionCalendarComponent,
    InspectionPerformanceComponent,
    RevenueIntelligenceComponent,
    AgentPerformanceComponent,
    ClaimFileManagerComponent,
    ClaimIntakeComponent,
    GlobalCommandCenterComponent,
    StormImpactTargetingComponent,
    VoiceOutreachDashboardComponent,
    VoiceOutreachDetailComponent,
    InitiateCallDialogComponent,
    RecordOutcomeDialogComponent,
    VoiceCampaignDashboardComponent,
    VoiceCampaignBuilderComponent,
    VoiceCallLogsComponent,
    VoiceTranscriptViewerComponent,
    VoiceUsageTrackerComponent,
    VoiceLeadSelectorDialogComponent,
    VoiceCampaignDetailComponent,
    ConfirmDialogComponent,
    PhoneFormatPipe,
    DurationFormatPipe,
    ClaimOpportunityDashboardComponent,
    LeadIntelligenceComponent,
    SalesAiComponent,
    LeadRotationEngineComponent,
    ClientPortalComponent,
    RemoteInspectionCaptureComponent,
    ClaimSpecialistComponent,
    VoiceSecretarySettingsComponent,
    AgreementSigningComponent,
    AgreementDashboardComponent,
    RevenueDashboardComponent,
    CpClaimOverviewComponent,
    CpDocumentsComponent,
    CpPaymentsComponent,
    CpMessagesComponent,
    CpReportsComponent,
    CpNotificationsComponent,
    AiIntakeChatComponent,
    AiIntakeDashboardComponent,
    NewlineToBreakPipe,
    SalesAgentDashboardComponent,
    AiConversationEngineComponent,
    AppointmentSchedulingComponent,
    IntakeLauncherComponent,
    SalesScriptManagerComponent,
    SalesKpiDashboardComponent,
    VoiceCampaignManagerComponent,
    AiVoiceCallEngineComponent,
    CallResultClassifierComponent,
    AutoLeadRoutingComponent,
    VoiceCallDashboardComponent,
    CallTimelineViewerComponent,
    ClientLandingComponent,
    MyClaimLoginComponent,
    MyClaimShellComponent,
    MyClaimDashboardComponent,
    AriaGuideWidgetComponent,
  ],
  exports: [MatDatepickerModule, MatNativeDateModule, ClickOutsideDirective],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA], imports: [TimeFilterComponent, NgxChartsModule, ServiceWorkerModule.register("ngsw-worker.js", {
    enabled: environment.production,
    registrationStrategy: "registerWithDelay:10000",
  }),
    JsonPipe,
    NgbDatepickerModule,
    NgbAlertModule,
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableExporterModule,
    // Material
    BrowserAnimationsModule,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatIconModule,
    MatSidenavModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDialogModule,
    MatSelectModule,
    MatTreeModule,
    MatMenuModule,
    MatDividerModule,
    MatTableModule,
    MatSortModule,
    MatTabsModule,
    MatSlideToggleModule,
    MatChipsModule,
    MatGridListModule,
    MatSnackBarModule,
    MatExpansionModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatMomentDateModule,
    MatRadioModule,
    MatCheckboxModule,
    MatPaginatorModule,
    MatStepperModule,
    MatListModule,
    MatToolbarModule,
    MatFormFieldModule,
    NgbPopoverModule,
    MatBadgeModule,
    MatAutocompleteModule,
    MatButtonToggleModule,
    // Ngx Charts
    DragDropModule,
    // Ngx ECharts
    // Leaflet
    LeafletModule,
    // Google Maps
    GoogleMapsModule,
    // Moment
    MomentModule,
  // Authentication
  JwtModule.forRoot({
    config: {
      tokenGetter: tokenGetter,
      allowedDomains: environment.jwtAllowedDomains,
    },
  }),
  // Specify your library as an import
  NgxPermissionsModule.forRoot(),
  NgxMaskModule.forRoot(),
    NgbModule,
    NgbAccordionModule,
    NgxSpinnerModule,
    AngularEditorModule,
    NgxDocViewerModule], providers: [
      { provide: LOCALE_ID, useValue: "en-US" },
      { provide: HTTP_INTERCEPTORS, useClass: TwilioKillSwitchInterceptor, multi: true },
      { provide: HTTP_INTERCEPTORS, useClass: ApiInterceptor, multi: true },
      { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
      { provide: MAT_DATE_LOCALE, useValue: "en-US" },
      AuthService,
      TasksService,
      SchedulesService,
      AuthGuard,
      UpdateService,
      provideHttpClient(withInterceptorsFromDi()),
    ]
})
export class AppModule { }

export function jwtTokenGetter() {
  return localStorage.getItem("access_token");
}
