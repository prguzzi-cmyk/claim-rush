export class Commission {
  id: string;
  owner_id?: string;
  owner_title_id?: number;
  claim_id: string;
  claim_ref_string: string;
  payment_id: string;
  payment_ref_string: string;
  check_amount: number;
  contingency_fee_percentage?: number;
  commission_type: number
  status?: number;
  fee_amount?: string;
  fee_percentage?: string;
  created_at?: string;
}
