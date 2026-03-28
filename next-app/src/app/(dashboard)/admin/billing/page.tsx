import { Suspense } from "react";
import {
  BarChart3,
  Users,
  Coins,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { fetchAPI } from "@/lib/api-client";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { AdminBillingOverview } from "@/types/skip-trace";

export const dynamic = "force-dynamic";

function BillingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[130px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[400px] rounded-xl" />
    </div>
  );
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function BillingContent() {
  let data: AdminBillingOverview | null = null;

  try {
    data = await fetchAPI<AdminBillingOverview>(
      "/api/v1/skip-trace-wallet/admin/billing",
    );
  } catch (error) {
    console.error("Failed to fetch billing data:", error);
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          Unable to load billing data. Admin access required.
        </p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      {/* Overview KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Users"
          value={data.total_users}
          icon={Users}
          iconColor="text-blue-500"
          iconBgColor="bg-blue-500/10"
        />
        <KpiCard
          title="Credits in Circulation"
          value={data.total_credits_in_circulation.toLocaleString()}
          icon={Coins}
          iconColor="text-emerald-500"
          iconBgColor="bg-emerald-500/10"
        />
        <KpiCard
          title="Total Credits Used"
          value={data.total_credits_used.toLocaleString()}
          icon={TrendingUp}
          iconColor="text-violet-500"
          iconBgColor="bg-violet-500/10"
        />
        <KpiCard
          title="Estimated Revenue"
          value={formatCents(data.total_revenue_cents)}
          icon={DollarSign}
          iconColor="text-amber-500"
          iconBgColor="bg-amber-500/10"
        />
      </div>

      {/* Users Table */}
      <div className="rounded-xl border bg-card">
        <div className="border-b px-6 py-4">
          <h2 className="text-base font-semibold">User Billing Details</h2>
          <p className="text-sm text-muted-foreground">
            Per-user credit usage, costs, and account status.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium text-right">Balance</th>
                <th className="px-4 py-3 font-medium text-right">
                  Skip Traces
                </th>
                <th className="px-4 py-3 font-medium text-right">SMS</th>
                <th className="px-4 py-3 font-medium text-right">
                  AI Voice
                </th>
                <th className="px-4 py-3 font-medium text-right">
                  Total Used
                </th>
                <th className="px-4 py-3 font-medium text-right">Est. Cost</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last Activity</th>
                <th className="px-4 py-3 font-medium">Last Recharge</th>
              </tr>
            </thead>
            <tbody>
              {data.users.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">
                    No users with wallets found.
                  </td>
                </tr>
              ) : (
                data.users.map((user) => (
                  <tr key={user.user_id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{user.user_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.user_email}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {user.is_unlimited ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          Unlimited
                        </Badge>
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
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {user.skip_traces_used}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {user.sms_used}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {user.ai_voice_calls_used}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {user.total_credits_used}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCents(user.estimated_cost_cents)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          user.subscription_status === "active"
                            ? "default"
                            : "secondary"
                        }
                        className={
                          user.subscription_status === "active"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : ""
                        }
                      >
                        {user.subscription_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(user.last_activity)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(user.last_recharge)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default function AdminBillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BarChart3 className="h-6 w-6 text-blue-500" />
          Usage & Billing
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor credit usage, costs, and billing status for all users.
        </p>
      </div>

      <Suspense fallback={<BillingSkeleton />}>
        <BillingContent />
      </Suspense>
    </div>
  );
}
