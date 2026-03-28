"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, AlertTriangle } from "lucide-react";
import type { SkiptraceWalletSummary } from "@/types/skip-trace";

export function WalletTicker() {
  const [wallet, setWallet] = useState<SkiptraceWalletSummary | null>(null);

  useEffect(() => {
    fetch("/api/v1/skip-trace-wallet/balance")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setWallet(data))
      .catch(() => null);
  }, []);

  if (!wallet) return null;

  const isLow = !wallet.is_unlimited && wallet.credit_balance <= 5;
  const isEmpty = !wallet.is_unlimited && wallet.credit_balance === 0;

  return (
    <Link
      href="/skip-trace-wallet"
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent ${
        isEmpty
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : isLow
            ? "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400"
            : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
      }`}
    >
      {isLow ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        <Wallet className="h-3 w-3" />
      )}
      <span>
        {wallet.is_unlimited
          ? "Unlimited"
          : `${wallet.credit_balance} credits`}
      </span>
    </Link>
  );
}
