import {Component, OnInit} from '@angular/core';
import {DialogService} from "../../../services/dialog.service";
import {NgxSpinnerService} from "ngx-spinner";
import {TabService} from "../../../services/tab.service";
import {SACommissionInput} from "./model/agent.model";
import {TITLE_ARRAY, TITLE_MAP} from "./model/TITLE_ARRAY";
import {TitleModel} from "./model/title.model";
import {FormBuilder, FormControl, Validators} from "@angular/forms";
import {MatSelectChange} from "@angular/material/select";
import {MatDialog} from "@angular/material/dialog";
import {CommissionBreakdownDialogComponent} from "./commission-breakdown-dialog/commission-breakdown-dialog.component";
import {TeamStructureDialogComponent} from "./team-structure-dialog/team-structure-dialog.component";
import {MatTableDataSource} from "@angular/material/table";


@Component({
    selector: 'app-commission-simulator',
    templateUrl: './commission-simulator.component.html',
    styleUrls: ['./commission-simulator.component.scss'],
    standalone: false
})
export class CommissionSimulatorComponent implements OnInit {

  displayedColumns: string[] = ['Notes:'];
  dataSource: MatTableDataSource<string>;

  commissionInput: SACommissionInput = {
    sourceRate: 20,
    signRate: 20,
    adjustRate: 30,
    title: TITLE_ARRAY[0].code,
    selfDealsPerWeek: 0,
    selfAverageDealValue: 0,
    selfContingencyFee: 0,
    teamDealsPerWeek: 0,
    teamAverageDealValue: 0,
    teamContingencyFee: 0,
    qtyOfSA: 0,
    qtyOfSSA: 0,
    qtyOfDM:0,
    qtyOfSDM: 0,
    qtyOfDVM: 0,
    qtyOfRVP: 0,
    qtyOfEVP: 0,
  };

  searchFormGroup = this._formBuilder.group({
    title: new FormControl("", [Validators.required]),
  });

  teamStructureImgUrl : string;

  commission: {selfCommission: number; overrideCommission: number; totalCommission: number } | null = null;

  compareTitles(t1: TitleModel, t2: TitleModel) {
    return t1 && t2 && t1.code == t2.code;
  }

  calculateCommission() {
    if (this.commissionInput.title === TITLE_MAP['SA'].code) {
      this.calculateSACommission();
    } else if (this.commissionInput.title === TITLE_MAP['SSA'].code) {
      this.calculateSSACommission();
    } else if (this.commissionInput.title === TITLE_MAP['DM'].code) {
      this.calculateDMCommission();
    } else if (this.commissionInput.title === TITLE_MAP['SDM'].code) {
      this.calculateSDMCommission();
    } else if (this.commissionInput.title === TITLE_MAP['DVM'].code) {
      this.calculateDVMCommission();
    } else if (this.commissionInput.title === TITLE_MAP['RVP'].code) {
      this.calculateRVPCommission();
    } else if (this.commissionInput.title === TITLE_MAP['EVP'].code) {
      this.calculateEVPCommission();
    } else if (this.commissionInput.title === TITLE_MAP['CP'].code) {
      this.calculateCPCommission();
    }
  }

  private calculateCPCommission() {
    // Self performance
    const selfCommission = this.getSelfCommission();
    // 1 DVM under EVP, 1 DVM is separate from the EVP leg
    //Earn by managing EVP
    let agentQtyOfEVPTeam = 24 + TITLE_MAP['EVP'].basicOrgStructAgentQty * (this.commissionInput.qtyOfEVP - 1);
    const teamCommission1 = this.getTeamCommission(this.getOverridesRate('CP', 'EVP'), agentQtyOfEVPTeam);
    //Earn by managing RVP
    let agentQtyOfRVPTeam = TITLE_MAP['RVP'].basicOrgStructAgentQty * this.commissionInput.qtyOfRVP;
    const teamCommission2 = this.getTeamCommission(this.getOverridesRate('CP', 'RVP'), agentQtyOfRVPTeam);
    //Earn by managing DVM
    let agentQtyOfDVMTeam = TITLE_MAP['DVM'].basicOrgStructAgentQty * this.commissionInput.qtyOfDVM;
    const teamCommission3 = this.getTeamCommission(this.getOverridesRate('CP', 'DVM'), agentQtyOfDVMTeam);
    //Earn by managing SDM
    let agentQtyOfSDMTeam = TITLE_MAP['SDM'].basicOrgStructAgentQty * this.commissionInput.qtyOfSDM;
    const teamCommission4 = this.getTeamCommission(this.getOverridesRate('CP', 'SDM'), agentQtyOfSDMTeam);
    //Earn by managing DM
    let agentQtyOfDMTeam = TITLE_MAP['DM'].basicOrgStructAgentQty * this.commissionInput.qtyOfDM;
    const teamCommission5 = this.getTeamCommission(this.getOverridesRate('CP', 'DM'), agentQtyOfDMTeam);
    //Earn by managing SSA
    let agentQtyOfSSATeam = TITLE_MAP['SSA'].basicOrgStructAgentQty * this.commissionInput.qtyOfSSA;
    const teamCommission6 = this.getTeamCommission(this.getOverridesRate('CP', 'SSA'), agentQtyOfSSATeam);
    //Earn by managing SA
    let agentQtyOfSATeam = TITLE_MAP['SA'].basicOrgStructAgentQty * this.commissionInput.qtyOfSSA;
    const teamCommission7 = this.getTeamCommission(this.getOverridesRate('CP', 'SA'), agentQtyOfSATeam);

    const totalCommission = selfCommission + teamCommission1 + teamCommission2 + teamCommission3 +
        teamCommission4 + teamCommission5 + teamCommission6 + teamCommission7;

    this.commission = {
      selfCommission,
      overrideCommission: teamCommission1 + teamCommission2 + teamCommission3 +
          teamCommission4 + teamCommission5 + teamCommission6 + teamCommission7,
      totalCommission
    };
  }

  private calculateEVPCommission() {
    // Self performance
    const selfCommission = this.getSelfCommission();
    // 4 DMs under RVP, 1 DM is separate from the RVP leg
    //Earn by managing RVP
    let agentQtyOfRVPTeam = 19 + TITLE_MAP['RVP'].basicOrgStructAgentQty * (this.commissionInput.qtyOfRVP -1);
    const teamCommission1 = this.getTeamCommission(this.getOverridesRate('EVP', 'RVP'), agentQtyOfRVPTeam);
    //Earn by managing DVM
    let agentQtyOfDVMTeam = TITLE_MAP['DVM'].basicOrgStructAgentQty * this.commissionInput.qtyOfDVM;
    const teamCommission2 = this.getTeamCommission(this.getOverridesRate('EVP', 'DVM'), agentQtyOfDVMTeam);
    //Earn by managing SDM
    let agentQtyOfSDMTeam = TITLE_MAP['SDM'].basicOrgStructAgentQty * this.commissionInput.qtyOfSDM;
    const teamCommission3 = this.getTeamCommission(this.getOverridesRate('EVP', 'SDM'), agentQtyOfSDMTeam);
    //Earn by managing DM
    let agentQtyOfDMTeam = TITLE_MAP['DM'].basicOrgStructAgentQty * this.commissionInput.qtyOfDM;
    const teamCommission4 = this.getTeamCommission(this.getOverridesRate('EVP', 'DM'), agentQtyOfDMTeam);
    //Earn by managing SSA
    let agentQtyOfSSATeam = TITLE_MAP['SSA'].basicOrgStructAgentQty * this.commissionInput.qtyOfSSA;
    const teamCommission5 = this.getTeamCommission(this.getOverridesRate('EVP', 'SSA'), agentQtyOfSSATeam);
    //Earn by managing SA
    let agentQtyOfSATeam = TITLE_MAP['SA'].basicOrgStructAgentQty * this.commissionInput.qtyOfSSA;
    const teamCommission6 = this.getTeamCommission(this.getOverridesRate('EVP', 'SA'), agentQtyOfSATeam);

    const totalCommission = selfCommission + teamCommission1 + teamCommission2 + teamCommission3 + teamCommission4 + teamCommission5 + teamCommission6;
    this.commission = {
      selfCommission,
      overrideCommission: teamCommission1 + teamCommission2,
      totalCommission
    };
  }



  private calculateRVPCommission() {
    // Self performance
    const selfCommission = this.getSelfCommission();
    //3 DM under 1 DVM, 1 DM is separate from the DVM leg
    //Earn by managing DVM
    let agentQtyOfDVMTeam = 14 + TITLE_MAP['DVM'].basicOrgStructAgentQty * (this.commissionInput.qtyOfDVM -1);
    const teamCommission1 = this.getTeamCommission(this.getOverridesRate('RVP', 'DVM'), agentQtyOfDVMTeam);
    //Earn by managing SDM
    let agentQtyOfSDMTeam = TITLE_MAP['SDM'].basicOrgStructAgentQty * this.commissionInput.qtyOfSDM;
    const teamCommission2 = this.getTeamCommission(this.getOverridesRate('RVP', 'DVM'), agentQtyOfSDMTeam);
    //Earn by managing DM
    let agentQtyOfDMTeam = TITLE_MAP['DM'].basicOrgStructAgentQty * this.commissionInput.qtyOfDM;
    const teamCommission3 = this.getTeamCommission(this.getOverridesRate('RVP', 'DM'), agentQtyOfDMTeam);
    //Earn by managing SSA
    let agentQtyOfSSATeam = TITLE_MAP['SSA'].basicOrgStructAgentQty * this.commissionInput.qtyOfSSA;
    const teamCommission4 = this.getTeamCommission(this.getOverridesRate('DVM', 'SSA'), agentQtyOfSSATeam);
    //Earn by managing SA
    let agentQtyOfSATeam = TITLE_MAP['SA'].basicOrgStructAgentQty * this.commissionInput.qtyOfSSA;
    const teamCommission5 = this.getTeamCommission(this.getOverridesRate('DVM', 'SA'), agentQtyOfSATeam);

    const totalCommission = selfCommission + teamCommission1 + teamCommission2 + teamCommission3 + teamCommission4 + teamCommission5;
    this.commission = {
      selfCommission,
      overrideCommission: teamCommission1 + teamCommission1 + teamCommission2 + teamCommission3 + teamCommission4 + teamCommission5,
      totalCommission
    };
  }


  private calculateDVMCommission() {
    // Self performance
    const selfCommission = this.getSelfCommission();
    //Earn by managing SDM
    let agentQtyOfSDMTeam = 9 + TITLE_MAP['SDM'].basicOrgStructAgentQty * (this.commissionInput.qtyOfSDM - 1);
    const teamCommission1 = this.getTeamCommission(this.getOverridesRate('DVM', 'SDM'), agentQtyOfSDMTeam);
    //Earn by managing DM
    let agentQtyOfDMTeam = TITLE_MAP['DM'].basicOrgStructAgentQty * this.commissionInput.qtyOfDM;
    const teamCommission2 = this.getTeamCommission(this.getOverridesRate('DVM', 'DM'), agentQtyOfDMTeam);
    //Earn by managing SSA
    let agentQtyOfSSATeam = TITLE_MAP['SSA'].basicOrgStructAgentQty * this.commissionInput.qtyOfSSA;
    const teamCommission3 = this.getTeamCommission(this.getOverridesRate('DVM', 'SSA'), agentQtyOfSSATeam);
    //EArn by managing SA
    let agentQtyOfSATeam = TITLE_MAP['SA'].basicOrgStructAgentQty * this.commissionInput.qtyOfSSA;
    const teamCommission4 = this.getTeamCommission(this.getOverridesRate('DVM', 'SA'), agentQtyOfSATeam);

    const totalCommission = selfCommission + teamCommission1 + teamCommission2 + teamCommission3 + teamCommission4;
    this.commission = {
      selfCommission,
      overrideCommission: teamCommission1 + teamCommission2 + teamCommission3 + teamCommission4,
      totalCommission
    };
  }

  private calculateSDMCommission() {
    // Self performance
    const selfCommission = this.getSelfCommission();
    //Earn by managing DM
    const teamCommission1 = this.getTeamCommission(this.getOverridesRate('SDM', 'DM'), TITLE_MAP['DM'].basicOrgStructAgentQty * this.commissionInput.qtyOfDM);
    //Earn by managing SSA
    const teamCommission2 = this.getTeamCommission(this.getOverridesRate('SDM', 'SSA'), TITLE_MAP['SSA'].basicOrgStructAgentQty * this.commissionInput.qtyOfSSA);
    //Earn by managing SA
    const teamCommission3 = this.getTeamCommission(this.getOverridesRate('SDM', 'SA'), TITLE_MAP['SA'].basicOrgStructAgentQty * this.commissionInput.qtyOfSA);
    const totalCommission = selfCommission + teamCommission1 + teamCommission2 + teamCommission3;
    this.commission = {
      selfCommission,
      overrideCommission: teamCommission1 + teamCommission2 + teamCommission3,
      totalCommission
    };
  }

  private getTeamCommission(overridesRate: number = 0.0, numberOfPeople: number = 0) {
    return this.commissionInput.teamAverageDealValue * this.commissionInput.teamDealsPerWeek
        * (this.commissionInput.teamContingencyFee * 0.500 / 100) * numberOfPeople * overridesRate;
  }

  private calculateDMCommission() {
    // Self performance
    const selfCommission = this.getSelfCommission();
    //Promotion Requirement Recruiting: 3 people
    //Earn by managing SSA
    // 1 (SSA himself) + 1 (down line SA)
    const teamCommission1 = this.getTeamCommission(this.getOverridesRate('DM', 'SSA'), TITLE_MAP['SSA'].basicOrgStructAgentQty * this.commissionInput.qtyOfSSA);
    //SA -> 1
    const teamCommission2 = this.getTeamCommission(this.getOverridesRate('DM', 'SA'), TITLE_MAP['SA'].basicOrgStructAgentQty * this.commissionInput.qtyOfSA);

    const totalCommission = selfCommission + teamCommission1 + teamCommission2;
    this.commission = {
      selfCommission,
      overrideCommission: teamCommission1 + teamCommission2,
      totalCommission
    };

  }

  private calculateSSACommission() {
    const selfCommission = this.getSelfCommission();
    //earn by managing subordinates
    const teamCommission = this.getTeamCommission(this.getOverridesRate('SSA', 'SA'), this.commissionInput.qtyOfSA);
    const totalCommission = selfCommission + teamCommission;
    this.commission = {
      selfCommission,
      overrideCommission: teamCommission,
      totalCommission
    };
  }

  private getOverridesRate(title01: string, title02: string) {
    return TITLE_MAP[title01].mgrOverridesRate - TITLE_MAP[title02].mgrOverridesRate;
  }

  /**
   *
   *   notes: As a sales agent,
   *   1. You have no down line people to manage
   *   2. You can earn commission by doing more claim settlements
   *
   *       SA
   *
   * */
  private calculateSACommission() {
    const selfCommission = this.getSelfCommission();
    const totalCommission = selfCommission;
    this.commission = {
      selfCommission,
      overrideCommission: 0.0,
      totalCommission
    };
  }

  private getSelfCommission() {
    let titleRate = TITLE_ARRAY.filter(value =>  value.code=== this.commissionInput.title)[0].mgrOverridesRate;
    let rateNumber = this.commissionInput.sourceRate/100.0 + this.commissionInput.signRate/100.0 + this.commissionInput.adjustRate/100.0 + titleRate;
    console.log("getSelfCommission rateNumber......")
    console.log(rateNumber)
    return rateNumber * this.commissionInput.selfDealsPerWeek * this.commissionInput.selfAverageDealValue
        * (this.commissionInput.selfContingencyFee * 0.500 / 100);
  }

  constructor(
      private _formBuilder: FormBuilder,
      private dialogService: DialogService,
      private spinner: NgxSpinnerService,
      private tabService: TabService,
      private dialog: MatDialog
  ) { }

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

  onNavigate(side: string) {
    this.tabService.setSideTitle(side);
  }

  onTitleChange($event: MatSelectChange) {
    let titleCode = $event.value
    this.commissionInput.title = titleCode;
    this.dataSource = new MatTableDataSource(TITLE_MAP[this.commissionInput.title].commissionDesc);
    if (TITLE_MAP[titleCode].code === 'SA') {
      // this.teamStructureImgUrl = 'assets/img/mlm/sa-team-structure-model.png';
      this.teamStructureImgUrl = '';
    } else if (TITLE_MAP[titleCode].code === 'SSA') {
      // this.teamStructureImgUrl = 'assets/img/mlm/ssa-team-structure-model.png';
      this.teamStructureImgUrl = '';
      this.commissionInput = {...this.commissionInput, qtyOfSA:1};
    } else if (TITLE_MAP[titleCode].code === 'DM') {
      // this.teamStructureImgUrl = 'assets/img/mlm/dm-team-structure-model.png';
      this.teamStructureImgUrl = '';
      this.commissionInput = {...this.commissionInput, qtyOfSA:1, qtyOfSSA: 1};
    } else if (TITLE_MAP[titleCode].code === 'SDM') {
      this.teamStructureImgUrl = 'assets/img/mlm/sdm-team-structure-model.png';
      this.commissionInput = {...this.commissionInput, qtyOfSA:1, qtyOfSSA: 1, qtyOfDM: 1};
    } else if (TITLE_MAP[titleCode].code === 'DVM') {
      this.teamStructureImgUrl = 'assets/img/mlm/dvm-team-structure-model.png';
      this.commissionInput = {...this.commissionInput, qtyOfSA:1, qtyOfSSA: 1, qtyOfDM: 1, qtyOfSDM: 1};
    } else if (TITLE_MAP[titleCode].code === 'RVP') {
      this.teamStructureImgUrl = 'assets/img/mlm/rvp-team-structure-model.png';
      this.commissionInput = {...this.commissionInput, qtyOfSA:1, qtyOfSSA: 1, qtyOfDM: 1, qtyOfSDM: 1, qtyOfDVM: 1};
    } else if (TITLE_MAP[titleCode].code === 'EVP') {
      this.teamStructureImgUrl = 'assets/img/mlm/evp-team-structure-model.png';
      this.commissionInput = {...this.commissionInput, qtyOfSA:1, qtyOfSSA: 1, qtyOfDM: 1, qtyOfSDM: 1, qtyOfDVM: 1, qtyOfRVP: 1};
    } else if (TITLE_MAP[titleCode].code === 'CP') {
      this.teamStructureImgUrl = 'https://via.placeholder.com/300x200';
      this.commissionInput = {...this.commissionInput, qtyOfSA:1, qtyOfSSA: 1, qtyOfDM: 1, qtyOfSDM: 1, qtyOfDVM: 1, qtyOfRVP: 1, qtyOfEVP: 1};
    }
  }

  showQtyInput(targetTitleCode: string) {
    let currentTitle: TitleModel = TITLE_MAP[this.commissionInput.title];
    return currentTitle.level > TITLE_MAP[targetTitleCode].level;
  }

  openCommissionBreakdown() {
    this.dialog.open(CommissionBreakdownDialogComponent, {
      width: "600px"
    });
  }

  openOrgChart(){
    this.dialog.open(TeamStructureDialogComponent, {
        width: '600px',
        data :{
          teamStructureImgUrl: this.teamStructureImgUrl
        }
    });
  }

  protected readonly TITLE_ARRAY = TITLE_ARRAY;
}
