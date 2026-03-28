export class Claim {
    id: string;
    ref_number?: string;
    ref_string: string;
    client_id?: string;
    assigned_to: string;
    loss_date?: string;
    peril?: string;
    insurance_company?: string;
    policy_number: string;
    claim_number?: string;
    status?: string;
    adjusted_by?: string;
    signed_by?: string;
    address_loss?: string;
    city_loss?: string;
    state_loss?: string;
    zip_code_loss?: string;
    is_active?: boolean;
    is_removed?: boolean;
    can_be_removed?: boolean = true;
    fee?: string;
    fee_type?: string;
    anticipated_amount?: string;
    current_phase?: string;
    escalation_path?: string;
    sub_status?: string;
    origin_type?: string;
    date_aci_entered?: string;
    prior_carrier_payments?: number;
    recovery_mode?: string;
    source: string;
    source_info?: string;
    instructions_or_notes?: string;
    policy_type?: string;
    sub_policy_type?: string;
    date_logged?: string;
    claim_business_email?: {
        email: string;
    };
    lawsuit_deadline?: string;
    mortgage_company?: string;
    fema_claim?: any;
    state_of_emergency?: any;
    inhabitable?: any;
    contract_sign_date?: string;
    claim_role?: string;
    coverages?: [
      {
        coverage_type: string;
        policy_limit: number;
      }
    ];
    is_collaborator?: boolean;

    collaborators?: [
        {
            first_name: string;
            last_name: string;
            email: string;
            id: string;
        }
    ];

    client?: {
        full_name: string;
        phone_number: string;
        email: string;
    };

    source_user?: {
        first_name: string;
        last_name: string;
        email: string;
    };

    signed_by_user?: {
        first_name: string;
        last_name: string;
        email: string;
    };

    adjusted_by_user?: {
        first_name: string;
        last_name: string;
        email: string;
    };

    assigned_user?: {
        first_name: string;
        last_name: string;
        email: string;
        user_meta?: {
            id?: string;
            avatar?: string;
            address?: string;
            city?: string;
            state?: string;
            zip_code?: string;
            phone_number?: string;
        };
    };

    claim_contact?: {
        address_loss: string;
        city_loss: string;
        state_loss: string;
        zip_code_loss: string;
        id?: string;
    };

    created_by?: {
        first_name: string;
        last_name: string;
    };
    updated_by?: {
        first_name: string;
        last_name: string;
    };

    created_at?: Date;
    updated_at?: Date;
}
