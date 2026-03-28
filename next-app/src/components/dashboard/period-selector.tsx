"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PERIOD_LABELS,
  PERIOD_TYPES,
  DEFAULT_PERIOD,
  type PeriodType,
} from "@/lib/constants";

export function PeriodSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPeriod = (searchParams.get("period") || DEFAULT_PERIOD) as PeriodType;

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", value);
    router.push(`/dashboard?${params.toString()}`);
  };

  const periodEntries = Object.entries(PERIOD_TYPES).filter(
    ([, value]) => value !== "custom-range"
  );

  return (
    <Select value={currentPeriod} onValueChange={handleChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select period" />
      </SelectTrigger>
      <SelectContent>
        {periodEntries.map(([, value]) => (
          <SelectItem key={value} value={value}>
            {PERIOD_LABELS[value as PeriodType]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
