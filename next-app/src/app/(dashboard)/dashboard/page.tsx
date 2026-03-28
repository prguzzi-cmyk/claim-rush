import { Suspense } from "react";
import {
  Flame,
  Droplets,
  Users,
  Calculator,
  FileText,
  TrendingUp,
  Activity,
  Clock,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

import { fetchAPI } from "@/lib/api-client";
import { DEFAULT_PERIOD, type PeriodType } from "@/lib/constants";
import type {
  LeadsByStatus,
  LeadsBySource,
  LeadsByAssignedUser,
  ClaimsByPhase,
  UsersByRole,
} from "@/types/dashboard";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { LeadsByStatusChart } from "@/components/dashboard/leads-by-status-chart";
import { LeadsBySourceChart } from "@/components/dashboard/leads-by-source-chart";
import { LeadsByUserChart } from "@/components/dashboard/leads-by-user-chart";
import { ClaimsByPhaseChart } from "@/components/dashboard/claims-by-phase-chart";
import { UsersByRoleCard } from "@/components/dashboard/users-by-role-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

interface DashboardPageProps {
  searchParams: Promise<{ period?: string }>;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[130px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[140px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[380px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}

const navSections = [
  {
    title: "Fire Leads",
    description: "Manage fire damage leads and incidents",
    href: "/fire-leads",
    icon: Flame,
    iconColor: "text-orange-500",
    bgColor: "bg-orange-500/10",
    stat: "Active pipeline",
  },
  {
    title: "Water Leads",
    description: "Track water damage leads and claims",
    href: "/water-leads",
    icon: Droplets,
    iconColor: "text-sky-500",
    bgColor: "bg-sky-500/10",
    stat: "Active pipeline",
  },
  {
    title: "CRM",
    description: "Client relationships and contacts",
    href: "/crm",
    icon: Users,
    iconColor: "text-violet-500",
    bgColor: "bg-violet-500/10",
    stat: "All contacts",
  },
  {
    title: "Estimating Admin",
    description: "Estimates, pricing, and approvals",
    href: "/estimating",
    icon: Calculator,
    iconColor: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    stat: "Pending review",
  },
];

async function DashboardContent({ period }: { period: PeriodType }) {
  const periodParam = `?period_type=${period}`;

  let leadsByStatus: LeadsByStatus[] = [];
  let leadsBySource: LeadsBySource[] = [];
  let leadsByUser: LeadsByAssignedUser[] = [];
  let claimsByPhase: ClaimsByPhase[] = [];
  let usersByRole: UsersByRole[] = [];

  try {
    [leadsByStatus, leadsBySource, leadsByUser, claimsByPhase, usersByRole] =
      await Promise.all([
        fetchAPI<LeadsByStatus[]>(
          `/api/v1/dashboard/leads-count-by-status${periodParam}`
        ),
        fetchAPI<LeadsBySource[]>(
          `/api/v1/dashboard/leads-count-by-source${periodParam}`
        ),
        fetchAPI<LeadsByAssignedUser[]>(
          `/api/v1/dashboard/leads-count-by-assigned-user${periodParam}`
        ),
        fetchAPI<ClaimsByPhase[]>(
          `/api/v1/dashboard/claims-count-by-current-phase${periodParam}`
        ),
        fetchAPI<UsersByRole[]>("/api/v1/dashboard/users-count-by-role"),
      ]);
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
  }

  const totalLeads = leadsByStatus.reduce(
    (sum, item) => sum + (item.leads_count || 0),
    0
  );
  const totalClaims = claimsByPhase.reduce(
    (sum, item) => sum + (item.claims_count || 0),
    0
  );
  const totalUsers = usersByRole.reduce(
    (sum, item) => sum + (item.users_count || 0),
    0
  );
  const totalSources = leadsBySource.length;

  return (
    <>
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Leads"
          value={totalLeads}
          icon={TrendingUp}
          iconColor="text-blue-500"
          iconBgColor="bg-blue-500/10"
          trend={{ value: "+12%", positive: true }}
          description="vs last period"
        />
        <KpiCard
          title="Active Claims"
          value={totalClaims}
          icon={FileText}
          iconColor="text-amber-500"
          iconBgColor="bg-amber-500/10"
          trend={{ value: "+5%", positive: true }}
          description="vs last period"
        />
        <KpiCard
          title="Team Members"
          value={totalUsers}
          icon={Users}
          iconColor="text-violet-500"
          iconBgColor="bg-violet-500/10"
        />
        <KpiCard
          title="Lead Sources"
          value={totalSources}
          icon={Activity}
          iconColor="text-emerald-500"
          iconBgColor="bg-emerald-500/10"
        />
      </div>

      {/* Navigation Section Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {navSections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-border/80">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`rounded-xl p-2.5 ${section.bgColor}`}>
                    <section.icon className={`h-5 w-5 ${section.iconColor}`} />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/0 transition-all group-hover:text-muted-foreground/70 group-hover:translate-x-0.5" />
                </div>
                <div className="mt-3">
                  <h3 className="text-sm font-semibold">{section.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {section.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Charts */}
      <DashboardGrid>
        <LeadsByStatusChart data={leadsByStatus} />
        <LeadsBySourceChart data={leadsBySource} />
        <LeadsByUserChart data={leadsByUser} />
        <ClaimsByPhaseChart data={claimsByPhase} />
      </DashboardGrid>

      {/* Users by Role */}
      <UsersByRoleCard data={usersByRole} />
    </>
  );
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = await searchParams;
  const period = (params.period || DEFAULT_PERIOD) as PeriodType;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back. Here&apos;s an overview of your operations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          <PeriodSelector />
        </div>
      </div>

      {/* Dashboard Content */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent period={period} />
      </Suspense>
    </div>
  );
}
