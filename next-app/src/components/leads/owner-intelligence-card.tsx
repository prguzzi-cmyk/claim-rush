"use client";

import { useState } from "react";
import { Search, AlertCircle, CheckCircle, User, Phone, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LeadOwnerIntelligence, SkiptraceWalletSummary } from "@/types/skip-trace";
import Link from "next/link";

interface OwnerIntelligenceCardProps {
  leadId: string;
  initialData: LeadOwnerIntelligence | null;
  walletSummary: SkiptraceWalletSummary | null;
}

export function OwnerIntelligenceCard({
  leadId,
  initialData,
  walletSummary,
}: OwnerIntelligenceCardProps) {
  const [data, setData] = useState<LeadOwnerIntelligence | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSkipTrace = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/skip-trace-wallet/leads/${leadId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 402) {
        setError("insufficient_credits");
        return;
      }

      if (!res.ok) {
        const body = await res.text();
        setError(body || "Skip trace failed");
        return;
      }

      const result: LeadOwnerIntelligence = await res.json();
      setData(result);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Show results if we have successful data
  if (data && data.lookup_status === "success") {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            Owner Intelligence
          </CardTitle>
          <Button variant="outline" size="sm" onClick={runSkipTrace} disabled={loading}>
            {loading ? "Re-running..." : "Re-run"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Owner Name</p>
                <p className="text-sm font-medium">
                  {[data.owner_first_name, data.owner_last_name].filter(Boolean).join(" ") || "N/A"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="text-sm font-medium">{data.owner_phone || "N/A"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{data.owner_email || "N/A"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Mailing Address</p>
                <p className="text-sm font-medium">
                  {[
                    data.owner_mailing_street,
                    data.owner_mailing_city,
                    data.owner_mailing_state,
                    data.owner_mailing_zip,
                  ]
                    .filter(Boolean)
                    .join(", ") || "N/A"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No results state
  if (data && data.lookup_status === "no_results") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Owner Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No results found for this address. You can try again.
          </p>
          <Button className="mt-3" size="sm" onClick={runSkipTrace} disabled={loading}>
            {loading ? "Running..." : "Re-run Skip Trace"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Error: insufficient credits
  if (error === "insufficient_credits") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-red-500" />
            Owner Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-500">Insufficient credits.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Purchase credits to run skip trace lookups.
          </p>
          <Link href="/skip-trace-wallet">
            <Button className="mt-3" size="sm" variant="outline">
              Go to Wallet
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-red-500" />
            Owner Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-500">{error}</p>
          <Button className="mt-3" size="sm" onClick={runSkipTrace} disabled={loading}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Default: no data yet, show run button
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-4 w-4 text-muted-foreground" />
          Owner Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Run a skip trace to find property owner information for this lead.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={runSkipTrace} disabled={loading} size="sm">
            {loading ? (
              <>
                <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Running skip trace...
              </>
            ) : (
              <>
                <Search className="mr-1 h-3.5 w-3.5" />
                Run Skip Trace
              </>
            )}
          </Button>
          {walletSummary && (
            <Badge variant="secondary">
              {walletSummary.is_unlimited
                ? "Unlimited"
                : `${walletSummary.credit_balance} credits`}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
