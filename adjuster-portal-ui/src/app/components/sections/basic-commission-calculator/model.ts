export interface CommissionCalculatorInput {
    title: string;
    dealsSourcedPerWeek: number;
    dealsSignedPerWeek: number;
    dealsAdjustedPerWeek: number;
    dealsPerPersonOfDummyTeam: number;
    averageDealValue: number;
}

export interface SystemDefaultInput {
    ContingencyFeeWeight: number;
    CommissionableFeeWeight: number;
    SourceFeeRate: number;
    SignFeeRate: number;
    AdjustFeeRate: number;
    SATeamAmountOfAgents?: number;
    SSATeamAmountOfAgents?: number;
    DMTeamAmountOfAgents?: number;
    SDMTeamAmountOfAgents?: number;
    DVMTeamAmountOfAgents?: number;
    RVPTeamAmountOfAgents?: number;
    EVPTeamAmountOfAgents?: number;
    CPTeamAmountOfAgents?: number;
}
