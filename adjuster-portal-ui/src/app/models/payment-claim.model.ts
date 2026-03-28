export class ClaimPayment {
    payment_date: string;
    ref_number: string;
    note: string;
    contingency_fee_percentage: number;
    appraisal_fee: number;
    umpire_fee: number;
    mold_fee: number;
    misc_fee: number;
    id: string;
    claim_id: string;
    is_locked: boolean;
    is_ready_to_process: boolean;
    check_amount: number;
    check_type: string;
    payment_type: string;
    issued_by: string;
    payee: string;
    deposit_status: string;
    related_coverage: string;
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
