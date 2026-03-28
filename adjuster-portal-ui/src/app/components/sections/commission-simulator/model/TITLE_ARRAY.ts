import {TitleModel} from "./title.model";

export const TITLE_ARRAY: TitleModel[] = [
    {
        id: 1,
        name: 'Sales Agent',
        code: 'SA',
        level: 0,
        description: 'Sales Agent',
        numberOfSubordinates: 0,
        mgrOverridesRate: 0.000,
        commissionDesc: [
            'As SA, you have no down line people to manage',
            'You can only earn from your own performance of claim settlement.'
        ],
        basicOrgStructAgentQty: 1

    },
    {
        id: 2,
        name: 'Senior Sales Agent',
        code: 'SSA',
        level: 1,
        description: 'Senior Sales Agent',
        numberOfSubordinates: 1,
        mgrOverridesRate: 0.025,
        commissionDesc: [
            'As SSA, you have to recruit at least 1 person with the title SA',
            'You may have multiple SA\'s as downline team member',
            'You may receive additional compensation from your own performance',
            'As a manager, you may earn 2.5% of CFG from claim settlements that belongs to each downline agent'
        ],
        basicOrgStructAgentQty: 2
    },
    {
        id: 3,
        name: 'District Manager',
        code: 'DM',
        level: 2,
        description: 'District Manager',
        numberOfSubordinates: 3,
        mgrOverridesRate: 0.050,
        commissionDesc: [
            'As DM, you total number of downline agents should be no less than 3',
            'You are required to have at least 1 agent with the title SSA',
            'You may have multiple SSA agents as direct down line',
            'You are not required to have direct down line sales agent as long as the total amount of down line agents is no less than 3',
            'As a manager, you may earn 5% of CFG generated from each claim settlement case that belongs to your direct down line SA',
            'As a manager, you may earn 2.5% of CFG generated from each claim settlement case that belongs to your down line SSA agent and his or her own down line team member',
        ],
        basicOrgStructAgentQty: 4
    },
    {
        id: 4,
        name: 'Senior District Manager',
        code: 'SDM',
        level: 3,
        description: 'Senior District Manager',
        numberOfSubordinates: 5,
        mgrOverridesRate: 0.100,
        commissionDesc: [
            'As SDM, you total number of down line agents should be no less than 5',
            'You are required to have at least 1 agent with the title DM',
            'You may have multiple DM agents as direct down line',
            'You are not required to have any direct down line agent with the title SSA or SA as long as the total amount of down line agents is no less than 5',
            'As a manager, you may earn 10% of CFG generated from each claim settlement case that belongs to your own SA',
            'As a manager, you may earn 7.5% of CFG generated from each claim settlement case that belongs to your own SSA and his/her own down line team member',
            'As a manager, you may earn 5% of CFG generated from each claim settlement case that belongs to your own DM agent and his/her own down line team member',
        ],
        basicOrgStructAgentQty: 8
    },
    {
        id: 5,
        name: 'Divisional Manager',
        code: 'DVM',
        level: 4,
        description: 'Divisional Manager',
        numberOfSubordinates: 10,
        mgrOverridesRate: 0.150,
        commissionDesc: [
            'As DVM, you total number of down line agents should be no less than 10',
            'You are required to have at least 1 agent with the title SDM',
            'You are required to have at least 2 agents with the title DM as down line team member of your own SDM',
            'You are required to have at least 1 agent with the title DM as your own down line',
            'As a manager, you may earn 15% of CFG generated from each claim settlement case that belongs to your own SA',
            'As a manager, you may earn 12.5% of CFG generated from each claim settlement case that belongs to your own SSA and his/her own down line team member',
            'As a manager, you may earn 10% of CFG generated from each claim settlement case that belongs to your own DM agent and his/her own down line team member',
            'As a manager, you may earn 5% of CFG generated from each claim settlement case that belongs to your own SDM agent and his/her own down line team member',
        ],
        basicOrgStructAgentQty: 17
    },
    {
        id: 6,
        name: 'Regional Vice President',
        code: 'RVP',
        level: 5,
        description: 'Regional Vice President',
        numberOfSubordinates: 15,
        mgrOverridesRate: 0.200,
        commissionDesc: [
            'As RVP, you total number of down line agents should be no less than 15',
            'You are required to have at least 1 agent with the title DVM',
            'You are required to have at least 3 agents with the title DM as down line team member of your own DVM',
            'You are required to have at least 1 agent with the title DM as your own down line',
            'As a manager, you may earn 20% of CFG from each claim settlement case that belongs to your own SA',
            'As a manager, you may earn 17.5% of CFG from each claim settlement case that belongs to your own SSA and his/her own down line team member.',
            'As a manager, you may earn 15% of CFG from each claim settlement case that belongs to your own DM and his/her own down line team member.',
            'As a manager, you may earn 10% of CFG from each claim settlement case that belongs to your own SDM and his/her own down line team member.',
            'As a manager, you may earn 5% of CFG from each claim settlement case that belongs to your own DVM and his/her own down line team member.',
        ],
        basicOrgStructAgentQty: 29
    },
    {
        id: 7,
        name: 'Executive Vice President',
        code: 'EVP',
        level: 6,
        description: 'Executive Vice President',
        numberOfSubordinates: 20,
        mgrOverridesRate: 0.250,
        commissionDesc: [
            'As EVP, you total number of down line agents should be no less than 20',
            'You are required to have at least 1 agent with the title RVP',
            'You are required to have at least 4 agents with the title DM as down line team member of your own RVP',
            'You are required to have at least 1 agent with the title DM as your own down line',
            'As a manager, you may earn 25% of CFG from each claim settlement case that belongs to your own down line SA',
            'As a manager, you may earn 22.5% of CFG from each claim settlement case that belongs to your own down line SSA and his/her own down line team member',
            'As a manager, you may earn 20% of CFG from each claim settlement case that belongs to your own down line DM and his/her own down line team member',
            'As a manager, you may earn 15% of CFG from each claim settlement case that belongs to your own down line SDM and his/her own down line team member',
            'As a manager, you may earn 10% of CFG from each claim settlement case that belongs to your own down line DVM and his/her own down line team member',
            'As a manager, you may earn 5% of CFG from each claim settlement case that belongs to your own down line RVP and his/her own down line team member',
        ],
        basicOrgStructAgentQty: 52
    },
    {
        id: 8,
        name: 'Chapter President',
        code: 'CP',
        level: 7,
        description: 'Chapter President',
        numberOfSubordinates: 30,
        mgrOverridesRate: 0.300,
        commissionDesc: [
            'As CP, you total number of down line agents should be no less than 30',
            'You are required to have at least 1 agent with the title EVP',
            'You are required to have at least 1 agent with the title of DVM as down line team member of your own down line EVP',
            'You are required to have at least 1 agent with the title DVM as your own down line',
            'As a manager, you may earn 30% of CFG from each claim settlement case that belongs to your own down line SA',
            'As a manager, you may earn 27.5% of CFG from each claim settlement case that belongs to your own down line SSA and his/her own down line team member',
            'As a manager, you may earn 25% of CFG from each claim settlement case that belongs to your own down line DM and his/her own down line team member',
            'As a manager, you may earn 20% of CFG from each claim settlement case that belongs to your own down line SDM and his/her own down line team member',
            'As a manager, you may earn 15% of CFG from each claim settlement case that belongs to your own down line DVM and his/her own down line team member',
            'As a manager, you may earn 10% of CFG from each claim settlement case that belongs to your own down line RVP and his/her own down line team member',
            'As a manager, you may earn 5% of CFG from each claim settlement case that belongs to your own down line RVP and his/her own down line team member',
        ],
        basicOrgStructAgentQty: 95
    }
];

export const TITLE_MAP: { [key: string]: TitleModel } = TITLE_ARRAY.reduce((map, title) => {
    map[title.code] = title;
    return map;
}, {} as { [key: string]: TitleModel });
