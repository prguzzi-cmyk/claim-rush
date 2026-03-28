export class Lead {
    loss_date: string;
    peril: string;
    ref_string: string;
    insurance_company: string;
    policy_number: string;
    claim_number: string;
    status: string;
    source: string;
    source_info: string;
    instructions_or_notes: string;
    assigned_to: string;
    can_be_removed: boolean = true;
    id: string;
    is_removed: boolean = false;
    contact: {
      full_name?: string;
      full_name_alt?: string;
      email?: string;
      email_alt?: string;
      phone_number?: string;
      phone_number_alt?: string;
      address?: string;
      city?: string;
      state?: string;
      zip_code?: string;
      address_loss?: string;
      city_loss?: string;
      state_loss?: string;
      zip_code_loss?: string;
      id?: string;
      // Opt-out / Consent
      sms_opt_out?: boolean;
      email_opt_out?: boolean;
      voice_opt_out?: boolean;
      opt_out_at?: string;
    }
    source_user: {
      first_name: string;
      last_name: string;
      email: string;
    }
    assigned_user: {
      first_name: string;
      last_name: string;
      email: string;
      user_meta?: {
        avatar?: string;
        address?: string;
        city?: string;
        state?: string;
        zip_code?: string;
        phone_number?: string;
        id?: string;
      }
    }
    follow_ups: [
      {
        type: string;
        dated: string;
        note: string;
        next_date: string;
        id: string;
        can_be_removed: boolean;
        is_removed: boolean;

        created_by: {
          first_name: string;
          last_name: string;
          id?: string;
        };
        updated_by: {
          first_name: string;
          last_name: string;
          id?: string;
        }
        created_at: Date;
        updated_at: Date;
      }
    ]
    last_outcome_status: string;
    score_tier: string;
    is_rescued: boolean;
    info_sent_at: string;
    // UPA → ACI Funnel
    routing_bucket: string;
    contact_status: string;
    template_profile: string;
    last_outreach_at: string;
    last_reply: string;
    source_queue: string;
    escalated_to_aci: boolean;
    created_by: {
      first_name: string;
      last_name: string
    }
    updated_by: {
      first_name: string;
      last_name: string;
    }
    created_at: Date;
    updated_at: Date;
  }
