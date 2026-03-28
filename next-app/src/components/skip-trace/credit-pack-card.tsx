"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CreditPack } from "@/types/skip-trace";

interface CreditPackCardProps {
  pack: CreditPack;
}

export function CreditPackCard({ pack }: CreditPackCardProps) {
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/skip-trace-wallet/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack_size: pack.size }),
      });

      if (res.ok) {
        const data = await res.json();
        // In production, redirect to data.stripe_checkout_url
        window.location.reload();
      }
    } catch {
      // Handle error silently for now
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">{pack.label}</h3>
          <p className="text-sm text-muted-foreground">
            {pack.size} credits
          </p>
        </div>
        <div className="mb-4">
          <span className="text-3xl font-bold">${pack.price}</span>
          <span className="ml-1 text-sm text-muted-foreground">
            ({pack.perCredit}/credit)
          </span>
        </div>
        <Button
          className="w-full"
          onClick={handlePurchase}
          disabled={loading}
          size="sm"
        >
          <ShoppingCart className="mr-1 h-3.5 w-3.5" />
          {loading ? "Processing..." : "Buy Credits"}
        </Button>
      </CardContent>
    </Card>
  );
}
