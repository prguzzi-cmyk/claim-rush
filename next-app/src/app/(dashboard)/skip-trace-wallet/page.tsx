import { Suspense } from "react";
import { Wallet, TrendingUp, CreditCard, Activity, Zap } from "lucide-react";
import { fetchAPI } from "@/lib/api-client";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditPackCard } from "@/components/skip-trace/credit-pack-card";
import { TransactionHistoryTable } from "@/components/skip-trace/transaction-history-table";
import type { SkiptraceWalletSummary, SkiptraceTransaction } from "@/types/skip-trace";
import { CREDIT_PACKS, ACTION_COSTS, ACTION_LABELS, type ActionType } from "@/types/skip-trace";

export const dynamic = "force-dynamic";

function WalletSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[130px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[200px] rounded-xl" />
    </div>
  );
}

async function WalletContent() {
  let summary: SkiptraceWalletSummary = {
    credit_balance: 0,
    credits_used_total: 0,
    credits_used_this_month: 0,
    is_unlimited: false,
  };
  let transactions: SkiptraceTransaction[] = [];

  try {
    [summary, transactions] = await Promise.all([
      fetchAPI<SkiptraceWalletSummary>("/api/v1/skip-trace-wallet/balance"),
      fetchAPI<SkiptraceTransaction[]>("/api/v1/skip-trace-wallet/transactions"),
    ]);
  } catch (error) {
    console.error("Failed to fetch wallet data:", error);
  }

  const estimatedTraces = summary.is_unlimited
    ? "Unlimited"
    : Math.floor(summary.credit_balance / ACTION_COSTS.skip_trace);

  return (
    <>
      {/* KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Credit Balance"
          value={summary.is_unlimited ? "Unlimited" : summary.credit_balance}
          icon={Wallet}
          iconColor="text-emerald-500"
          iconBgColor="bg-emerald-500/10"
        />
        <KpiCard
          title="Credits Used This Month"
          value={summary.credits_used_this_month}
          icon={Activity}
          iconColor="text-blue-500"
          iconBgColor="bg-blue-500/10"
        />
        <KpiCard
          title="Total Credits Used"
          value={summary.credits_used_total}
          icon={TrendingUp}
          iconColor="text-violet-500"
          iconBgColor="bg-violet-500/10"
        />
        <KpiCard
          title="Skip Traces Available"
          value={estimatedTraces}
          icon={Zap}
          iconColor="text-amber-500"
          iconBgColor="bg-amber-500/10"
        />
      </div>

      {/* Low balance warning */}
      {!summary.is_unlimited && summary.credit_balance <= 5 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
            {summary.credit_balance === 0
              ? "You have no credits remaining. Purchase a pack below to continue running skip traces."
              : `Low balance: Only ${summary.credit_balance} credit${summary.credit_balance !== 1 ? "s" : ""} remaining.`}
          </p>
        </div>
      )}

      {/* Action Costs */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Credit Costs Per Action</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.entries(ACTION_COSTS) as [ActionType, number][]).map(
            ([action, cost]) => (
              <div
                key={action}
                className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3"
              >
                <span className="text-sm text-muted-foreground">
                  {ACTION_LABELS[action]}
                </span>
                <span className="font-mono text-sm font-semibold">
                  {cost} credit{cost !== 1 ? "s" : ""}
                </span>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Credit Packs */}
      {!summary.is_unlimited && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Purchase Credits</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CREDIT_PACKS.map((pack) => (
              <CreditPackCard key={pack.size} pack={pack} />
            ))}
          </div>
        </div>
      )}

      {/* Transaction History */}
      <TransactionHistoryTable transactions={transactions} />
    </>
  );
}

export default function SkipTraceWalletPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <CreditCard className="h-6 w-6 text-emerald-500" />
          Skip Trace Wallet
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your credits, view costs per action, and track usage history.
        </p>
      </div>

      <Suspense fallback={<WalletSkeleton />}>
        <WalletContent />
      </Suspense>
    </div>
  );
}
