import { Component, OnInit } from '@angular/core';
import {TITLE_ARRAY, TITLE_MAP} from "../commission-simulator/model/TITLE_ARRAY";
import {TabService} from "../../../services/tab.service";
import {
  CommissionBreakdownDialogComponent
} from "../commission-simulator/commission-breakdown-dialog/commission-breakdown-dialog.component";
import {TeamStructureDialogComponent} from "../commission-simulator/team-structure-dialog/team-structure-dialog.component";
import {MatDialog} from "@angular/material/dialog";
import {FormBuilder, FormControl, Validators} from "@angular/forms";
import {TitleModel} from "../commission-simulator/model/title.model";
import {MatTableDataSource} from "@angular/material/table";
import {MatSelectChange} from "@angular/material/select";
import {CommissionCalculatorInput, SystemDefaultInput} from "./model";
import {UserService} from "../../../services/user.service";

@Component({
    selector: 'app-basic-commission-calculator',
    templateUrl: './basic-commission-calculator.component.html',
    styleUrls: ['./basic-commission-calculator.component.scss'],
    standalone: false
})
export class BasicCommissionCalculatorComponent implements OnInit {

  displayedColumns: string[] = ['Title Requirements:'];
  dataSource: MatTableDataSource<string>;

  searchFormGroup = this._formBuilder.group({
    title: new FormControl("", [Validators.required]),
  });

  sourceRate: number = 0.20;
  signRate: number = 0.20;
  adjustRate: number =0.30;

  teamStructureImgUrl : string;
  dummyTeamImgUrl : string;

  private readonly DEFAULT_DEALS_PER_PERSON_OF_DUMMY_TEAM = 3;
  private readonly DEFAULT_AVG_VAL_ClAIM_DEAL_OF_DUMMY_TEAM = 100000;

  private systemDefaultInput: SystemDefaultInput = {
    ContingencyFeeWeight: 0.1,
    CommissionableFeeWeight: 0.5,
    SourceFeeRate: 0.2,
    SignFeeRate: 0.2,
    AdjustFeeRate:0.3
  }

  systemDefaultInputs = Object.entries(this.systemDefaultInput).map(([key, value]) => ({ key, value }));
  displayedColumns2: string[] = ['key', 'value'];

  commissionInput: CommissionCalculatorInput = {
    title: TITLE_ARRAY[0].code,
    dealsSourcedPerWeek: 3,
    dealsSignedPerWeek: 3,
    dealsAdjustedPerWeek: 3,
    dealsPerPersonOfDummyTeam: this.DEFAULT_DEALS_PER_PERSON_OF_DUMMY_TEAM,
    averageDealValue: this.DEFAULT_AVG_VAL_ClAIM_DEAL_OF_DUMMY_TEAM
  };

  titleData = TITLE_ARRAY;

  commission: {
    totalAmountOfTeamMember: number;
    selfContingencyFee: number;
    selfCommisionableFeeGenerated: number;
    selfSourceFee: number;
    selfSignFee: number;
    selfAdjustFee: number;
    selfMgrOverrideFee: number;
    selfCommission: number;
    personalBonus: number;
    commissionableFeeFromSA?: number;
    commissionableFeeFromSSATeam?: number;
    commissionableFeeFromDMTeam?: number;
    commissionableFeeFromSDMTeam?: number;
    commissionableFeeFromDVMTeam?: number;
    commissionableFeeFromRVPTeam?: number;
    commissionableFeeFromEVPTeam?: number;
    commissionableFeeGeneratedFromCPDummyTeam?: number;
    teamMgrOverrides?: number;
    totalCommission: number
  } | null = null;

  constructor(
      public userService: UserService,
      private _formBuilder: FormBuilder,
      private tabService: TabService ,
              private dialog: MatDialog) { }

  ngOnInit(): void {
    this.dataSource = new MatTableDataSource(TITLE_MAP[this.commissionInput.title].commissionDesc);
  }

  downLineUsersExist(): boolean {
    if (this.commissionInput.title === TITLE_ARRAY[0].code) {
      return false;
    } else {
      return true;
    }
  }

  compareTitles(t1: TitleModel, t2: TitleModel) {
    return t1 && t2 && t1.code == t2.code;
  }

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  openCommissionBreakdown() {
    this.dialog.open(CommissionBreakdownDialogComponent, {
      width: "600px"
    });
  }

  openOrgChart(e){
    e.preventDefault();
    e.stopPropagation();
    this.dialog.open(TeamStructureDialogComponent, {
      width: '600px',
      data :{
        teamStructureImgUrl: this.teamStructureImgUrl
      }
    });
  }

  calculateCommission() {
    if (this.commissionInput.title === TITLE_MAP['SA'].code) {
      this.getSelfPerformanceCommission();
    } else if (this.commissionInput.title === TITLE_MAP['SSA'].code) {
      this.getSelfPerformanceCommission();
      this.getSeniorSalesAgentDummyTeamCommission();
    } else if (this.commissionInput.title === TITLE_MAP['DM'].code) {
      this.getSelfPerformanceCommission();
      this.getDistrictManagerDummyTeamCommission();
    } else if (this.commissionInput.title === TITLE_MAP['SDM'].code) {
      this.getSelfPerformanceCommission();
      this.getSDMDummyTeamCommission();
    } else if (this.commissionInput.title === TITLE_MAP['DVM'].code) {
      this.getSelfPerformanceCommission();
      this.getDVMDummyTeamCommission();
    } else if (this.commissionInput.title === TITLE_MAP['RVP'].code) {
      this.getSelfPerformanceCommission();
      this.getRVPDummyTeamCommission();
    } else if (this.commissionInput.title === TITLE_MAP['EVP'].code) {
      this.getSelfPerformanceCommission();
      this.getEVPDummyTeamCommission();
    } else if (this.commissionInput.title === TITLE_MAP['CP'].code) {
      this.getSelfPerformanceCommission();
      this.getCPDummyTeamCommission();
    }
  }

  /**
   *                                                                                             CP (30%)
   *                                                                                             |
   *                                                        --------------------------------------------------------------------------------------------
   *                                                       |                    |                 |             |            |                |        |
   *                                                      EVP (25%)             RVP (20%)        DVM (15%)     SDM (10%)     DM (5%)       SSA (2.5%)  SA
   *                                                      |                     |                 |             |            |               |
   *                                                      |                more 43 nodes    more 24 nodes   more 11 nodes  more 5 nodes   more 3 nodes
   *                                                      |                    ...              ...            ...           ...           ...
   *                                       -------------------------------
   *                                      |                              |
   *                                     RVP                            DM
   *                                     |                              |
   *                                     |                          more 5 nodes
   *                             -----------------                    ...
   *                             |                |
   *                            DVM               DM
   *                             |                |
   *                  --------------------      more 5 nodes
   *                  |                   |       ...
   *                 SDM                 DM
   *                 |                   |
   *                 |               more 5 nodes
   *             -----------            ...
   *             |          |
   *            DM         DM
   *            |          |
   *        more 5 nodes  more 5 nodes      6 + 6 + 1 + 6 + 1 + 6 + 1 + 6 + 1 + 44 + 25 + 12 + 6 + 4 + 1
   *          ...          ...
   *
   * */
  private getCPDummyTeamCommission() {
    const MY_TITLE_CODE = 'CP';
    let contingencyFeePerClaimCase = this.commissionInput.averageDealValue * this.systemDefaultInput.ContingencyFeeWeight;
    let comissionedFeePerClaimCase = contingencyFeePerClaimCase * this.systemDefaultInput.CommissionableFeeWeight;
    //EVP team: 34 persons in total
    let mgrOverrideRateFromEVP = this.getOverridesRate(MY_TITLE_CODE, 'RVP');
    let totalCommissionableFeeFromEVP = 34 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromEVP = totalCommissionableFeeFromEVP * mgrOverrideRateFromEVP;

    //RVP team: 44 persons in total
    let mgrOverrideRateFromRVP = this.getOverridesRate(MY_TITLE_CODE, 'RVP');
    let totalCommissionableFeeFromRVP = 44 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromRVP = totalCommissionableFeeFromRVP * mgrOverrideRateFromRVP;

    //DVM team: 25 persons in total
    let mgrOverrideRateFromDVM = this.getOverridesRate(MY_TITLE_CODE, 'DVM');
    let totalCommissionableFeeFromDVM = 25 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromDVM = totalCommissionableFeeFromDVM * mgrOverrideRateFromDVM;

    //SDM team: 12 persons in total
    let mgrOverrideRateFromSDM = this.getOverridesRate(MY_TITLE_CODE, 'SDM');
    let totalCommissionableFeeFromSDM = 12 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromSDM = totalCommissionableFeeFromSDM * mgrOverrideRateFromSDM;

    //DM team: 6 persons in total
    let mgrOverrideRateFromDM = this.getOverridesRate(MY_TITLE_CODE, 'DM');
    let totalCommissionableFeeFromDM = 6 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromDM = totalCommissionableFeeFromSDM * mgrOverrideRateFromSDM;

    //SSA team: 4 persons in total
    let mgrOverrideRateFromSSA = this.getOverridesRate(MY_TITLE_CODE, 'SSA');
    let totalCommissionableFeeFromSSA = 4 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromSSA = totalCommissionableFeeFromSSA * mgrOverrideRateFromSSA;

    //SA: 1 direct down line in total
    let mgrOverrideRateFromSA = this.getOverridesRate(MY_TITLE_CODE, 'SA');
    let totalCommissionableFeeFromSA = 1 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromSA = totalCommissionableFeeFromSA * mgrOverrideRateFromSA;

    let totalTeamMgrOverrides = mgrOverrideFeeFromRVP + mgrOverrideFeeFromDVM + mgrOverrideFeeFromSDM + mgrOverrideFeeFromDM + mgrOverrideFeeFromSSA + mgrOverrideFeeFromSA;

    this.commission = {
      ...this.commission,
      totalAmountOfTeamMember: 34 + 44 + 25 + 12 + 6 + 4 + 1,
      commissionableFeeFromEVPTeam: totalCommissionableFeeFromEVP,
      commissionableFeeFromRVPTeam: totalCommissionableFeeFromRVP,
      commissionableFeeFromDVMTeam: totalCommissionableFeeFromDVM,
      commissionableFeeFromSDMTeam: totalCommissionableFeeFromSDM,
      commissionableFeeFromDMTeam: totalCommissionableFeeFromDM,
      commissionableFeeFromSSATeam: totalCommissionableFeeFromSSA,
      commissionableFeeFromSA: totalCommissionableFeeFromSA,
      teamMgrOverrides: totalTeamMgrOverrides,
      totalCommission: this.commission.totalCommission + totalTeamMgrOverrides
    }
  }

  /**
   *.                                                                           EVP (25%)
   *.                                                                            |
   *.                                                   ------------------------------------------------------------------------------
   *.                                                  |                   |              |             |              |            |
   *.                                                 RVP (20%)         DVM (15%)        SDM (10%)      DM (5%)       SSA (2.5%)    SA
   *.                                                 |                   |              |              |              |
   *.                                                 |              more 24 nodes    more 11 nodes  more 5 nodes    more 3 nodes
   *.                                         -----------------          ...            ...             ...            ...
   *.                                        |                |
   *.                                       DVM              DM
   *.                                       |                 |
   *.                           --------------------       more 5 nodes
   *.                           |                   |        ...
   *.                          SDM                 DM
   *.                           |                  |
   *.                           |               more 5 nodes
   *.                    --------------           ...
   *.                    |            |
   *.                    DM           DM
   *.                    |            |
   *.                more 5 nodes   more 5 nodes
   *                    ...            ...
   *                                              Notes:
   *                                             1. Each SSA agent has 3 SA agents as his direct down line person.
   *                                             2. Except for one SSA agent, each DM agent will still have one SA agent as direct down line.
   *                                             3. 75 (=27 + 25 + 12 + 6 + 4 + 1) persons in total for such a dummy team like above (topmost node not included)
   *
   *
   * */
  private getEVPDummyTeamCommission() {
    const MY_TITLE_CODE = 'EVP';
    let contingencyFeePerClaimCase = this.commissionInput.averageDealValue * this.systemDefaultInput.ContingencyFeeWeight;
    let comissionedFeePerClaimCase = contingencyFeePerClaimCase * this.systemDefaultInput.CommissionableFeeWeight;
    //RVP team: 27 persons in total
    let mgrOverrideRateFromRVP = this.getOverridesRate(MY_TITLE_CODE, 'RVP');
    let totalCommissionableFeeFromRVP = 27 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromRVP = totalCommissionableFeeFromRVP * mgrOverrideRateFromRVP;

    //DVM team: 25 persons in total
    let mgrOverrideRateFromDVM = this.getOverridesRate(MY_TITLE_CODE, 'DVM');
    let totalCommissionableFeeFromDVM = 25 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromDVM = totalCommissionableFeeFromDVM * mgrOverrideRateFromDVM;

    //SDM team: 12 persons in total
    let mgrOverrideRateFromSDM = this.getOverridesRate(MY_TITLE_CODE, 'SDM');
    let totalCommissionableFeeFromSDM = 12 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromSDM = totalCommissionableFeeFromSDM * mgrOverrideRateFromSDM;

    //DM team: 6 persons in total
    let mgrOverrideRateFromDM = this.getOverridesRate(MY_TITLE_CODE, 'DM');
    let totalCommissionableFeeFromDM = 6 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromDM = totalCommissionableFeeFromSDM * mgrOverrideRateFromSDM;

    //SSA team: 4 persons in total
    let mgrOverrideRateFromSSA = this.getOverridesRate(MY_TITLE_CODE, 'SSA');
    let totalCommissionableFeeFromSSA = 4 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromSSA = totalCommissionableFeeFromSSA * mgrOverrideRateFromSSA;

    //SA: 1 direct down line in total
    let mgrOverrideRateFromSA = this.getOverridesRate(MY_TITLE_CODE, 'SA');
    let totalCommissionableFeeFromSA = 1 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromSA = totalCommissionableFeeFromSA * mgrOverrideRateFromSA;

    let totalTeamMgrOverrides = mgrOverrideFeeFromRVP + mgrOverrideFeeFromDVM + mgrOverrideFeeFromSDM + mgrOverrideFeeFromDM + mgrOverrideFeeFromSSA + mgrOverrideFeeFromSA;

    this.commission = {
      ...this.commission,
      totalAmountOfTeamMember: 27 + 25 + 12 + 6 + 4 + 1,
      commissionableFeeFromRVPTeam: totalCommissionableFeeFromRVP,
      commissionableFeeFromDVMTeam: totalCommissionableFeeFromDVM,
      commissionableFeeFromSDMTeam: totalCommissionableFeeFromSDM,
      commissionableFeeFromDMTeam: totalCommissionableFeeFromDM,
      commissionableFeeFromSSATeam: totalCommissionableFeeFromSSA,
      commissionableFeeFromSA: totalCommissionableFeeFromSA,
      teamMgrOverrides: totalTeamMgrOverrides,
      totalCommission: this.commission.totalCommission + totalTeamMgrOverrides
    }
  }

  /**
   *
   *.                                                        RVP (20%)
   *.                                                         |
   *.                               ----------------------------------------------------------------
   *.                              |                     |                |             |            |
   *.                            DVM (15%)             SDM (10%)         DM (5%)       SSA (2.5%)    SA (1)
   *.                              |                     |               |              |
   *.                   --------------------        more 11 nodes    more 5 nodes    more 3 nodes
   *.                  |                   |            ...             ...            ...
   *.                 SDM                 DM
   *.                  |                   |
   *.                  |               more 5 nodes
   *.         ---------------               ...
   *.         |              |
   *.        DM             DM
   *.         |              |
   *.    more 5 nodes    more 5 nodes           Notes:
   *         ...             ...                 1. Each SSA agent has 3 SA agents as his direct down line person.
   *                                             2. Except for one SSA agent, each DM agent will still have one SA agent as direct down line.
   *                                             3. 43 (= 20 + 12 + 6 + 4 + 1) persons in total for such a dummy team like above (topmost node not included)
   *
   * */
  private getRVPDummyTeamCommission() {
    const MY_TITLE_CODE = 'RVP';
    let contingencyFeePerClaimCase = this.commissionInput.averageDealValue * this.systemDefaultInput.ContingencyFeeWeight;
    let comissionedFeePerClaimCase = contingencyFeePerClaimCase * this.systemDefaultInput.CommissionableFeeWeight;

    //DVM team: 20 persons in total
    let mgrOverrideRateFromDVM = this.getOverridesRate(MY_TITLE_CODE, 'DVM');
    let totalCommissionableFeeFromDVM = 20 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromDVM = totalCommissionableFeeFromDVM * mgrOverrideRateFromDVM;

    //SDM team: 12 persons in total
    let mgrOverrideRateFromSDM = this.getOverridesRate(MY_TITLE_CODE, 'SDM');
    let totalCommissionableFeeFromSDM = 12 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromSDM = totalCommissionableFeeFromSDM * mgrOverrideRateFromSDM;

    //DM team: 6 persons in total
    let mgrOverrideRateFromDM = this.getOverridesRate(MY_TITLE_CODE, 'DM');
    let totalCommissionableFeeFromDM = 6 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromDM = totalCommissionableFeeFromSDM * mgrOverrideRateFromSDM;

    //SSA team: 4 persons in total
    let mgrOverrideRateFromSSA = this.getOverridesRate(MY_TITLE_CODE, 'SSA');
    let totalCommissionableFeeFromSSA = 4 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromSSA = totalCommissionableFeeFromSSA * mgrOverrideRateFromSSA;

    //SA: 1 direct down line in total
    let mgrOverrideRateFromSA = this.getOverridesRate(MY_TITLE_CODE, 'SA');
    let totalCommissionableFeeFromSA = 1 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromSA = totalCommissionableFeeFromSA * mgrOverrideRateFromSA;

    let totalTeamMgrOverrides = mgrOverrideFeeFromDVM + mgrOverrideFeeFromSDM + mgrOverrideFeeFromDM + mgrOverrideFeeFromSSA + mgrOverrideFeeFromSA;

    this.commission = {
      ...this.commission,
      totalAmountOfTeamMember: 20 + 12 + 6 + 4 + 1,
      commissionableFeeFromDVMTeam: totalCommissionableFeeFromDVM,
      commissionableFeeFromSDMTeam: totalCommissionableFeeFromSDM,
      commissionableFeeFromDMTeam: totalCommissionableFeeFromDM,
      commissionableFeeFromSSATeam: totalCommissionableFeeFromSSA,
      commissionableFeeFromSA: totalCommissionableFeeFromSA,
      teamMgrOverrides: totalTeamMgrOverrides,
      totalCommission: this.commission.totalCommission + totalTeamMgrOverrides
    }
  }

  /**
   *.
   *.                                             DVM (15%)
   *.                                              |
   *.                         -------------------------------------------------------
   *.                         |                   |              |                  |
   *.                       SDM (10%)            DM (5%)       SSA(2.5%)           SA
   *.                        |                   |               |
   *.                     -----------       more 5 nodes     more 3 nodes
   *.                    |          |           ...             ...
   *.                   DM          DM
   *.                   |          |
   *.                more 5 nodes  more 5 nodes        Notes:
   *                    ...        ...                 1. Each SSA agent has 3 SA agents as his direct down line person.
   *                                                   2. Except for one SSA agent, each DM agent will still have one SA agent as direct down line.
   *                                                   3. 24 (=13 + 6 + 4 + 1) persons in total for such a dummy team like above (topmost node not included)
   * */
  private getDVMDummyTeamCommission() {
    const MY_TITLE_CODE = 'DVM';
    let contingencyFeePerClaimCase = this.commissionInput.averageDealValue * this.systemDefaultInput.ContingencyFeeWeight;
    let comissionedFeePerClaimCase = contingencyFeePerClaimCase * this.systemDefaultInput.CommissionableFeeWeight;

    //SDM team: 13 persons in total
    let mgrOverrideRateFromSDM = this.getOverridesRate(MY_TITLE_CODE, 'SDM');
    let totalCommissionableFeeFromSDM = 13 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromSDM = totalCommissionableFeeFromSDM * mgrOverrideRateFromSDM;

    //DM team: 6 persons in total
    let mgrOverrideRateFromDM = this.getOverridesRate(MY_TITLE_CODE, 'DM');
    let totalCommissionableFeeFromDM = 13 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromDM = totalCommissionableFeeFromSDM * mgrOverrideRateFromSDM;

    //SSA team: 4 persons in total
    let mgrOverrideRateFromSSA = this.getOverridesRate(MY_TITLE_CODE, 'SSA');
    let totalCommissionableFeeFromSSA = 4 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromSSA = totalCommissionableFeeFromSSA * mgrOverrideRateFromSSA;

    //SA: 1 direct down line in total
    let mgrOverrideRateFromSA = this.getOverridesRate(MY_TITLE_CODE, 'SA');
    let totalCommissionableFeeFromSA = 1 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromSA = totalCommissionableFeeFromSA * mgrOverrideRateFromSA;

    let totalTeamMgrOverrides = mgrOverrideFeeFromSDM + mgrOverrideFeeFromDM + mgrOverrideFeeFromSSA + mgrOverrideFeeFromSA;

    this.commission = {
      ...this.commission,
      totalAmountOfTeamMember: 13 + 13 + 4 + 1,
      commissionableFeeFromSDMTeam: totalCommissionableFeeFromSDM,
      commissionableFeeFromDMTeam: totalCommissionableFeeFromDM,
      commissionableFeeFromSSATeam: totalCommissionableFeeFromSSA,
      commissionableFeeFromSA: totalCommissionableFeeFromSA,
      teamMgrOverrides: totalTeamMgrOverrides,
      totalCommission: this.commission.totalCommission + totalTeamMgrOverrides
    }
  }


  /**
   *                                          SDM (10%)
   *                                          |
   *                           ------------------------------
   *                          |               |             |
   *                          DM (5%)        SAA (2.5%)     SA
   *                          |              |
   *                          |           ----------
   *                          |           |    |    |
   *                      -----------    SA   SA    SA
   *                     |          |
   *                    SSA        SA
   *                     |
   *                 -----------
   *                |    |     |
   *               SA   SA    SA    Notes:
   *                                   1. Each SSA agent has 3 SA agents as his direct down line person.
   *                                   2. Except for one SSA agent, each DM agent will still have one SA agent as direct down line.
   *                                   3. 11 (= 6 + 4 + 1) persons in total for such a dummy team like above (topmost node not included)
   * */
  private getSDMDummyTeamCommission() {
    const MY_TITLE_CODE = 'SDM';
    let contingencyFeePerClaimCase = this.commissionInput.averageDealValue * this.systemDefaultInput.ContingencyFeeWeight;
    let comissionedFeePerClaimCase = contingencyFeePerClaimCase * this.systemDefaultInput.CommissionableFeeWeight;

    //DM team: 6 persons in total
    let mgrOverrideRate1 = this.getOverridesRate(MY_TITLE_CODE, 'DM');
    let totalCommissionableFeeGenerated1 = 6 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromDM = totalCommissionableFeeGenerated1 * mgrOverrideRate1;
    //SSA team: 4 persons in total
    let mgrOverrideRate2 = this.getOverridesRate(MY_TITLE_CODE, 'SSA');
    let totalCommissionableFeeGenerated2 = 4 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromSSA = totalCommissionableFeeGenerated2 * mgrOverrideRate2;
    //SA: 1 direct down line in total
    let mgrOverrideRate3 = this.getOverridesRate(MY_TITLE_CODE, 'SA');
    let totalCommissionableFeeGenerated3 = 1 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromSA = totalCommissionableFeeGenerated3 * mgrOverrideRate3;

    let totalTeamMgrOverrides = mgrOverrideFeeFromDM + mgrOverrideFeeFromSSA + mgrOverrideFeeFromSA;

    this.commission = {
      ...this.commission,
      totalAmountOfTeamMember: 6 + 4 + 1,
      commissionableFeeFromDMTeam: totalCommissionableFeeGenerated1,
      commissionableFeeFromSSATeam: totalCommissionableFeeGenerated2,
      commissionableFeeFromSA: totalCommissionableFeeGenerated3,
      teamMgrOverrides: totalTeamMgrOverrides,
      totalCommission: this.commission.totalCommission + totalTeamMgrOverrides
    }
  }

  /**
   *                                   DM
   *                                   |
   *                           -----------------
   *                          |                |
   *                          | (2.5%)         | (5%)
   *                        SSA              SA
   *                         | (2.5%)
   *                 ----------------
   *                 |      |       |
   *                SA     SA      SA           Notes:
   *                                             1. Each SSA agent has 3 SA agents as his direct down line person.
   *                                             2. Except for one SSA agent, each DM agent will still have one SA agent as direct down line.
   *
   * */
  private getDistrictManagerDummyTeamCommission() {
    const MY_TITLE_CODE = 'DM';
    let contingencyFeePerClaimCase = this.commissionInput.averageDealValue * this.systemDefaultInput.ContingencyFeeWeight;
    let comissionedFeePerClaimCase = contingencyFeePerClaimCase * this.systemDefaultInput.CommissionableFeeWeight;

    //SSA team: 4 persons in total
    let mgrOverrideRate1 = this.getOverridesRate(MY_TITLE_CODE, 'SSA');
    let totalCommissionableFeeGenerated1 = 4 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromSSA = totalCommissionableFeeGenerated1 * mgrOverrideRate1;
    //SA: 1 direct down line in total
    let mgrOverrideRate2 = this.getOverridesRate(MY_TITLE_CODE, 'SA');
    let totalCommissionableFeeGenerated2 = 1 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeePerClaimCase
    let mgrOverrideFeeFromSA = totalCommissionableFeeGenerated2 * mgrOverrideRate2;
    this.commission = {
      ...this.commission,
      totalAmountOfTeamMember: 4 + 1,
      commissionableFeeFromSSATeam: totalCommissionableFeeGenerated1,
      commissionableFeeFromSA: totalCommissionableFeeGenerated2,
      teamMgrOverrides: mgrOverrideFeeFromSSA + mgrOverrideFeeFromSA,
      totalCommission: this.commission.totalCommission + mgrOverrideFeeFromSSA + mgrOverrideFeeFromSA
    }
  }


  private getOverridesRate(title01: string, title02: string) {
    return TITLE_MAP[title01].mgrOverridesRate - TITLE_MAP[title02].mgrOverridesRate;
  }


  /**
   *  Assume that there are 3 down line sales agent for a given senior sales agent
   *
   *                 SSA
   *      -----------------------
   *     |          |           |     (2.5% of commissionable fee generated from each claim case)
   *    SA.        SA.          SA.
   *
   * */
  private getSeniorSalesAgentDummyTeamCommission() {
    const MY_TITLE_CODE = 'SSA';
    let contingencyFee = this.commissionInput.averageDealValue * this.systemDefaultInput.ContingencyFeeWeight;
    let comissionedFeeGenerated = contingencyFee * this.systemDefaultInput.CommissionableFeeWeight;

    let mgrOverrideRate = this.getOverridesRate(MY_TITLE_CODE, 'SA');
    let commissionableFeeGenerated = 3 * this.commissionInput.dealsPerPersonOfDummyTeam * comissionedFeeGenerated
    let mgrOverrideFeeFromSA = commissionableFeeGenerated * mgrOverrideRate;
    this.commission = {
      ...this.commission,
      totalAmountOfTeamMember: 3,
      commissionableFeeFromSA: comissionedFeeGenerated,
      teamMgrOverrides: mgrOverrideFeeFromSA,
      totalCommission: this.commission.totalCommission + mgrOverrideFeeFromSA
    }
  }

  private getSelfPerformanceCommission() {
    let mgrOverrideRate = TITLE_ARRAY.filter(value =>  value.code=== this.commissionInput.title)[0].mgrOverridesRate;
    let contingencyFee = this.commissionInput.averageDealValue * this.systemDefaultInput.ContingencyFeeWeight;
    let cfg = contingencyFee * this.systemDefaultInput.CommissionableFeeWeight;
    let sourceFee = this.commissionInput.dealsSourcedPerWeek * cfg * this.sourceRate;
    let signFee = this.commissionInput.dealsSignedPerWeek * cfg * this.signRate;
    let adjustFee = this.commissionInput.dealsAdjustedPerWeek * cfg * this.adjustRate;
    let personalBonus = this.getPersonalBonus();
    let mgrOverrideFee = cfg * this.commissionInput.dealsSourcedPerWeek * mgrOverrideRate
                    + cfg * this.commissionInput.dealsSignedPerWeek * mgrOverrideRate
                    + cfg * this.commissionInput.dealsAdjustedPerWeek * mgrOverrideRate;
    this.commission = {
      totalAmountOfTeamMember: 0,
      selfContingencyFee: contingencyFee,
      selfCommisionableFeeGenerated: cfg,
      selfSourceFee: sourceFee,
      selfSignFee: signFee,
      selfAdjustFee: adjustFee,
      selfMgrOverrideFee: mgrOverrideFee,
      selfCommission: sourceFee + signFee + adjustFee,
      personalBonus: personalBonus,
      totalCommission: sourceFee + signFee + adjustFee + mgrOverrideFee + personalBonus
    };
  }

  private getPersonalBonus() {
    let count = Math.min(this.commissionInput.dealsSourcedPerWeek, this.commissionInput.dealsSignedPerWeek, this.commissionInput.dealsAdjustedPerWeek);
    let totalAmount = this.commissionInput.averageDealValue * count;
    if (totalAmount >= 1000000 && totalAmount < 2500000) {
      return (totalAmount-1000000) * 0.1 * 0.5 * 0.025;
    } else if (totalAmount >= 2500000 && totalAmount < 5000000) {
      return (totalAmount-2500000) * 0.1 * 0.5 * 0.05;
    } else if (totalAmount >= 5000000 && totalAmount < 7500000) {
      return (totalAmount-5000000) * 0.1 * 0.5 * 0.1;
    } else if (totalAmount >= 7500000 && totalAmount < 10000000) {
      return (totalAmount-7500000) * 0.1 * 0.5 * 0.15;
    } else if (totalAmount >= 10000000 && totalAmount < 15000000) {
      return (totalAmount-10000000) * 0.1 * 0.5 * 0.20;
    } else if (totalAmount >= 15000000) {
      return (totalAmount-15000000) * 0.1 * 0.5 * 0.25;
    } else {
      return 0.0;
    }

  }

  onTitleChange($event: MatSelectChange) {
    let titleCode = $event.value
    this.commission = null;
    this.commissionInput = {
      title: titleCode,
      dealsSourcedPerWeek: 3,
      dealsSignedPerWeek: 3,
      dealsAdjustedPerWeek: 3,
      dealsPerPersonOfDummyTeam: this.DEFAULT_DEALS_PER_PERSON_OF_DUMMY_TEAM,
      averageDealValue: this.DEFAULT_AVG_VAL_ClAIM_DEAL_OF_DUMMY_TEAM
    };
    this.dataSource = new MatTableDataSource(TITLE_MAP[titleCode].commissionDesc);

    if (TITLE_MAP[titleCode].code === 'SA') {
      this.teamStructureImgUrl = '';
      this.dummyTeamImgUrl = '';
      this.systemDefaultInput = {
        ...this.systemDefaultInput,
        SATeamAmountOfAgents: 0
      }
    } else if (TITLE_MAP[titleCode].code === 'SSA') {
      this.teamStructureImgUrl = '';
      this.dummyTeamImgUrl = 'assets/img/mlm/ssa-dummy-team.png';
      this.systemDefaultInput = {
        ...this.systemDefaultInput,
        SATeamAmountOfAgents: 0,
        SSATeamAmountOfAgents: 3,
      }
    } else if (TITLE_MAP[titleCode].code === 'DM') {
      this.teamStructureImgUrl = '';
      this.dummyTeamImgUrl = 'assets/img/mlm/dm-dummy-team.png';
      this.systemDefaultInput = {
        ...this.systemDefaultInput,
        SATeamAmountOfAgents: 0,
        SSATeamAmountOfAgents: 3,
        DMTeamAmountOfAgents: 5,
      }
    } else if (TITLE_MAP[titleCode].code === 'SDM') {
      this.teamStructureImgUrl = 'assets/img/mlm/sdm-team-structure-model.png';
      this.dummyTeamImgUrl = 'assets/img/mlm/sdm-dummy-team.png';
      this.systemDefaultInput = {
        ...this.systemDefaultInput,
        SATeamAmountOfAgents: 0,
        SSATeamAmountOfAgents: 3,
        DMTeamAmountOfAgents: 5,
        SDMTeamAmountOfAgents: 11,
      }
    } else if (TITLE_MAP[titleCode].code === 'DVM') {
      this.teamStructureImgUrl = 'assets/img/mlm/dvm-team-structure-model.png';
      this.dummyTeamImgUrl = 'assets/img/mlm/dvm-dummy-team.png';
      this.systemDefaultInput = {
        ...this.systemDefaultInput,
        SATeamAmountOfAgents: 0,
        SSATeamAmountOfAgents: 3,
        DMTeamAmountOfAgents: 5,
        SDMTeamAmountOfAgents: 11,
        DVMTeamAmountOfAgents: 24,
      }
    } else if (TITLE_MAP[titleCode].code === 'RVP') {
      this.teamStructureImgUrl = 'assets/img/mlm/rvp-team-structure-model.png';
      this.dummyTeamImgUrl = 'assets/img/mlm/rvp-dummy-team.png';
      this.systemDefaultInput = {
        ...this.systemDefaultInput,
        SATeamAmountOfAgents: 0,
        SSATeamAmountOfAgents: 3,
        DMTeamAmountOfAgents: 5,
        SDMTeamAmountOfAgents: 11,
        DVMTeamAmountOfAgents: 24,
        RVPTeamAmountOfAgents: 43,
      }
    } else if (TITLE_MAP[titleCode].code === 'EVP') {
      this.teamStructureImgUrl = 'assets/img/mlm/evp-team-structure-model.png';
      this.dummyTeamImgUrl = 'assets/img/mlm/evp-dummy-team.png';
      this.systemDefaultInput = {
        ...this.systemDefaultInput,
        SATeamAmountOfAgents: 0,
        SSATeamAmountOfAgents: 3,
        DMTeamAmountOfAgents: 5,
        SDMTeamAmountOfAgents: 11,
        DVMTeamAmountOfAgents: 24,
        RVPTeamAmountOfAgents: 43,
        EVPTeamAmountOfAgents: 75,
      }
    } else if (TITLE_MAP[titleCode].code === 'CP') {
      this.teamStructureImgUrl = '';
      this.dummyTeamImgUrl = 'assets/img/mlm/cp-dummy-team.png';
      this.systemDefaultInput = {
        ...this.systemDefaultInput,
        SATeamAmountOfAgents: 0,
        SSATeamAmountOfAgents: 3,
        DMTeamAmountOfAgents: 5,
        SDMTeamAmountOfAgents: 11,
        DVMTeamAmountOfAgents: 24,
        RVPTeamAmountOfAgents: 43,
        EVPTeamAmountOfAgents: 75,
        CPTeamAmountOfAgents: 126,
      }
    }

    this.systemDefaultInputs = Object.entries(this.systemDefaultInput).map(([key, value]) => ({ key, value }));
  }

  resetForm($event){
    $event.preventDefault();
    $event.stopPropagation();
    this.commission = null;
    this.commissionInput = {
      title: 'SA',
      dealsSourcedPerWeek: 3,
      dealsSignedPerWeek: 3,
      dealsAdjustedPerWeek: 3,
      dealsPerPersonOfDummyTeam: this.DEFAULT_DEALS_PER_PERSON_OF_DUMMY_TEAM,
      averageDealValue: this.DEFAULT_AVG_VAL_ClAIM_DEAL_OF_DUMMY_TEAM
    };
  }

}
