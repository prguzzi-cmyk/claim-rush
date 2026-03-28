import { Badge } from "@/components/ui/badge";

interface CreditBalanceBadgeProps {
  balance: number;
  isUnlimited: boolean;
}

export function CreditBalanceBadge({
  balance,
  isUnlimited,
}: CreditBalanceBadgeProps) {
  if (isUnlimited) {
    return (
      <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">
        Unlimited
      </Badge>
    );
  }

  return (
    <Badge variant={balance > 0 ? "secondary" : "destructive"}>
      {balance} credit{balance !== 1 ? "s" : ""}
    </Badge>
  );
}
