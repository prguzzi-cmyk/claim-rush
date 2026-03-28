export interface SACommissionInput {
    sourceRate: number;
    signRate: number;
    adjustRate: number;
    title: string;
    selfDealsPerWeek: number;
    selfAverageDealValue: number;
    selfContingencyFee: number;
    teamDealsPerWeek: number;
    teamAverageDealValue: number;
    teamContingencyFee: number;
    qtyOfSA: number;
    qtyOfSSA: number;
    qtyOfDM: number;
    qtyOfSDM: number;
    qtyOfDVM: number;
    qtyOfRVP: number;
    qtyOfEVP: number;
}
