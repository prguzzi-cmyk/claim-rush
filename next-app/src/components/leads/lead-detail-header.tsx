import { Badge } from "@/components/ui/badge";
import type { Lead } from "@/types/lead";

interface LeadDetailHeaderProps {
  lead: Lead;
}

export function LeadDetailHeader({ lead }: LeadDetailHeaderProps) {
  const perilColor =
    lead.peril?.toLowerCase().includes("fire")
      ? "bg-orange-500/10 text-orange-600"
      : lead.peril?.toLowerCase().includes("water")
        ? "bg-sky-500/10 text-sky-600"
        : "bg-gray-500/10 text-gray-600";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            Lead #{lead.ref_number}
          </h1>
          <Badge variant="outline">{lead.status}</Badge>
        </div>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          {lead.peril && (
            <Badge className={perilColor} variant="secondary">
              {lead.peril}
            </Badge>
          )}
          {lead.assigned_user && (
            <span>
              Assigned to{" "}
              {[lead.assigned_user.first_name, lead.assigned_user.last_name]
                .filter(Boolean)
                .join(" ") || lead.assigned_user.email}
            </span>
          )}
        </div>
      </div>
      {lead.loss_date && (
        <p className="text-sm text-muted-foreground">
          Loss Date:{" "}
          {new Date(lead.loss_date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      )}
    </div>
  );
}
