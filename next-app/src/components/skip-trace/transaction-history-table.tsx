import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SkiptraceTransaction } from "@/types/skip-trace";
import { ACTION_LABELS, type ActionType } from "@/types/skip-trace";

interface TransactionHistoryTableProps {
  transactions: SkiptraceTransaction[];
}

export function TransactionHistoryTable({
  transactions,
}: TransactionHistoryTableProps) {
  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No transactions yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Transaction History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 pr-4 font-medium">Date</th>
                <th className="pb-3 pr-4 font-medium">Action</th>
                <th className="pb-3 pr-4 font-medium">Details</th>
                <th className="pb-3 pr-4 font-medium text-right">Credits</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => (
                <tr key={txn.id} className="border-b last:border-0">
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {new Date(txn.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant="outline" className="text-xs">
                      {ACTION_LABELS[(txn.action_type || "skip_trace") as ActionType] ||
                        txn.action_type}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 max-w-[200px] truncate">
                    {txn.address_queried || "—"}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono">
                    {txn.credits_used}
                  </td>
                  <td className="py-3">
                    <Badge
                      variant={
                        txn.lookup_status === "success"
                          ? "default"
                          : txn.lookup_status === "no_results"
                            ? "secondary"
                            : "destructive"
                      }
                      className={
                        txn.lookup_status === "success"
                          ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                          : ""
                      }
                    >
                      {txn.lookup_status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
