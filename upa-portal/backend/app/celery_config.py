#!/usr/bin/env python

"""Celery configuration module file."""

import os

broker_url = os.getenv("CELERY_BROKER_URL")
broker_connection_retry_on_startup = True

result_backend = os.getenv("CELERY_RESULT_BACKEND")

task_serializer = "pickle"
result_serializer = "pickle"
accept_content = ["json", "pickle"]
timezone = "America/New_York"

task_track_started = True
task_publish_retry = True
task_publish_retry_policy = {
    "max_retries": 5,
    "interval_start": 0,
    "interval_step": 3 * 60,
    "interval_max": 3 * 60,
    "retry_errors": None,
}

beat_schedule = {
    "dispatch-pulsepoint-every-2min": {
        "task": "app.tasks.pulsepoint.dispatch_pulsepoint_polls",
        "schedule": 120.0,
    },
    "poll-socrata-every-5min": {
        "task": "app.tasks.socrata.poll_socrata_sources",
        "schedule": 300.0,
    },
    "poll-nifc-every-10min": {
        "task": "app.tasks.nifc.poll_nifc_incidents",
        "schedule": 600.0,
    },
    "poll-firms-every-15min": {
        "task": "app.tasks.firms.poll_firms_hotspots",
        "schedule": 900.0,
    },
    "poll-nws-storm-every-5min": {
        "task": "app.tasks.nws.poll_nws_storm_alerts",
        "schedule": 300.0,
    },
    "flush-quiet-hours-every-5min": {
        "task": "app.tasks.communication.flush_quiet_hours_queue",
        "schedule": 300.0,
    },
    "poll-crime-sources-every-15min": {
        "task": "app.tasks.crime_ingestion.poll_crime_sources",
        "schedule": 900.0,
    },
    "poll-spc-storm-every-5min": {
        "task": "app.tasks.spc.poll_spc_storm_reports",
        "schedule": 300.0,
    },
    "process-storm-claim-zones-every-5min": {
        "task": "app.tasks.storm_lead_rotation.process_storm_claim_zones",
        "schedule": 300.0,
    },
    "claim-zone-lead-pipeline-every-10min": {
        "task": "app.tasks.claim_zone_lead_pipeline.process_all_pending_zones",
        "schedule": 600.0,
    },
    "process-voice-campaigns-every-2min": {
        "task": "app.tasks.voice_campaign.process_voice_campaign_calls",
        "schedule": 120.0,
    },
    "process-client-portal-follow-ups-every-5min": {
        "task": "process_client_portal_follow_ups",
        "schedule": 300.0,
    },
}

task_routes = {
    "app.worker.test_celery": "main-queue",
    "app.worker.new_lead_account_email": "main-queue",
    "app.worker.execute_business_email_creation_task": "main-queue",
    "app.tasks.daily_schedule.daily_schedule": "schedule",
    "app.tasks.daily_schedule.add_task_to_daily_schedule": "schedule",
    "app.tasks.pulsepoint.dispatch_pulsepoint_polls": "main-queue",
    "app.tasks.pulsepoint.poll_agency_batch": "pulsepoint-queue",
    "app.tasks.pulsepoint.poll_pulsepoint_agencies": "main-queue",
    "app.tasks.socrata.poll_socrata_sources": "main-queue",
    "app.tasks.nifc.poll_nifc_incidents": "main-queue",
    "app.tasks.firms.poll_firms_hotspots": "main-queue",
    "app.tasks.nws.poll_nws_storm_alerts": "main-queue",
    "app.tasks.communication.send_tracked_email_task": "main-queue",
    "app.tasks.communication.flush_quiet_hours_queue": "main-queue",
    "app.tasks.fire_lead_rotation.process_new_fire_incidents": "main-queue",
    "app.tasks.ai_contact.initiate_ai_contact": "main-queue",
    "app.tasks.ai_contact.check_escalation_timeout": "main-queue",
    "app.tasks.crime_ingestion.poll_crime_sources": "main-queue",
    "app.tasks.roof_analysis.process_roof_batch": "main-queue",
    "app.tasks.spc.poll_spc_storm_reports": "main-queue",
    "app.tasks.storm_pipeline.trigger_roof_analysis_pipeline": "main-queue",
    "app.tasks.property_ingestion.ingest_zone_properties": "main-queue",
    "app.tasks.property_ingestion.process_zone_scan": "main-queue",
    "app.tasks.storm_lead_rotation.process_storm_claim_zones": "main-queue",
    "app.tasks.claim_zone_lead_pipeline.run_claim_zone_pipeline": "main-queue",
    "app.tasks.claim_zone_lead_pipeline.process_all_pending_zones": "main-queue",
    "app.tasks.voice_campaign.process_voice_campaign_calls": "main-queue",
    "app.tasks.voice_campaign.process_single_campaign_call": "main-queue",
    "process_client_portal_follow_ups": "main-queue",
}
