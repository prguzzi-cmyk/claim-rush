export class CommissionAdjustModel {
  scope_id: string;
  scope_type: number;
  owner_title_id?: string;
  contingency_fee_rate?:string;
  sourcer_rate: string;
  sourcer_uid: string;
  signer_rate: string;
  signer_uid: string;
  adjuster_rate: string;
  adjuster_uid: string;
  ssa_override_rate: string;
  ssa_uid: string;
  dm_override_rate: string;
  dm_uid: string;
  sdm_override_rate: string;
  sdm_uid: string;
  dvm_override_rate: string;
  dvm_uid: string;
  rvp_override_rate: string;
  rvp_uid: string;
  evp_override_rate: string;
  evp_uid: string;
  cp_override_rate: string;
  cp_uid: string;
  upa_override_rate: string;
  upa_uid: string;
}
