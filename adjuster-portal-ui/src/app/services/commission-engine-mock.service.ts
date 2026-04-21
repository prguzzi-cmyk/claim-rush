import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  Claim,
  ClaimStage,
  CommissionBucket,
  CommissionStructure,
  LedgerTransaction,
  LedgerTransactionType,
  MonthlyTarget,
  OrgRole,
  User,
} from '../models/commission-engine.model';

/**
 * Typed mock service whose shape matches the eventual FastAPI contract.
 *
 * IMPORTANT: this is intentionally NOT a simplified stub. It exercises:
 *   - writing_agent_id distinct from assigned_to
 *   - CP and RVP acting as writing_agent on some claims (rule: claim function ≠ org role)
 *   - append-only ledger with commissions, advances, interest, offsets, adjustments
 *   - two-layer split with House always visible
 *   - monthly target with role defaults + admin override + user adjustment
 */

// Stable deterministic IDs so UI reloads are reproducible.
const U_AGENT_ALICE = 'u_agent_alice';
const U_AGENT_BRIAN = 'u_agent_brian';
const U_RVP_CARLA = 'u_rvp_carla';
const U_CP_DIEGO = 'u_cp_diego';
const U_ADMIN = 'u_admin_root';

// Correct two-layer split:
//   Master  → house 50%, field 50%
//   Field (normalized to 100%) → writing_agent / rvp / cp only. House is NOT a field bucket.
const MASTER_SPLIT = { house_percent: 50, field_percent: 50 };
const FIELD_STANDARD = {
  writing_agent_percent: 60,
  rvp_override_percent: 20,
  cp_override_percent: 20,
  reserve_percent: 0,
};
// Direct-write (no RVP in the chain): writing agent absorbs the RVP portion.
const FIELD_DIRECT_CP = {
  writing_agent_percent: 80,
  rvp_override_percent: 0,
  cp_override_percent: 20,
  reserve_percent: 0,
};

function structure(gross_fee: number, field = FIELD_STANDARD): CommissionStructure {
  return {
    gross_fee,
    master_split: MASTER_SPLIT,
    field_allocation: field,
  };
}

@Injectable({ providedIn: 'root' })
export class CommissionEngineMockService {
  private readonly users: User[] = [
    { id: U_AGENT_ALICE, name: 'Alice Nguyen', org_role: OrgRole.AGENT, avatar_initials: 'AN' },
    { id: U_AGENT_BRIAN, name: 'Brian Ortiz', org_role: OrgRole.AGENT, avatar_initials: 'BO' },
    { id: U_RVP_CARLA, name: 'Carla Mendes', org_role: OrgRole.RVP, avatar_initials: 'CM' },
    { id: U_CP_DIEGO, name: 'Diego Park', org_role: OrgRole.CP, avatar_initials: 'DP' },
    { id: U_ADMIN, name: 'RIN Admin', org_role: OrgRole.ADMIN, avatar_initials: 'RA' },
  ];

  private readonly claims: Claim[] = [
    {
      id: 'c_001',
      ref_string: 'RIN-2604-0001',
      client_name: 'Harper Residence',
      stage: ClaimStage.ESTIMATE_SUBMITTED,
      writing_agent_id: U_AGENT_ALICE,
      rvp_override_user_id: U_RVP_CARLA,
      cp_override_user_id: U_CP_DIEGO,
      assigned_to: U_AGENT_ALICE,
      gross_fee: 12000,
      commission_structure: structure(12000),
      opened_at: '2026-03-12T15:00:00Z',
    },
    {
      id: 'c_002',
      ref_string: 'RIN-2604-0002',
      client_name: 'Delacruz Property',
      stage: ClaimStage.CARRIER_REVIEW,
      writing_agent_id: U_AGENT_ALICE,
      rvp_override_user_id: U_RVP_CARLA,
      cp_override_user_id: U_CP_DIEGO,
      assigned_to: U_AGENT_ALICE,
      gross_fee: 8600,
      commission_structure: structure(8600),
      opened_at: '2026-03-22T18:00:00Z',
    },
    {
      id: 'c_003',
      ref_string: 'RIN-2604-0003',
      client_name: 'Kincaid Estates',
      stage: ClaimStage.NEGOTIATION,
      writing_agent_id: U_AGENT_ALICE,
      rvp_override_user_id: U_RVP_CARLA,
      cp_override_user_id: U_CP_DIEGO,
      assigned_to: U_AGENT_ALICE,
      gross_fee: 24500,
      commission_structure: structure(24500),
      opened_at: '2026-02-04T19:00:00Z',
    },
    {
      id: 'c_004',
      ref_string: 'RIN-2604-0004',
      client_name: 'Rosario Duplex',
      stage: ClaimStage.PAID,
      writing_agent_id: U_AGENT_ALICE,
      rvp_override_user_id: U_RVP_CARLA,
      cp_override_user_id: U_CP_DIEGO,
      assigned_to: U_AGENT_ALICE,
      gross_fee: 6400,
      commission_structure: structure(6400),
      opened_at: '2026-01-18T17:00:00Z',
    },
    // Agent Brian — covers stage variety for the admin view
    {
      id: 'c_005',
      ref_string: 'RIN-2604-0005',
      client_name: 'Whitfield Complex',
      stage: ClaimStage.INSPECTION_COMPLETED,
      writing_agent_id: U_AGENT_BRIAN,
      rvp_override_user_id: U_RVP_CARLA,
      cp_override_user_id: U_CP_DIEGO,
      assigned_to: U_AGENT_BRIAN,
      gross_fee: 15200,
      commission_structure: structure(15200),
      opened_at: '2026-03-08T14:00:00Z',
    },
    {
      id: 'c_006',
      ref_string: 'RIN-2604-0006',
      client_name: 'Emerald Ranch',
      stage: ClaimStage.LITIGATION,
      writing_agent_id: U_AGENT_BRIAN,
      rvp_override_user_id: U_RVP_CARLA,
      cp_override_user_id: U_CP_DIEGO,
      assigned_to: U_AGENT_BRIAN,
      gross_fee: 42000,
      commission_structure: structure(42000),
      opened_at: '2025-11-02T20:00:00Z',
    },
    // Carla (RVP) is herself the WRITING AGENT on this claim — proving claim function ≠ org role.
    {
      id: 'c_007',
      ref_string: 'RIN-2604-0007',
      client_name: 'Beltran Grove',
      stage: ClaimStage.SETTLEMENT_REACHED,
      writing_agent_id: U_RVP_CARLA,
      rvp_override_user_id: undefined,
      cp_override_user_id: U_CP_DIEGO,
      assigned_to: U_RVP_CARLA,
      gross_fee: 18000,
      commission_structure: structure(18000, FIELD_DIRECT_CP),
      opened_at: '2026-03-30T16:00:00Z',
    },
    // Diego (CP) is himself the WRITING AGENT — same principle.
    {
      id: 'c_008',
      ref_string: 'RIN-2604-0008',
      client_name: 'Northgate Tower',
      stage: ClaimStage.SUPPLEMENT_SUBMITTED,
      writing_agent_id: U_CP_DIEGO,
      rvp_override_user_id: undefined,
      cp_override_user_id: undefined,
      assigned_to: U_CP_DIEGO,
      gross_fee: 31000,
      commission_structure: {
        gross_fee: 31000,
        master_split: MASTER_SPLIT,
        field_allocation: {
          writing_agent_percent: 100,
          rvp_override_percent: 0,
          cp_override_percent: 0,
          reserve_percent: 0,
        },
      },
      opened_at: '2026-02-28T15:00:00Z',
    },
  ];

  /**
   * Append-only ledger. Order of entries is chronological by `timestamp`.
   * Every COMMISSION_EARNED transaction for a claim emits 5 rows (one per bucket),
   * modeling the rule: all 5 buckets sum to 100% of gross fee in every payout statement.
   */
  private readonly ledger: LedgerTransaction[] = [
    // --- Claim 004 (Alice, fully paid) — full 5-bucket emission on PAID
    ...this.emitEarnedFiveBuckets('c_004', 6400, FIELD_STANDARD, '2026-02-10T10:00:00Z', {
      writing_agent_id: U_AGENT_ALICE,
      rvp_id: U_RVP_CARLA,
      cp_id: U_CP_DIEGO,
    }),

    // Alice advances + partial recovery
    this.tx('t_a1', 'c_001', U_AGENT_ALICE, LedgerTransactionType.ADVANCE_ISSUED, CommissionBucket.WRITING_AGENT, 1500, '2026-03-15T12:00:00Z', 'Advance support: field expenses'),
    this.tx('t_a2', 'c_003', U_AGENT_ALICE, LedgerTransactionType.ADVANCE_ISSUED, CommissionBucket.WRITING_AGENT, 2200, '2026-02-20T12:00:00Z', 'Advance support: travel'),
    this.tx('t_a3', 'c_001', U_AGENT_ALICE, LedgerTransactionType.INTEREST_APPLIED, CommissionBucket.WRITING_AGENT, 38.50, '2026-04-01T00:00:00Z', 'Carrying cost: March'),
    this.tx('t_a4', 'c_003', U_AGENT_ALICE, LedgerTransactionType.INTEREST_APPLIED, CommissionBucket.WRITING_AGENT, 52.10, '2026-04-01T00:00:00Z', 'Carrying cost: March'),
    this.tx('t_a5', 'c_004', U_AGENT_ALICE, LedgerTransactionType.REPAYMENT_OFFSET, CommissionBucket.WRITING_AGENT, -800, '2026-02-10T10:30:00Z', 'Offset against c_004 payout'),

    // Partial payout issued to Alice for c_004 — leaves a remaining balance owed to her.
    this.tx('t_a6', 'c_004', U_AGENT_ALICE, LedgerTransactionType.PAYOUT_ISSUED, CommissionBucket.WRITING_AGENT, -1600, '2026-02-15T14:00:00Z', 'Payout disbursed (partial) — c_004'),

    // --- Claim 006 (Brian, still in LITIGATION, no commission yet, but has advances + interest)
    this.tx('t_b1', 'c_005', U_AGENT_BRIAN, LedgerTransactionType.ADVANCE_ISSUED, CommissionBucket.WRITING_AGENT, 1800, '2026-03-10T12:00:00Z', 'Advance support: inspection travel'),
    this.tx('t_b2', 'c_006', U_AGENT_BRIAN, LedgerTransactionType.ADVANCE_ISSUED, CommissionBucket.WRITING_AGENT, 3500, '2025-11-15T12:00:00Z', 'Advance support: litigation filing'),
    this.tx('t_b3', 'c_006', U_AGENT_BRIAN, LedgerTransactionType.INTEREST_APPLIED, CommissionBucket.WRITING_AGENT, 210.75, '2026-04-01T00:00:00Z', 'Carrying cost: accrued'),

    // --- Carla is WRITING AGENT on c_007 — she carries debit like any other writing agent
    this.tx('t_c1', 'c_007', U_RVP_CARLA, LedgerTransactionType.ADVANCE_ISSUED, CommissionBucket.WRITING_AGENT, 2400, '2026-04-02T12:00:00Z', 'Advance support'),
    this.tx('t_c2', 'c_007', U_RVP_CARLA, LedgerTransactionType.INTEREST_APPLIED, CommissionBucket.WRITING_AGENT, 18.00, '2026-04-15T00:00:00Z', 'Carrying cost'),

    // Carla's RVP OVERRIDES on Alice's and Brian's claims (credits, not debits)
    // Only the PAID claim (c_004) actually realizes commission; others remain unrealized.
    // Emitted above for c_004, so Carla's rvp_override credit exists in that batch.

    // Diego (CP) overrides on Alice/Brian claims — also realized only on c_004 (already emitted above).
    // Diego as WRITING AGENT on c_008:
    this.tx('t_d1', 'c_008', U_CP_DIEGO, LedgerTransactionType.ADVANCE_ISSUED, CommissionBucket.WRITING_AGENT, 4000, '2026-03-05T12:00:00Z', 'Advance support: supplement prep'),
    this.tx('t_d2', 'c_008', U_CP_DIEGO, LedgerTransactionType.INTEREST_APPLIED, CommissionBucket.WRITING_AGENT, 64.00, '2026-04-01T00:00:00Z', 'Carrying cost: March'),

    // An adjustment: admin corrects a miskeyed advance on Alice
    this.tx('t_adj1', 'c_001', U_AGENT_ALICE, LedgerTransactionType.ADJUSTMENT, CommissionBucket.WRITING_AGENT, -100, '2026-04-05T18:00:00Z', 'Correction: duplicate advance reversed'),
  ];

  private readonly monthlyTargets: MonthlyTarget[] = [
    { user_id: U_AGENT_ALICE, role_default: 8000,  admin_override: undefined, user_adjusted: 9000,  allowed_min: 6000,  allowed_max: 12000, effective: 9000 },
    { user_id: U_AGENT_BRIAN, role_default: 8000,  admin_override: 10000,     user_adjusted: undefined, allowed_min: 6000, allowed_max: 12000, effective: 10000 },
    { user_id: U_RVP_CARLA,   role_default: 18000, admin_override: undefined, user_adjusted: undefined, allowed_min: 12000, allowed_max: 28000, effective: 18000 },
    { user_id: U_CP_DIEGO,    role_default: 35000, admin_override: undefined, user_adjusted: 40000, allowed_min: 25000, allowed_max: 55000, effective: 40000 },
  ];

  getUsers(): Observable<User[]> {
    return of(this.users);
  }

  getCurrentUser(): Observable<User> {
    // In production this comes from auth. For mock, default to Alice (Agent) so Earnings tab has rich data.
    return of(this.users.find(u => u.id === U_AGENT_ALICE)!);
  }

  getClaims(): Observable<Claim[]> {
    return of(this.claims);
  }

  getLedger(): Observable<LedgerTransaction[]> {
    return of([...this.ledger].sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
  }

  getMonthlyTargets(): Observable<MonthlyTarget[]> {
    return of(this.monthlyTargets);
  }

  /** Utility: produce a ledger transaction quickly. */
  private tx(
    id: string,
    claim_id: string,
    user_id: string,
    type: LedgerTransactionType,
    bucket: CommissionBucket,
    amount: number,
    timestamp: string,
    memo?: string,
  ): LedgerTransaction {
    return { id, claim_id, user_id, type, bucket, amount, timestamp, memo };
  }

  /**
   * Emit all 5 bucket commission_earned rows for a settled claim, so every payout statement
   * renders the full 100%-of-gross picture. Reserve always emits (no user payout) per rules.
   */
  private emitEarnedFiveBuckets(
    claim_id: string,
    gross_fee: number,
    field: typeof FIELD_STANDARD,
    timestamp: string,
    who: { writing_agent_id: string; rvp_id?: string; cp_id?: string },
  ): LedgerTransaction[] {
    const house_amt = gross_fee * (MASTER_SPLIT.house_percent / 100);
    const field_share = gross_fee * (MASTER_SPLIT.field_percent / 100);
    const wa_amt = field_share * (field.writing_agent_percent / 100);
    const rvp_amt = field_share * (field.rvp_override_percent / 100);
    const cp_amt = field_share * (field.cp_override_percent / 100);
    const reserve_amt = field_share * (field.reserve_percent / 100);

    const base = (id: string, bucket: CommissionBucket, user_id: string, amount: number): LedgerTransaction => ({
      id, claim_id, user_id, bucket, amount,
      type: LedgerTransactionType.COMMISSION_EARNED,
      timestamp,
      memo: `Commission earned — ${bucket}`,
    });

    const rows: LedgerTransaction[] = [
      base(`earn_${claim_id}_house`, CommissionBucket.HOUSE, 'system_house', house_amt),
      base(`earn_${claim_id}_wa`, CommissionBucket.WRITING_AGENT, who.writing_agent_id, wa_amt),
    ];
    if (reserve_amt > 0) rows.push(base(`earn_${claim_id}_reserve`, CommissionBucket.RESERVE, 'system_reserve', reserve_amt));
    if (rvp_amt > 0 && who.rvp_id) rows.push(base(`earn_${claim_id}_rvp`, CommissionBucket.RVP_OVERRIDE, who.rvp_id, rvp_amt));
    if (cp_amt > 0 && who.cp_id)   rows.push(base(`earn_${claim_id}_cp`,  CommissionBucket.CP_OVERRIDE,  who.cp_id,  cp_amt));
    return rows;
  }
}
