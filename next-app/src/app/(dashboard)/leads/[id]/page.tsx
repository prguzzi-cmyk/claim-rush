import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { fetchAPI } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { LeadDetailHeader } from "@/components/leads/lead-detail-header";
import { LeadContactCard } from "@/components/leads/lead-contact-card";
import { OwnerIntelligenceCard } from "@/components/leads/owner-intelligence-card";
import type { Lead } from "@/types/lead";
import type { LeadOwnerIntelligence, SkiptraceWalletSummary } from "@/types/skip-trace";

export const dynamic = "force-dynamic";

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

function LeadDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[60px] rounded-xl" />
      <Skeleton className="h-[200px] rounded-xl" />
      <Skeleton className="h-[200px] rounded-xl" />
    </div>
  );
}

async function LeadDetailContent({ id }: { id: string }) {
  let lead: Lead | null = null;
  let ownerIntel: LeadOwnerIntelligence | null = null;
  let walletSummary: SkiptraceWalletSummary | null = null;

  try {
    [lead, ownerIntel, walletSummary] = await Promise.all([
      fetchAPI<Lead>(`/api/v1/leads/${id}`),
      fetchAPI<LeadOwnerIntelligence | null>(
        `/api/v1/skip-trace-wallet/leads/${id}/owner-intelligence`
      ).catch(() => null),
      fetchAPI<SkiptraceWalletSummary>(
        "/api/v1/skip-trace-wallet/balance"
      ).catch(() => null),
    ]);
  } catch (error) {
    console.error("Failed to fetch lead:", error);
    return (
      <div className="text-center text-muted-foreground">
        <p>Failed to load lead details.</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center text-muted-foreground">
        <p>Lead not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LeadDetailHeader lead={lead} />

      {lead.contact && <LeadContactCard contact={lead.contact} />}

      <OwnerIntelligenceCard
        leadId={id}
        initialData={ownerIntel}
        walletSummary={walletSummary}
      />
    </div>
  );
}

export default async function LeadDetailPage({
  params,
}: LeadDetailPageProps) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <Link href="/fire-leads">
        <Button variant="ghost" size="sm" className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to Leads
        </Button>
      </Link>

      <Suspense fallback={<LeadDetailSkeleton />}>
        <LeadDetailContent id={id} />
      </Suspense>
    </div>
  );
}
