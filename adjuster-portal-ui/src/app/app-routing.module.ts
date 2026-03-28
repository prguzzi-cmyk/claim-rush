import { PasswordResetComponent } from "./components/sections/users/password-reset/password-reset.component";
import { NgModule } from "@angular/core";
import { Routes, RouterModule } from "@angular/router";
import { LoginComponent } from "./components/login/login.component";
import { AuthGuard } from "./guards/auth.guard";
import { ApplicationComponent } from "./components/application.component";
import { DashboardComponent } from "./components/sections/dashboard/dashboard.component";
import { UsersComponent } from "./components/sections/users/users.component";
import { RegistrationComponent } from "./components/sections/users/registration/registration.component";
import { RolesComponent } from "./components/sections/roles/roles.component";
import { ProfileComponent } from "./components/sections/profile/profile.component";
import { ForgotPasswordComponent } from "./components/forgot-password/forgot-password.component";
import { Leads } from "./components/sections/leads/leads/leads.component";
import { CreateLeadComponent } from "./components/sections/leads/create-lead/create-lead.component";
import { LeadComponent } from "./components/sections/leads/lead/lead.component";
import { ClientsComponent } from "./components/sections/clients/clients.component";
import { TagsComponent } from "./components/sections/tags/tags.component";
import { ClientComponent } from "./components/sections/clients/client/client.component";
import { ResourcesComponent } from "./components/sections/resources/resources.component";
import { BusinessDocsComponent } from "./components/sections/resources/business-docs/business-docs.component";
import { AssistantComponent } from "./components/sections/resources/assistant/assistant.component";
import { SourcesAgentComponent } from "./components/sections/resources/sources-agent/sources-agent.component";
import { SourceItemPageComponent } from "./components/sections/resources/sources-agent/source-item-page/source-item-page.component";
import { LearnComponent } from "./components/sections/resources/learn/learn.component";
import { AdjustComponent } from "./components/sections/resources/adjust/adjust.component";
import { ImportantLinksComponent } from "./components/sections/resources/important-links/important-links.component";
import { SourcesAdminComponent } from "./components/sections/resources/sources-admin/sources-admin.component";
import { TasksComponent } from "./components/sections/tasks/tasks/tasks.component";
import { CreateTaskComponent } from "./components/sections/tasks/create-task/create-task.component";
import { TaskListComponent } from "./components/sections/tasks/task-list/task-list.component";
import { CreateScheduleComponent } from "./components/sections/schedules/create-schedule/create-schedule.component";
import { ScheduleListComponent } from "./components/sections/schedules/schedule-list/schedule-list.component";
import { ClaimComponent } from "./components/sections/claims/claim/claim.component";
import { UserTaskListComponent } from "./components/sections/user-task/user-task-list/user-task-list.component";
import { CreateuserTaskComponent } from "./components/sections/user-task/create-user-task/create-user-task.component";
import { SignComponent } from "./components/sections/resources/sign/sign.component";
import { ClaimsComponent } from "./components/sections/claims/claims/claims.component";
import { AgentDashboardComponent } from "./components/sections/agent-dashboard/agent-dashboard.component";
import { SidebarComponent } from "./components/layout/sidebar/sidebar.component";
import { NewslettersComponent } from "./components/sections/newsletters/newsletters.component";
import { AnnouncementsComponent } from "./components/sections/announcements/announcements.component";
import { PermissionsComponent } from "./components/sections/permissions/permissions.component";
import { RolePermissionsComponent } from "./components/sections/role-permissions/role-permissions.component";
import { TerritoriesComponent } from "./components/sections/territories/territories.component";
import { PoliciesComponent } from "./components/sections/policies/policies.component";
import { SearchComponent } from "./components/sections/search/search.component";
import { AdvancedSearchComponent } from "./components/sections/advanced-search/advanced-search.component";
import { ReleaseNotesComponent } from "./components/sections/release-notes/release-notes.component";
import { TemplatesComponent } from "./components/sections/templates/templates.component";
import { ClaimSearchComponent } from "./components/sections/claims/claim-search/claim-search.component";
import { LeadSearchComponent } from "./components/sections/leads/lead-search/lead-search.component";
import { ClientSearchComponent } from "./components/sections/clients/client-search/client-search.component";
import {RecruitsAdminComponent} from "./components/sections/recruits-admin/recruits-admin.component";
import { SharedFilesComponent } from "./components/shared-files/shared-files.component";
import {BasicCommissionCalculatorComponent} from "./components/sections/basic-commission-calculator/basic-commission-calculator.component";
import {MyCommissionComponent} from "./components/sections/claims/my-commission/my-commission.component";
import {TitleChangeComponent} from "./components/sections/title-change/title-change.component";
import { OrderListComponent } from "./components/sections/shop-management/order-list/order-list.component";
import { CategoryListComponent } from "./components/sections/shop-management/category-list/category-list.component";
import { ProductListComponent } from "./components/sections/shop-management/product-list/product-list.component";
import { CartComponent } from "./components/sections/shop/cart/cart.component";
import { DigitalHubComponent } from "./components/sections/shop/digital-hub/digital-hub.component";
import { OrderHistoryComponent } from "./components/sections/shop/order-history/order-history.component";
import { AccountListComponent } from "./components/sections/shop-management/account-list/account-list.component";
import { TaskBoardComponent } from "./components/sections/task-board/task-board.component";
import { UserDashboardComponent } from "./components/sections/dashboard/user-dashboard/user-dashboard.component";
import { ClaimPaymentReportComponent } from "./components/sections/claims/claim-payment-report/claim-payment-report.component";
import { CustomerDashboardComponent } from "./components/sections/customer-dashboard/customer-dashboard.component";
import { CustomerClaimComponent } from "./components/sections/claims/customer-claim/customer-claim.component";
import {MyRecruitsComponent} from "./components/sections/my-recruits/my-recruits.component";
import {FireIncidentsComponent} from "./components/sections/fire-incidents/fire-incidents.component";
import {StormIntelligenceComponent} from "./components/sections/storm-intelligence/storm-intelligence.component";
import {RoofIntelligenceComponent} from "./components/sections/roof-intelligence/roof-intelligence.component";
import {PotentialClaimsComponent} from "./components/sections/potential-claims/potential-claims.component";
import {IncidentIntelligenceComponent} from "./components/sections/incident-intelligence/incident-intelligence.component";
import {CommissionAdminComponent} from "./components/sections/commission-admin/commission-admin.component";
import {CustomerClaimsComponent} from "./components/sections/claims/customer-claims/customer-claims.component";
import {EstimatingListComponent} from "./components/sections/estimating/estimating-list/estimating-list.component";
import {EstimatingDetailComponent} from "./components/sections/estimating/estimating-detail/estimating-detail.component";
import {PricingAdminComponent} from "./components/sections/pricing-admin/pricing-admin.component";
import {FireClaimListComponent} from "./components/sections/fire-claims/fire-claim-list/fire-claim-list.component";
import {FireClaimFormComponent} from "./components/sections/fire-claims/fire-claim-form/fire-claim-form.component";
import {FireClaimSummaryComponent} from "./components/sections/fire-claims/fire-claim-summary/fire-claim-summary.component";
import {TerritoryControlPanelComponent} from "./components/sections/territory-control-panel/territory-control-panel.component";
import {LeadDistributionComponent} from "./components/sections/lead-distribution/lead-distribution.component";
import {LeadIntakeComponent} from "./components/sections/lead-intake/lead-intake.component";
import {CrimeClaimsIntelligenceComponent} from "./components/sections/crime-claims-intelligence/crime-claims-intelligence.component";
import {EscalationAdminComponent} from "./components/sections/escalation-admin/escalation-admin.component";
import {IntakeControlComponent} from "./components/sections/intake-control/intake-control.component";
import {AgentSetupWizardComponent} from "./components/sections/agent-setup-wizard/agent-setup-wizard.component";
import { MagicLinkCallbackComponent } from "./components/auth/magic-link-callback/magic-link-callback.component";
import { AdjusterCaseListComponent } from "./components/sections/adjuster-assistant/adjuster-case-list/adjuster-case-list.component";
import { AdjusterCaseDetailComponent } from "./components/sections/adjuster-assistant/adjuster-case-detail/adjuster-case-detail.component";
import { PolicyVaultListComponent } from "./components/sections/policy-vault/policy-vault-list/policy-vault-list.component";
import { PolicyVaultDetailComponent } from "./components/sections/policy-vault/policy-vault-detail/policy-vault-detail.component";
import { ResponseDeskComponent } from "./components/sections/response-desk/response-desk.component";
import { CommunicationsHubComponent } from "./components/sections/communications-hub/communications-hub.component";
import { ClaimRecoveryComponent } from "./components/sections/claim-recovery/claim-recovery.component";
import { ClaimWorkflowQueuesComponent } from "./components/sections/claim-workflow-queues/claim-workflow-queues.component";
import { SalesDashboardComponent } from "./components/sections/sales-dashboard/sales-dashboard.component";
import { SalesClaimsComponent } from "./components/sections/sales-claims/sales-claims.component";
import { RotationLeadListComponent } from "./components/sections/rotation-leads/rotation-lead-list/rotation-lead-list.component";
import { RotationLeadDetailComponent } from "./components/sections/rotation-leads/rotation-lead-detail/rotation-lead-detail.component";
import { RotationConfigComponent } from "./components/sections/rotation-leads/rotation-config/rotation-config.component";
import { RotationMetricsComponent } from "./components/sections/rotation-leads/rotation-metrics/rotation-metrics.component";
import { SkipTraceWalletComponent } from "./components/sections/skip-trace-wallet/skip-trace-wallet.component";
import { OutreachCampaignsComponent } from "./components/sections/outreach-campaigns/outreach-campaigns.component";
import { MessageTemplatesComponent } from "./components/sections/message-templates/message-templates.component";
import { OutreachDashboardComponent } from "./components/sections/outreach/outreach-dashboard/outreach-dashboard.component";
import { OutreachCampaignsComponent as OutreachCampaignsEngineComponent } from "./components/sections/outreach/outreach-campaigns/outreach-campaigns.component";
import { OutreachTemplatesComponent } from "./components/sections/outreach/outreach-templates/outreach-templates.component";
import { OutreachConversationsComponent } from "./components/sections/outreach/outreach-conversations/outreach-conversations.component";
import { InspectionCalendarComponent } from "./components/sections/inspection-calendar/inspection-calendar.component";

import { InspectionPerformanceComponent } from "./components/sections/inspection-performance/inspection-performance.component";
import { RevenueIntelligenceComponent } from "./components/sections/revenue-intelligence/revenue-intelligence.component";
import { AgentPerformanceComponent } from "./components/sections/agent-performance/agent-performance.component";
import { ClaimFileManagerComponent } from "./components/sections/claim-file-manager/claim-file-manager.component";
import { ClaimIntakeComponent } from "./components/sections/claim-intake/claim-intake.component";
import { GlobalCommandCenterComponent } from "./components/sections/global-command-center/global-command-center.component";
import { StormImpactTargetingComponent } from "./components/sections/storm-impact-targeting/storm-impact-targeting.component";
import { ClaimOpportunityDashboardComponent } from "./components/sections/claim-opportunity-dashboard/claim-opportunity-dashboard.component";
import { VoiceOutreachDashboardComponent } from "./components/sections/voice-outreach/voice-outreach-dashboard/voice-outreach-dashboard.component";
import { VoiceOutreachDetailComponent } from "./components/sections/voice-outreach/voice-outreach-detail/voice-outreach-detail.component";

// Campaign Builder
import { CampaignBuilderComponent } from "./components/sections/outreach/campaign-builder/campaign-builder.component";

// UPA → ACI Outreach Funnel
import { OutreachProfilesComponent } from "./components/sections/upa-outreach/outreach-profiles/outreach-profiles.component";
import { UpaCampaignManagerComponent } from "./components/sections/upa-outreach/upa-campaign-manager/upa-campaign-manager.component";
import { OutreachComplianceComponent } from "./components/sections/upa-outreach/outreach-compliance/outreach-compliance.component";

// Voice Campaign components
import { VoiceCampaignDashboardComponent } from "./components/sections/voice-campaigns/voice-campaign-dashboard/voice-campaign-dashboard.component";
import { VoiceCampaignBuilderComponent } from "./components/sections/voice-campaigns/voice-campaign-builder/voice-campaign-builder.component";
import { VoiceCallLogsComponent } from "./components/sections/voice-campaigns/voice-call-logs/voice-call-logs.component";
import { VoiceTranscriptViewerComponent } from "./components/sections/voice-campaigns/voice-transcript-viewer/voice-transcript-viewer.component";
import { VoiceUsageTrackerComponent } from "./components/sections/voice-campaigns/voice-usage-tracker/voice-usage-tracker.component";
import { VoiceCampaignDetailComponent } from "./components/sections/voice-campaigns/voice-campaign-detail/voice-campaign-detail.component";

// Public pages
import { PublicLayoutComponent } from "./components/public/public-layout/public-layout.component";
import { LandingPageComponent } from "./components/public/landing-page/landing-page.component";
import { FeaturesPageComponent } from "./components/public/features-page/features-page.component";
import { AppPreviewPageComponent } from "./components/public/app-preview-page/app-preview-page.component";
import { RecruitmentMapComponent } from "./components/public/recruitment-map/recruitment-map.component";

// Advocacy components
import { ClaimFairnessComponent } from "./components/sections/advocacy/claim-fairness/claim-fairness.component";
import { AdvocacyScriptsComponent } from "./components/sections/advocacy/advocacy-scripts/advocacy-scripts.component";
import { DisasterResourcesComponent } from "./components/sections/advocacy/disaster-resources/disaster-resources.component";
import { CommunityAdvocateComponent } from "./components/sections/community-advocate/community-advocate.component";
import { LeadIntelligenceComponent } from "./components/sections/lead-intelligence/lead-intelligence.component";
import { SalesAiComponent } from "./components/sections/sales-ai/sales-ai.component";
import { LeadRotationEngineComponent } from "./components/sections/lead-rotation-engine/lead-rotation-engine.component";
import { ClientPortalComponent } from "./components/sections/client-portal/client-portal.component";
import { RemoteInspectionCaptureComponent } from "./components/sections/remote-inspection-capture/remote-inspection-capture.component";
import { ClaimSpecialistComponent } from "./components/sections/claim-specialist/claim-specialist.component";
import { VoiceSecretarySettingsComponent } from "./components/sections/voice-secretary-settings/voice-secretary-settings.component";
import { AgreementSigningComponent } from "./components/sections/agreement-signing/agreement-signing.component";
import { AgreementDashboardComponent } from "./components/sections/agreement-dashboard/agreement-dashboard.component";
import { RevenueDashboardComponent } from "./components/sections/revenue-dashboard/revenue-dashboard.component";

// AI Intake Assistant
import { AiIntakeChatComponent } from "./components/sections/ai-intake/ai-intake-chat/ai-intake-chat.component";
import { AiIntakeDashboardComponent } from "./components/sections/ai-intake/ai-intake-dashboard/ai-intake-dashboard.component";

// Voice Outreach Agent
import { VoiceCallDashboardComponent } from "./components/sections/voice-outreach-agent/voice-call-dashboard/voice-call-dashboard.component";
import { VoiceCampaignManagerComponent } from "./components/sections/voice-outreach-agent/voice-campaign-manager/voice-campaign-manager.component";
import { AiVoiceCallEngineComponent } from "./components/sections/voice-outreach-agent/ai-voice-call-engine/ai-voice-call-engine.component";
import { CallResultClassifierComponent } from "./components/sections/voice-outreach-agent/call-result-classifier/call-result-classifier.component";
import { AutoLeadRoutingComponent } from "./components/sections/voice-outreach-agent/auto-lead-routing/auto-lead-routing.component";
import { CallTimelineViewerComponent } from "./components/sections/voice-outreach-agent/call-timeline-viewer/call-timeline-viewer.component";

// AI Sales Agent
import { SalesAgentDashboardComponent } from "./components/sections/ai-sales-agent/sales-agent-dashboard/sales-agent-dashboard.component";
import { AiConversationEngineComponent } from "./components/sections/ai-sales-agent/ai-conversation-engine/ai-conversation-engine.component";
import { AppointmentSchedulingComponent } from "./components/sections/ai-sales-agent/appointment-scheduling/appointment-scheduling.component";
import { IntakeLauncherComponent } from "./components/sections/ai-sales-agent/intake-launcher/intake-launcher.component";
import { SalesScriptManagerComponent } from "./components/sections/ai-sales-agent/sales-script-manager/sales-script-manager.component";
import { SalesKpiDashboardComponent } from "./components/sections/ai-sales-agent/sales-kpi-dashboard/sales-kpi-dashboard.component";

// Client Portal (standalone)
import { ClientLandingComponent } from "./components/my-claim/landing/client-landing.component";
import { MyClaimLoginComponent } from "./components/my-claim/login/my-claim-login.component";
import { MyClaimShellComponent } from "./components/my-claim/shell/my-claim-shell.component";
import { MyClaimDashboardComponent } from "./components/my-claim/dashboard/my-claim-dashboard.component";
import { ClientGuard } from "./guards/client.guard";

const routes: Routes = [
  // Public marketing pages
  {
    path: "",
    component: PublicLayoutComponent,
    children: [
      { path: "", component: LandingPageComponent },
      { path: "features", component: FeaturesPageComponent },
      { path: "app-preview", component: AppPreviewPageComponent },
      { path: "territories", component: RecruitmentMapComponent },
    ],
  },

  // Authenticated application routes under /app
  {
    path: "app",
    component: ApplicationComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: "dashboard",
        component: DashboardComponent,
      },
      {
        path: "agent-dashboard",
        component: AgentDashboardComponent,
      },
      {
        path: "customer-dashboard",
        component: CustomerDashboardComponent,
      },
      {
        path: "user-dashboard",
        component: UserDashboardComponent,
      },
      {
        path: "sidebar",
        component: SidebarComponent,
      },
      {
        path: "resources",
        component: ResourcesComponent,
      },
      { path: "usertask/create", component: CreateuserTaskComponent },
      { path: "usertask/usertask-list", component: TaskBoardComponent },

      {
        path: "resources/business-documents",
        component: BusinessDocsComponent,
      },
      {
        path: "resources/assistant",
        component: AssistantComponent,
      },
      {
        path: "resources/sources",
        component: SourcesAgentComponent,
      },
      { path: "resources/sources/:id", component: SourceItemPageComponent },
      {
        path: "resources/learn",
        component: LearnComponent,
      },
      {
        path: "resources/sign",
        redirectTo: "agreements",
        pathMatch: "full",
      },
      {
        path: "resources/adjust",
        component: AdjustComponent,
      },
      {
        path: "resources/important-links",
        component: ImportantLinksComponent,
      },
      {
        path: "shop/digital-hub",
        component: DigitalHubComponent,
      },
      {
        path: "shop/cart",
        component: CartComponent,
      },
      {
        path: "shop/order-history",
        component: OrderHistoryComponent,
      },

      { path: "leads", component: Leads },
      { path: "leads/create", component: CreateLeadComponent },
      { path: "leads/create/:id", component: CreateLeadComponent },
      { path: "leads/search", component: LeadSearchComponent },
      { path: "leads/:id", component: LeadComponent },

      { path: "claims/search", component: ClaimSearchComponent },
      { path: "claims/basic-commission-calculator", component: BasicCommissionCalculatorComponent},
      { path: "commission/me", component: MyCommissionComponent },
      { path: "claim/payments-ready", component: ClaimPaymentReportComponent },
      { path: "claim/:id", component: ClaimComponent },
      { path: "users/my-recruits", component: MyRecruitsComponent },
      { path: "fire-incidents", component: FireIncidentsComponent },
      { path: "response-desk", component: ResponseDeskComponent },
      { path: "communications-hub", component: CommunicationsHubComponent },
      { path: "incident-intelligence", component: IncidentIntelligenceComponent },
      { path: "storm-intelligence", component: StormIntelligenceComponent },
      { path: "roof-intelligence", component: RoofIntelligenceComponent },
      { path: "potential-claims", component: PotentialClaimsComponent },
      { path: "crime-claims-intelligence", component: CrimeClaimsIntelligenceComponent },
      { path: "claim-recovery", component: ClaimRecoveryComponent },
      { path: "workflow-queues", component: ClaimWorkflowQueuesComponent },
      { path: "rotation-leads", component: RotationLeadListComponent },
      { path: "rotation-leads/metrics", component: RotationMetricsComponent },
      { path: "rotation-leads/:id", component: RotationLeadDetailComponent },
      { path: "estimating", component: EstimatingListComponent },
      { path: "estimating/create", component: EstimatingDetailComponent },
      { path: "estimating/:id", component: EstimatingDetailComponent },
      { path: "adjuster-assistant", component: AdjusterCaseListComponent },
      { path: "adjuster-assistant/new", component: AdjusterCaseDetailComponent },
      { path: "adjuster-assistant/:id", component: AdjusterCaseDetailComponent },
      { path: "policy-vault", component: PolicyVaultListComponent },
      { path: "policy-vault/:id", component: PolicyVaultDetailComponent },
      { path: "skip-trace-wallet", component: SkipTraceWalletComponent },
      { path: "outreach-campaigns", component: OutreachCampaignsComponent },
      { path: "message-templates", component: MessageTemplatesComponent },
      { path: "outreach", component: OutreachDashboardComponent },
      { path: "outreach/campaigns", component: OutreachCampaignsEngineComponent },
      { path: "outreach/campaigns/builder", component: CampaignBuilderComponent, canDeactivate: [(c: CampaignBuilderComponent) => c.canDeactivate()] },
      { path: "outreach/campaigns/builder/:id", component: CampaignBuilderComponent, canDeactivate: [(c: CampaignBuilderComponent) => c.canDeactivate()] },
      { path: "outreach/templates", component: OutreachTemplatesComponent },
      { path: "outreach/conversations/:leadId", component: OutreachConversationsComponent },
      // UPA → ACI Outreach Funnel
      { path: "upa-outreach/profiles", component: OutreachProfilesComponent },
      { path: "upa-outreach/campaign", component: UpaCampaignManagerComponent },
      { path: "voice-outreach", component: VoiceOutreachDashboardComponent },
      { path: "voice-outreach/:callId", component: VoiceOutreachDetailComponent },
      { path: "outreach/voice", component: VoiceCampaignDashboardComponent },
      { path: "outreach/campaigns/new", component: VoiceCampaignBuilderComponent, canDeactivate: [(c: VoiceCampaignBuilderComponent) => c.canDeactivate()] },
      { path: "outreach/call-logs", component: VoiceCallLogsComponent },
      { path: "outreach/transcripts", component: VoiceTranscriptViewerComponent },
      { path: "outreach/transcripts/:callId", component: VoiceTranscriptViewerComponent },
      { path: "outreach/campaigns/:id/detail", component: VoiceCampaignDetailComponent },
      { path: "outreach/campaigns/:id", component: VoiceCampaignBuilderComponent, canDeactivate: [(c: VoiceCampaignBuilderComponent) => c.canDeactivate()] },
      { path: "outreach/analytics", component: VoiceUsageTrackerComponent },
      { path: "inspection-calendar", component: InspectionCalendarComponent },
      { path: "inspection-performance", component: InspectionPerformanceComponent },
      { path: "revenue-intelligence", component: RevenueIntelligenceComponent },
      { path: "agent-performance", component: AgentPerformanceComponent },
      { path: "claim-file-manager", component: ClaimFileManagerComponent },
      { path: "claim-intake", component: ClaimIntakeComponent },
      { path: "global-command-center", component: GlobalCommandCenterComponent },
      { path: "dashboard/intelligence", component: GlobalCommandCenterComponent },
      { path: "dashboard/storm-impact", component: StormImpactTargetingComponent },
      { path: "claim-opportunity-dashboard", component: ClaimOpportunityDashboardComponent },
      { path: "lead-intelligence", component: LeadIntelligenceComponent },
      { path: "fire-claims", component: FireClaimListComponent },
      { path: "fire-claims/new", component: FireClaimFormComponent },
      { path: "fire-claims/:id", component: FireClaimSummaryComponent },
      { path: "advocacy/claim-fairness", component: ClaimFairnessComponent },
      { path: "advocacy/scripts", component: AdvocacyScriptsComponent },
      { path: "advocacy/disaster-resources", component: DisasterResourcesComponent },
      { path: "community-advocate", component: CommunityAdvocateComponent },
      { path: "client-portal", component: ClientPortalComponent },
      { path: "capture-property-damage", component: RemoteInspectionCaptureComponent },
      { path: "claim-specialist", component: ClaimSpecialistComponent },
      { path: "voice-secretary", component: VoiceSecretarySettingsComponent },
      { path: "agreements", component: AgreementDashboardComponent },
      { path: "revenue-dashboard", component: RevenueDashboardComponent },
      { path: "sign/:id", component: AgreementSigningComponent },
      { path: "sign", component: AgreementSigningComponent },
      { path: "claims", component: ClaimsComponent },
      { path: "customer-claims", component: CustomerClaimsComponent },
      { path: "ai-intake", component: AiIntakeChatComponent },
      { path: "ai-intake/dashboard", component: AiIntakeDashboardComponent },
      { path: "lead-rotation-engine", component: LeadRotationEngineComponent },
      { path: "sales-ai", component: SalesAiComponent },
      { path: "ai-sales-agent", component: SalesAgentDashboardComponent },
      { path: "ai-sales-agent/conversation/:id", component: AiConversationEngineComponent },
      { path: "ai-sales-agent/appointments", component: AppointmentSchedulingComponent },
      { path: "ai-sales-agent/intake-launcher", component: IntakeLauncherComponent },
      { path: "ai-sales-agent/scripts", component: SalesScriptManagerComponent },
      { path: "ai-sales-agent/kpis", component: SalesKpiDashboardComponent },
      { path: "voice-outreach-agent", component: VoiceCallDashboardComponent },
      { path: "voice-outreach-agent/campaigns", component: VoiceCampaignManagerComponent },
      { path: "voice-outreach-agent/calls", component: AiVoiceCallEngineComponent },
      { path: "voice-outreach-agent/classifier", component: CallResultClassifierComponent },
      { path: "voice-outreach-agent/routing", component: AutoLeadRoutingComponent },
      { path: "voice-outreach-agent/timeline/:id", component: CallTimelineViewerComponent },
      { path: "sales-dashboard", component: SalesDashboardComponent },
      { path: "sales-claims", component: SalesClaimsComponent },
      { path: "customer-claim/:id", component: CustomerClaimComponent },
      { path: "clients", component: ClientsComponent },
      { path: "clients/search", component: ClientSearchComponent },
      { path: "client/:id", component: ClientComponent },
      { path: "tasks", component: TasksComponent },
      { path: "tasks/create", component: CreateTaskComponent },
      { path: "tasks/task-list", component: TaskListComponent },
      { path: "schedules/create", component: CreateScheduleComponent },
      { path: "schedules/schedule-list", component: ScheduleListComponent },
      { path: "search", component: SearchComponent },
      { path: "advanced-search", component: AdvancedSearchComponent },

      {
        path: "tags",
        component: TagsComponent,
      },

      {
        path: "administration",
        children: [
          {
            path: "users",
            component: UsersComponent,
          },

          {
            path: "roles",
            component: RolesComponent,
          },

          {
            path: "role-permissions/:id",
            component: RolePermissionsComponent,
          },

          {
            path: "permissions",
            component: PermissionsComponent,
          },

          {
            path: "territories",
            component: TerritoriesComponent,
          },

          {
            path: "territory-control",
            component: TerritoryControlPanelComponent,
          },

          {
            path: "lead-distribution",
            component: LeadDistributionComponent,
          },
          {
            path: "lead-intake",
            component: LeadIntakeComponent,
          },
          {
            path: "escalation-admin",
            component: EscalationAdminComponent,
          },
          {
            path: "pricing-admin",
            component: PricingAdminComponent,
          },
          {
            path: "rotation-config",
            component: RotationConfigComponent,
          },
          {
            path: "intake-control",
            component: IntakeControlComponent,
          },
          {
            path: "outreach-compliance",
            component: OutreachComplianceComponent,
          },
          {
            path: "agent-setup",
            component: AgentSetupWizardComponent,
          },

          {
            path: "recruits-admin",
            component: RecruitsAdminComponent,
          },
          {
            path: "title-change",
            component: TitleChangeComponent
          },
          {
            path:"commission-admin",
            component: CommissionAdminComponent,
          },
          {
            path: "policies",
            component: PoliciesComponent,
          },
          {
            path: "templates",
            component: TemplatesComponent,
          },
          {
            path: "profile",
            component: ProfileComponent,
          },

          {
            path: "business-documents",
            component: BusinessDocsComponent,
          },

          {
            path: "npo-initiatives",
            component: SourcesAdminComponent,
          },

          {
            path: "partnerships",
            component: SourcesAdminComponent,
          },

          {
            path: "networks",
            component: SourcesAdminComponent,
          },

          { path: "tasks", component: TasksComponent },
          { path: "tasks/create", component: CreateTaskComponent },
          { path: "tasks/task-list", component: TaskListComponent },
          { path: "schedules/create", component: CreateScheduleComponent },

          { path: "schedules/schedule-list", component: ScheduleListComponent },
          { path: "usertask/create", component: CreateuserTaskComponent },
          { path: "usertask/usertask-list", component: UserTaskListComponent },

          {
            path: "newsletters",
            component: NewslettersComponent,
          },
          {
            path: "announcements",
            component: AnnouncementsComponent,
          },
          {
            path: "release-notes",
            component: ReleaseNotesComponent,
          },
          {
            path: "shop-management/order-list",
            component: OrderListComponent,
          },
          {
            path: "shop-management/category-list",
            component: CategoryListComponent,
          },
          {
            path: "shop-management/product-list",
            component: ProductListComponent,
          },
          {
            path: "shop-management/account-list",
            component: AccountListComponent,
          },
        ],
      },
    ],
  },
  // Authentication routes (stay at root)
  { path: "login", component: LoginComponent },
  { path: "auth/magic-link", component: MagicLinkCallbackComponent },
  { path: "forgot-password", component: ForgotPasswordComponent },
  // User registration
  {
    path: "user",
    children: [
      {
        path: "registration/:hash",
        component: RegistrationComponent,
      },
      {
        path: "password-reset/:token",
        component: PasswordResetComponent,
      },
    ],
  },
  // Shared Files
  { path: "fv/:id", component: SharedFilesComponent },
  // ── Client Portal at /client (standalone, separate from /app) ──
  // Single parent route with all children to avoid duplicate path ambiguity
  {
    path: "client",
    children: [
      { path: "", component: ClientLandingComponent, pathMatch: "full" },
      { path: "login", component: ClientLandingComponent },
      {
        path: "dashboard",
        component: MyClaimShellComponent,
        canActivate: [ClientGuard],
        children: [
          { path: "", component: MyClaimDashboardComponent },
        ],
      },
    ],
  },
  // Legacy /my-claim redirects
  { path: "my-claim/login", redirectTo: "client/login", pathMatch: "full" },
  { path: "my-claim/dashboard", redirectTo: "client/dashboard", pathMatch: "full" },
  { path: "my-claim", redirectTo: "client", pathMatch: "full" },
  // Legacy signing route redirects → internal agreement system
  { path: "sign", redirectTo: "app/agreements", pathMatch: "full" },
  { path: "signup", redirectTo: "app/agreements", pathMatch: "full" },
  { path: "register", redirectTo: "app/agreements", pathMatch: "full" },
  { path: "upasign", redirectTo: "app/agreements", pathMatch: "full" },
  // Catch-all redirect to app dashboard
  { path: "**", redirectTo: "app/dashboard" },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
