import { C } from "../theme";

export const PROGRAMS = [
  {
    id: "wtp",
    name: "We The People",
    subtitle: "Homeowner Protection",
    audience: "For homeowners",
    leadType: "Homeowner",
    price: "$19–$99/month",
    color: C.gold,
    tiers: ["Standard — $19/mo", "Gold — $49/mo", "Platinum — $99/mo"],
    benefits: [
      "Policy guidance (LEX AI)",
      "Claim review support",
      "Contractor fraud protection",
    ],
  },
  {
    id: "ls",
    name: "LandlordShield",
    subtitle: "Rental Protection",
    audience: "For landlords / rental property owners",
    leadType: "Landlord",
    price: "$49–$249/month per unit",
    color: C.blue,
    tiers: ["Standard — $49/mo", "Pro — $149/mo", "Enterprise — $249/mo"],
    benefits: [
      "Move-in / move-out inspections",
      "Tenant damage claim filing",
      "Lost rent recovery",
    ],
  },
  {
    id: "bs",
    name: "Business Shield",
    subtitle: "Commercial Protection",
    audience: "For business owners",
    leadType: "Business",
    price: "$79–$399/month",
    color: C.green,
    tiers: ["Standard — $79/mo", "Pro — $199/mo", "Enterprise — $399/mo"],
    benefits: [
      "Cash-out policy review",
      "Business interruption claims",
      "Co-insurance protection",
    ],
  },
];

export function getProgramByLeadType(leadType) {
  return PROGRAMS.find(p => p.leadType === leadType) || PROGRAMS[0];
}
