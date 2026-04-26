#!/usr/bin/env python

# isort: skip_file

"""API Routers"""

from fastapi import APIRouter, Depends

from app.api.api_v1.endpoints import (
    auth,
    webauthn,
    magic_link,
    google_auth,
    utils,
    system,
    users,
    user_policies,
    permissions,
    roles,
    tags,
    files,
    user_activities,
    tasks,
    schedules,
    user_tasks,
    leads,
    lead_comments,
    lead_files,
    lead_tasks,
    clients,
    client_comments,
    client_files,
    client_tasks,
    claims,
    claim_comments,
    claim_communications,
    claim_files,
    claim_files_share,
    claim_tasks,
    claim_payments,
    claim_payment_files,
    npo_initiatives,
    partnerships,
    networking,
    dashboard,
    claimrush_dashboards,
    newsletters,
    newsletter_files,
    announcements,
    announcement_files,
    announcement_activities,
    business_email,
    template_files,
    categories,
    products,
    carts,
    masters,
    accounts,
    account_details,
    orders,
    waitlist,
    user_personal_files,
    fire_agencies,
    fire_incidents,
    fire_data_source_configs,
    call_type_configs,
    admin_members,
    estimate_projects,
    estimate_photos,
    estimates_link,
    pricing,
    pricing_versions,
    fire_claims,
    fire_claim_media,
    storm_events,
    storm_seed,
    territories,
    public_territories,
    lead_distribution,
    lead_outcomes,
    notifications,
    tracking,
    communications,
    communication_admin,
    webhooks,
    escalation_admin,
    lead_intake,
    agent_dashboard,
    crime_incidents,
    crime_data_source_configs,
    roof_analysis,
    potential_claims,
    adjuster_cases,
    skiptrace_wallet,
    lead_skip_trace,
    policy_documents,
    carrier_comparison,
    carrier_payments,
    defense_notes,
    voice_outreach,
    claim_recovery,
    rotation_leads,
    rotation_config,
    outreach,
    inspection_scheduling,
    voice_campaigns,
    platform_activity,
    ai_intake,
    communications_hub,
    incident_intelligence,
    lead_rescue,
    intake_config,
    commission,
    agents,
    client_portal_leads,
    voice_secretary,
    sales_agent_sessions,
    agreements,
    rin_chat,
    upa_outreach,
)
from app.api.api_v1.endpoints import reports
from app.api.deps.app import get_service_locator

from app.core.enums import Tags
from app.utils.common import slugify

api_router = APIRouter()

# Auth Router
api_router.include_router(
    auth.router,
    prefix=f"/{Tags.auth.value.lower()}",
    tags=[Tags.auth],
)

# WebAuthn Router
api_router.include_router(
    webauthn.router,
    prefix=f"/{Tags.auth.value.lower()}/webauthn",
    tags=[Tags.auth],
)

# Magic Link Router
api_router.include_router(
    magic_link.router,
    prefix=f"/{Tags.auth.value.lower()}/magic-link",
    tags=[Tags.auth],
)

# Google Auth Router
api_router.include_router(
    google_auth.router,
    prefix=f"/{Tags.auth.value.lower()}/google",
    tags=[Tags.auth],
)

# Utils Router
api_router.include_router(
    utils.router,
    prefix=f"/{Tags.utils.value.lower()}",
    tags=[Tags.utils],
)

# System Router
api_router.include_router(
    system.router,
    prefix=f"/{Tags.system.value.lower()}",
    tags=[Tags.system],
)

# Dashboard Router
api_router.include_router(
    dashboard.router,
    prefix=f"/{slugify(Tags.dashboard.value)}",
    tags=[Tags.dashboard],
)

# ClaimRush role-specific dashboard summaries
# (GET /v1/dashboard/{agent,rvp,cp,adjuster}-summary)
api_router.include_router(
    claimrush_dashboards.router,
    prefix=f"/{slugify(Tags.dashboard.value)}",
    tags=[Tags.dashboard],
)

# Users Router
api_router.include_router(
    users.router,
    prefix=f"/{Tags.users.value.lower()}",
    tags=[Tags.users],
)

# User Policies Router
api_router.include_router(
    user_policies.router,
    prefix=f"/{Tags.users.value.lower()}",
    tags=[Tags.user_policies],
)

# Permissions Router
api_router.include_router(
    permissions.router,
    prefix=f"/{Tags.permissions.value.lower()}",
    tags=[Tags.permissions],
    dependencies=[Depends(get_service_locator)],
)

# Roles Router
api_router.include_router(
    roles.router,
    prefix=f"/{Tags.roles.value.lower()}",
    tags=[Tags.roles],
    dependencies=[Depends(get_service_locator)],
)

# Tags Router
api_router.include_router(
    tags.router,
    prefix=f"/{Tags.tags.value.lower()}",
    tags=[Tags.tags],
)

# Files Router
api_router.include_router(
    files.router,
    prefix=f"/{Tags.files.value.lower()}",
    tags=[Tags.files],
)

# User Activities Router
api_router.include_router(
    user_activities.router,
    prefix=f"/{slugify(Tags.user_activities.value)}",
    tags=[Tags.user_activities],
)

# Tasks Router
api_router.include_router(
    tasks.router,
    prefix=f"/{Tags.tasks.value.lower()}",
    tags=[Tags.tasks],
)

# Schedules Router
api_router.include_router(
    schedules.router,
    prefix=f"/{Tags.schedules.value.lower()}",
    tags=[Tags.schedules],
)

# User Tasks Router
api_router.include_router(
    user_tasks.router,
    prefix=f"/{Tags.users.value.lower()}",
    tags=[Tags.user_tasks],
)

# Leads Router
api_router.include_router(
    leads.router,
    prefix=f"/{Tags.leads.value.lower()}",
    tags=[Tags.leads],
)

# Lead Comments Router
api_router.include_router(
    lead_comments.router,
    prefix=f"/{Tags.leads.value.lower()}",
    tags=[Tags.lead_comments],
)

# Lead Files Router
api_router.include_router(
    lead_files.router,
    prefix=f"/{Tags.leads.value.lower()}",
    tags=[Tags.lead_files],
)

# Lead Tasks Router
api_router.include_router(
    lead_tasks.router,
    prefix=f"/{Tags.leads.value.lower()}",
    tags=[Tags.lead_tasks],
)

# Clients Router
api_router.include_router(
    clients.router,
    prefix=f"/{Tags.clients.value.lower()}",
    tags=[Tags.clients],
)

# Client Comments Router
api_router.include_router(
    client_comments.router,
    prefix=f"/{Tags.clients.value.lower()}",
    tags=[Tags.client_comments],
)

# Client Files Router
api_router.include_router(
    client_files.router,
    prefix=f"/{Tags.clients.value.lower()}",
    tags=[Tags.client_files],
)

# Client Tasks Router
api_router.include_router(
    client_tasks.router,
    prefix=f"/{Tags.clients.value.lower()}",
    tags=[Tags.client_tasks],
)

# Claims Router
api_router.include_router(
    claims.router,
    prefix=f"/{Tags.claims.value.lower()}",
    tags=[Tags.claims],
)

# Claim Comments Router
api_router.include_router(
    claim_comments.router,
    prefix=f"/{Tags.claims.value.lower()}",
    tags=[Tags.claim_comments],
)

# Claim Files Router
api_router.include_router(
    claim_files.router,
    prefix=f"/{Tags.claims.value.lower()}",
    tags=[Tags.claim_files],
)

# Claim Files Share Router
api_router.include_router(
    claim_files_share.router,
    prefix=f"/{Tags.claims.value.lower()}",
    tags=[Tags.claim_files_share],
)

# Claim Communications Router
api_router.include_router(
    claim_communications.router,
    prefix=f"/{Tags.claims.value.lower()}",
    tags=[Tags.claim_communications],
)

# Claim Tasks Router
api_router.include_router(
    claim_tasks.router,
    prefix=f"/{Tags.claims.value.lower()}",
    tags=[Tags.claim_tasks],
)

# Claim Payments Router
api_router.include_router(
    claim_payments.router,
    prefix=f"/{Tags.claims.value.lower()}",
    tags=[Tags.claim_payments],
)

# Claim Payment Files Router
api_router.include_router(
    claim_payment_files.router,
    prefix=f"/{slugify(Tags.claim_payments.value)}",
    tags=[Tags.claim_payment_files],
)

# NPO Initiatives Router
api_router.include_router(
    npo_initiatives.router,
    prefix=f"/{slugify(Tags.npo_initiatives.value)}",
    tags=[Tags.npo_initiatives],
)

# Partnerships Router
api_router.include_router(
    partnerships.router,
    prefix=f"/{slugify(Tags.partnerships.value)}",
    tags=[Tags.partnerships],
)

# Networking Router
api_router.include_router(
    networking.router,
    prefix=f"/{slugify(Tags.networking.value)}",
    tags=[Tags.networking],
)

# Newsletters Router
api_router.include_router(
    newsletters.router,
    prefix=f"/{slugify(Tags.newsletters.value)}",
    tags=[Tags.newsletters],
)

# Newsletter Files Router
api_router.include_router(
    newsletter_files.router,
    prefix=f"/{Tags.newsletters.value.lower()}",
    tags=[Tags.newsletter_files],
)

# Announcements Router
api_router.include_router(
    announcements.router,
    prefix=f"/{slugify(Tags.announcements.value)}",
    tags=[Tags.announcements],
)

# Announcement Files Router
api_router.include_router(
    announcement_files.router,
    prefix=f"/{Tags.announcements.value.lower()}",
    tags=[Tags.announcement_files],
)

# Announcement Activities Router
api_router.include_router(
    announcement_activities.router,
    prefix=f"/{Tags.announcements.value.lower()}",
    tags=[Tags.announcement_activities],
)

# User Reports Router
api_router.include_router(
    reports.users.router,
    prefix=f"/{slugify(Tags.reports.value)}/users",
    tags=[Tags.user_reports],
)

# User Personal Files Router
api_router.include_router(
    user_personal_files.router,
    prefix=f"/{slugify(Tags.user_personal_file.value.lower())}/my-files",
    tags=[Tags.user_personal_file],
)

# Lead Reports Router
api_router.include_router(
    reports.leads.router,
    prefix=f"/{slugify(Tags.reports.value)}/leads",
    tags=[Tags.lead_reports],
)

# Client Reports Router
api_router.include_router(
    reports.clients.router,
    prefix=f"/{slugify(Tags.reports.value)}/clients",
    tags=[Tags.client_reports],
)

# Claim Reports Router
api_router.include_router(
    reports.claims.router,
    prefix=f"/{slugify(Tags.reports.value)}/claims",
    tags=[Tags.claim_reports],
)

# Business Emails Router
api_router.include_router(
    business_email.router,
    prefix=f"/{slugify(Tags.business_emails.value)}",
    tags=[Tags.business_emails],
)

# Template Files Router
api_router.include_router(
    template_files.router,
    prefix=f"/{slugify(Tags.template_files.value)}",
    tags=[Tags.template_files],
)
# Categories Router
api_router.include_router(
    categories.router,
    prefix=f"/{slugify(Tags.categories.value)}",
    tags=[Tags.categories],
)

# Products Router
api_router.include_router(
    products.router,
    prefix=f"/{slugify(Tags.products.value)}",
    tags=[Tags.products],
)

# cart Router
api_router.include_router(
    carts.router,
    prefix=f"/{slugify(Tags.carts.value)}",
    tags=[Tags.carts],
)

# Master Policy Types Router
api_router.include_router(
    masters.policy_types.router,
    prefix=f"/{slugify(Tags.masters.value)}",
    tags=[Tags.masters],
)

# Master Coverage Types Router
api_router.include_router(
    masters.coverage_types.router,
    prefix=f"/{slugify(Tags.masters.value)}",
    tags=[Tags.masters],
)

# Master Claim Roles Permissions Router
api_router.include_router(
    masters.claim_roles_permissions.router,
    prefix=f"/{slugify(Tags.masters.value)}",
    tags=[Tags.masters],
)

# Account Router
api_router.include_router(
    accounts.router,
    prefix=f"/{slugify(Tags.accounts.value)}",
    tags=[Tags.accounts],
)

# Account detail Router
api_router.include_router(
    account_details.router,
    prefix=f"/{slugify(Tags.accounts.value)}",
    tags=[Tags.account_details],
)

# Orders Router
api_router.include_router(
    orders.router,
    prefix=f"/{slugify(Tags.orders.value)}",
    tags=[Tags.orders],
)

# Waitlist Router
api_router.include_router(
    waitlist.router, prefix="/ai-estimate/waitlist", tags=["ai-estimate"]
)

# Fire Agencies Router
api_router.include_router(
    fire_agencies.router,
    prefix="/fire-agencies",
    tags=[Tags.fire_agencies],
)

# Fire Incidents Router
api_router.include_router(
    fire_incidents.router,
    prefix="/fire-incidents",
    tags=[Tags.fire_incidents],
)

# Fire Data Source Configs Router
api_router.include_router(
    fire_data_source_configs.router,
    prefix="/fire-data-source-configs",
    tags=[Tags.fire_data_source_configs],
)

# Call Type Configs Router
api_router.include_router(
    call_type_configs.router,
    prefix="/call-type-configs",
    tags=[Tags.call_type_configs],
)

# Estimate Projects Router
api_router.include_router(
    estimate_projects.router,
    prefix="/estimate-projects",
    tags=[Tags.estimate_projects],
)

# Estimate Photos Router
api_router.include_router(
    estimate_photos.router,
    prefix="/estimate-projects",
    tags=[Tags.estimate_photos],
)

# Estimates ↔ commission_claim plumbing (attach / detach)
api_router.include_router(
    estimates_link.router,
    prefix="/estimates",
    tags=["estimates"],
)

# Admin: existing-member regularization onboarding (R1)
api_router.include_router(
    admin_members.router,
    prefix="/admin/members",
    tags=["admin-members"],
)

# Pricing Router
api_router.include_router(
    pricing.router,
    prefix="/pricing",
    tags=[Tags.pricing],
)

# Pricing Versions Router
api_router.include_router(
    pricing_versions.router,
    prefix="/pricing/versions",
    tags=[Tags.pricing_versions],
)

# Fire Claims Router
api_router.include_router(
    fire_claims.router,
    prefix="/fire-claims",
    tags=[Tags.fire_claims],
)

# Fire Claim Media Router
api_router.include_router(
    fire_claim_media.router,
    prefix="/fire-claims",
    tags=[Tags.fire_claim_media],
)

# Storm Events Router
api_router.include_router(
    storm_events.router,
    prefix="/storm-events",
    tags=[Tags.storm_events],
)

# Storm Events Seed Router (dev only)
api_router.include_router(
    storm_seed.router,
    prefix="/storm-events",
    tags=[Tags.storm_events],
)

# Territories Router
api_router.include_router(
    territories.router,
    prefix="/territories",
    tags=[Tags.territories],
)

# Public Territories Router (no auth)
api_router.include_router(
    public_territories.router,
    prefix="/public/territories",
    tags=[Tags.public_territories],
)

# Lead Outcomes Router
api_router.include_router(
    lead_outcomes.router,
    prefix=f"/{Tags.leads.value.lower()}",
    tags=[Tags.lead_outcomes],
)

# Lead Distribution Router
api_router.include_router(
    lead_distribution.router,
    prefix="/lead-distribution",
    tags=[Tags.lead_distribution],
)

# Notifications Router
api_router.include_router(
    notifications.router,
    prefix="/notifications",
    tags=[Tags.notifications],
)

# Tracking Pixel Router (no auth)
api_router.include_router(
    tracking.router,
    prefix="/t",
    tags=[Tags.communications],
)

# Click Tracking Router (no auth)
api_router.include_router(
    tracking.click_router,
    prefix="/c",
    tags=[Tags.communications],
)

# Lead Communications Router
api_router.include_router(
    communications.router,
    prefix=f"/{Tags.leads.value.lower()}",
    tags=[Tags.communications],
)

# Communication Admin Router
api_router.include_router(
    communication_admin.router,
    prefix="/communications",
    tags=[Tags.communications],
)

# Webhooks Router (no auth — external services send callbacks)
api_router.include_router(
    webhooks.router,
    prefix="/webhooks",
    tags=[Tags.webhooks],
)

# Escalation Admin Router
api_router.include_router(
    escalation_admin.router,
    prefix="/escalation",
    tags=[Tags.escalation],
)

# Lead Intake Router
api_router.include_router(
    lead_intake.router,
    prefix="/lead-intake",
    tags=[Tags.lead_intake],
)

# Agent Dashboard Router
api_router.include_router(
    agent_dashboard.router,
    prefix="/agent-dashboard",
    tags=[Tags.agent_dashboard],
)

# Crime Incidents Router
api_router.include_router(
    crime_incidents.router,
    prefix="/crime-incidents",
    tags=[Tags.crime_incidents],
)

# Crime Data Source Configs Router
api_router.include_router(
    crime_data_source_configs.router,
    prefix="/crime-data-sources",
    tags=[Tags.crime_data_sources],
)

# Roof Analysis Router
api_router.include_router(
    roof_analysis.router,
    prefix="/roof-analysis",
    tags=[Tags.roof_analysis],
)

# Potential Claims Router
api_router.include_router(
    potential_claims.router,
    prefix="/potential-claims",
    tags=[Tags.potential_claims],
)

# Adjuster Cases Router
api_router.include_router(
    adjuster_cases.router,
    prefix="/adjuster-cases",
    tags=[Tags.adjuster_cases],
)

# Skip Trace Wallet Router
api_router.include_router(
    skiptrace_wallet.router,
    prefix="/skip-trace-wallet",
    tags=[Tags.skiptrace_wallet],
)

# Lead Skip Trace Router
api_router.include_router(
    lead_skip_trace.router,
    prefix=f"/{Tags.leads.value.lower()}",
    tags=[Tags.lead_skip_trace],
)

# Policy Documents Router
api_router.include_router(
    policy_documents.router,
    prefix="/policy-documents",
    tags=[Tags.policy_documents],
)

# Carrier Comparison Router
api_router.include_router(
    carrier_comparison.router,
    prefix="/estimate-projects",
    tags=[Tags.carrier_comparison],
)

# Carrier Payments Router
api_router.include_router(
    carrier_payments.router,
    prefix="/estimate-projects",
    tags=[Tags.carrier_payments],
)

# Defense Notes Router
api_router.include_router(
    defense_notes.router,
    prefix="/estimate-projects",
    tags=[Tags.defense_notes],
)

# Voice Outreach Router
api_router.include_router(
    voice_outreach.router,
    prefix="/voice-outreach",
    tags=[Tags.voice_outreach],
)

# Claim Recovery Router
api_router.include_router(
    claim_recovery.router,
    prefix="/claim-recovery",
    tags=[Tags.claim_recovery],
)

# Rotation Leads Router
api_router.include_router(
    rotation_leads.router,
    prefix="/rotation-leads",
    tags=[Tags.rotation_leads],
)

# Rotation Config Router
api_router.include_router(
    rotation_config.router,
    prefix="/rotation-config",
    tags=[Tags.rotation_config],
)

# Outreach Engine Router
api_router.include_router(
    outreach.router,
    prefix="/outreach",
    tags=[Tags.outreach],
)

# Inspection Scheduling Router
api_router.include_router(
    inspection_scheduling.router,
    prefix="/inspections",
    tags=[Tags.inspection_scheduling],
)

# Voice Campaigns Router
api_router.include_router(
    voice_campaigns.router,
    prefix="/voice-campaigns",
    tags=[Tags.voice_campaigns],
)

# Platform Activity Router
api_router.include_router(
    platform_activity.router,
    prefix="/platform-activity",
    tags=[Tags.platform_activity],
)

# AI Intake Assistant Router
api_router.include_router(
    ai_intake.router,
    prefix="/ai-intake",
    tags=[Tags.ai_intake],
)

# RIN Portal Guide Chat Proxy
api_router.include_router(
    rin_chat.router,
    prefix="/rin-chat",
)

# Communications Hub Router
api_router.include_router(
    communications_hub.router,
    prefix="/communications-hub",
    tags=[Tags.communications_hub],
)

# Incident Intelligence Router
api_router.include_router(
    incident_intelligence.router,
    prefix="/incident-intelligence",
    tags=[Tags.incident_intelligence],
)

# Client Portal Lead Tracking + Follow-Up Engine
api_router.include_router(
    client_portal_leads.router,
    prefix="/client-portal",
    tags=["Client Portal Leads"],
)

# Voice Secretary Configuration
api_router.include_router(
    voice_secretary.router,
    prefix="/voice-secretary",
    tags=["Voice Secretary"],
)

# AI Sales Agent Sessions
api_router.include_router(
    sales_agent_sessions.router,
    prefix="/client-portal",
    tags=["Sales Agent Sessions"],
)

# E-Sign Agreement Engine
api_router.include_router(
    agreements.router,
    prefix="/esign",
    tags=["Agreements"],
)

# Lead Rescue Router
api_router.include_router(
    lead_rescue.router,
    prefix="/lead-rescue",
    tags=[Tags.lead_rescue],
)

# UPA → ACI Outreach Funnel Router
api_router.include_router(
    upa_outreach.router,
    prefix="/upa-outreach",
    tags=["UPA Outreach"],
)

# Intake Config Router
api_router.include_router(
    intake_config.router,
    prefix="/intake-config",
    tags=[Tags.intake_config],
)

# Commission Engine Router — agent earnings, admin overview, statements,
# 1099 YTD, payouts, advances. Auth gated via commission_auth dep
# (DEV_BYPASS=1 to skip auth while the frontend is in devAutoLogin).
api_router.include_router(
    commission.router,
    prefix="/commission",
    tags=["Commission"],
)

# Agent Profile Router — /v1/agents/* — profile CRUD + read-only
# license/banking satellites. Same DEV_BYPASS auth gate as /commission.
api_router.include_router(
    agents.router,
    prefix="/agents",
    tags=["Agents"],
)
