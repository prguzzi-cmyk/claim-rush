import { Flame } from "lucide-react";
import Link from "next/link";
import { fetchAPI } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PaginatedLeads } from "@/types/lead";

export const dynamic = "force-dynamic";

export default async function FireLeadsPage() {
  let leads: PaginatedLeads = { items: [], total: 0, page: 1, size: 50, pages: 0 };

  try {
    leads = await fetchAPI<PaginatedLeads>(
      "/api/v1/leads?size=50&peril=fire"
    );
  } catch (error) {
    console.error("Failed to fetch fire leads:", error);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Flame className="h-6 w-6 text-orange-500" />
            Fire Leads
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {leads.total} total fire damage leads
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lead Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          {leads.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fire leads found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">Ref #</th>
                    <th className="pb-3 pr-4 font-medium">Contact</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 pr-4 font-medium">Loss Address</th>
                    <th className="pb-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.items.map((lead) => (
                    <tr key={lead.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="font-medium text-blue-500 hover:underline"
                        >
                          #{lead.ref_number}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        {lead.contact?.full_name || "N/A"}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline">{lead.status}</Badge>
                      </td>
                      <td className="py-3 pr-4 max-w-[200px] truncate">
                        {[
                          lead.contact?.address_loss,
                          lead.contact?.city_loss,
                          lead.contact?.state_loss,
                        ]
                          .filter(Boolean)
                          .join(", ") || "N/A"}
                      </td>
                      <td className="py-3">
                        {lead.created_at
                          ? new Date(lead.created_at).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric" }
                            )
                          : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
