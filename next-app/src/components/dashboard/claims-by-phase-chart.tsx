"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClaimsByPhase } from "@/types/dashboard";

interface ClaimsByPhaseChartProps {
  data: ClaimsByPhase[];
}

export function ClaimsByPhaseChart({ data }: ClaimsByPhaseChartProps) {
  const chartData = data
    .filter((d) => d.current_phase && d.claims_count)
    .map((d) => ({
      name: d.current_phase!.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      count: d.claims_count!,
    }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Claims by Phase</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
          No data available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Claims by Phase</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" fontSize={12} angle={-20} textAnchor="end" height={60} />
            <YAxis />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                borderColor: "hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--popover-foreground))",
              }}
            />
            <Bar
              dataKey="count"
              fill="hsl(30, 80%, 55%)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
