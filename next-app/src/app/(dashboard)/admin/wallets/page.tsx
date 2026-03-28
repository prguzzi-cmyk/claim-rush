import { Suspense } from "react";
import { Shield, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { fetchAPI } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { AdminBillingOverview, AdminUserBilling } from "@/types/skip-trace";

export const dynamic = "force-dynamic";

function WalletsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-[80px] rounded-xl" />
      ))}
    </div>
  );
}

function WalletStatusIcon({ user }: { user: AdminUserBilling }) {
  if (user.is_unlimited) {
    return <CheckCircle className="h-5 w-5 text-emerald-500" />;
  }
  if (user.credit_balance === 0) {
    return <XCircle className="h-5 w-5 text-destructive" />;
  }
  if (user.credit_balance <= 5) {
    return <AlertTriangle className="h-5 w-5 text-amber-500" />;
  }
  return <CheckCircle className="h-5 w-5 text-emerald-500" />;
}

function WalletStatusLabel({ user }: { user: AdminUserBilling }) {
  if (user.is_unlimited) return "Unlimited";
  if (user.credit_balance === 0) return "Empty — needs recharge";
  if (user.credit_balance <= 5) return "Low balance";
  return "Healthy";
}

async function WalletsContent() {
  let data: AdminBillingOverview | null = null;

  try {
    data = await fetchAPI<AdminBillingOverview>(
      "/api/v1/skip-trace-wallet/admin/billing",
    );
  } catch (error) {
    console.error("Failed to fetch wallet data:", error);
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          Unable to load wallet data. Admin access required.
        </p>
      </div>
    );
  }

  if (!data) return null;

  // Sort: empty wallets first, then low balance, then healthy
  const sorted = [...data.users].sort((a, b) => {
    if (a.is_unlimited !== b.is_unlimited) return a.is_unlimited ? 1 : -1;
    return a.credit_balance - b.credit_balance;
  });

  const emptyCount = data.users.filter(
    (u) => !u.is_unlimited && u.credit_balance === 0,
  ).length;
  const lowCount = data.users.filter(
    (u) => !u.is_unlimited && u.credit_balance > 0 && u.credit_balance <= 5,
  ).length;

  return (
    <>
      {/* Summary badges */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg border bg-card px-4 py-2">
          <span className="text-sm text-muted-foreground">Total wallets: </span>
          <span className="font-semibold">{data.total_users}</span>
        </div>
        {emptyCount > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2">
            <span className="text-sm text-destructive">
              {emptyCount} empty wallet{emptyCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}
        {lowCount > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2">
            <span className="text-sm text-amber-600 dark:text-amber-400">
              {lowCount} low balance
            </span>
          </div>
        )}
      </div>

      {/* Wallet cards */}
      <div className="space-y-3">
        {sorted.map((user) => (
          <div
            key={user.user_id}
            className="flex items-center gap-4 rounded-xl border bg-card px-5 py-4"
          >
            <WalletStatusIcon user={user} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">{user.user_name}</p>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {user.role}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{user.user_email}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono text-lg font-semibold">
                {user.is_unlimited ? (
                  <span className="text-emerald-500">Unlimited</span>
                ) : (
                  <span
                    className={
                      user.credit_balance === 0
                        ? "text-destructive"
                        : user.credit_balance <= 5
                          ? "text-amber-600 dark:text-amber-400"
                          : ""
                    }
                  >
                    {user.credit_balance}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                <WalletStatusLabel user={user} />
              </p>
            </div>
            <div className="hidden text-right sm:block shrink-0 ml-4">
              <p className="text-xs text-muted-foreground">Used</p>
              <p className="font-mono text-sm">{user.total_credits_used}</p>
            </div>
            <div className="hidden text-right md:block shrink-0 ml-4">
              <p className="text-xs text-muted-foreground">Last recharge</p>
              <p className="text-xs">
                {user.last_recharge
                  ? new Date(user.last_recharge).toLocaleDateString()
                  : "Never"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function WalletMonitoringPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Shield className="h-6 w-6 text-violet-500" />
          Wallet Monitoring
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor all user wallets. Identify who needs recharge or plan changes.
        </p>
      </div>

      <Suspense fallback={<WalletsSkeleton />}>
        <WalletsContent />
      </Suspense>
    </div>
  );
}
